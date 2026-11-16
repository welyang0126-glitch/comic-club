// ── 포스트 이미지 분리 저장 ─────────────────────────────────────
// 포스트 JSON 안의 base64 data URL을 별도 저장소(Postgres post_images 테이블 또는 로컬 파일)로 옮기고,
// 포스트에는 /api/posts/:id/images/:n?v=<hash> URL만 남긴다.
// URL에 내용 해시가 들어가므로 같은 URL의 내용은 바뀌지 않음 → 1년 캐시 가능.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// SVG 등 스크립트를 담을 수 있는 형식은 이미지로 서빙하지 않는다 (data URL 그대로 둠)
const ALLOWED_MIME = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
};

function parseDataUrl(str) {
    if (typeof str !== 'string' || !str.startsWith('data:')) return null;
    const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(str);
    if (!m) return null;
    const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
    if (!ALLOWED_MIME[mime]) return null;
    return { mime, buffer: Buffer.from(m[2], 'base64') };
}

function imageUrl(postId, idx, buffer) {
    const v = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
    return `/api/posts/${encodeURIComponent(postId)}/images/${idx}?v=${v}`;
}

function hasInlineImages(post) {
    if (!post) return false;
    const urls = Array.isArray(post.imageUrls) ? post.imageUrls : [];
    return urls.some(u => parseDataUrl(u)) || !!parseDataUrl(post.imageUrl);
}

// post를 직접 수정한다. saveImage(idx, mime, buffer)는 저장소별 구현.
// imageUrls → 0..n-1, 예전 단일 imageUrl → n 번 슬롯
async function externalizeImages(postId, post, saveImage) {
    let changed = 0;
    const urls = Array.isArray(post.imageUrls) ? post.imageUrls : [];
    for (let i = 0; i < urls.length; i++) {
        const parsed = parseDataUrl(urls[i]);
        if (!parsed) continue;
        await saveImage(i, parsed.mime, parsed.buffer);
        urls[i] = imageUrl(postId, i, parsed.buffer);
        changed++;
    }
    const single = parseDataUrl(post.imageUrl);
    if (single) {
        const idx = urls.length;
        await saveImage(idx, single.mime, single.buffer);
        post.imageUrl = imageUrl(postId, idx, single.buffer);
        changed++;
    }
    return changed;
}

// ── Postgres 저장소 ──────────────────────────────────────────
async function initPgImages(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS post_images (
            post_id VARCHAR(255) NOT NULL,
            idx INTEGER NOT NULL,
            mime VARCHAR(50) NOT NULL,
            data BYTEA NOT NULL,
            PRIMARY KEY (post_id, idx)
        );
    `);
}

const pgSaver = (pool, postId) => (idx, mime, buffer) => pool.query(
    `INSERT INTO post_images (post_id, idx, mime, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_id, idx) DO UPDATE SET mime = $3, data = $4`,
    [postId, idx, mime, buffer]
);

async function pgGetImage(pool, postId, idx) {
    const r = await pool.query('SELECT mime, data FROM post_images WHERE post_id = $1 AND idx = $2', [postId, idx]);
    return r.rows[0] || null;
}

const pgDeleteImages = (pool, postId) => pool.query('DELETE FROM post_images WHERE post_id = $1', [postId]);

// 기존 포스트의 base64를 post_images로 옮기는 1회성(재실행 안전) 마이그레이션.
// 옮길 포스트가 있으면 먼저 posts 테이블 전체를 posts_backup_<YYYYMMDD> 테이블로 복사해 둔다.
async function migratePgImages(pool, log = console.log) {
    await initPgImages(pool);
    const ids = (await pool.query(
        "SELECT id FROM posts WHERE data::text LIKE '%data:image/%' ORDER BY id"
    )).rows.map(r => r.id);
    if (ids.length === 0) {
        log('[images] no inline images to migrate');
        return { migrated: 0, backupTable: null };
    }

    const backupTable = 'posts_backup_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await pool.query(`CREATE TABLE IF NOT EXISTS ${backupTable} AS TABLE posts WITH NO DATA`);
    const copied = await pool.query(
        `INSERT INTO ${backupTable} SELECT p.* FROM posts p
         WHERE NOT EXISTS (SELECT 1 FROM ${backupTable} b WHERE b.id = p.id)`
    );
    log(`[images] backup: ${copied.rowCount} rows copied into ${backupTable}`);

    let migrated = 0;
    for (const id of ids) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const row = (await client.query('SELECT data FROM posts WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!row || !hasInlineImages(row.data)) { await client.query('ROLLBACK'); continue; }
            const post = row.data;
            const n = await externalizeImages(id, post, pgSaver(client, id));
            await client.query('UPDATE posts SET data = $1 WHERE id = $2', [post, id]);
            await client.query('COMMIT');
            migrated++;
            log(`[images] ${id}: ${n} image(s) moved`);
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            log(`[images] ${id}: FAILED ${err.message}`);
        } finally {
            client.release();
        }
    }
    return { migrated, backupTable };
}

// ── 로컬 파일 저장소 (Postgres 없을 때) ───────────────────────
// 파일명은 postId 해시를 써서 경로 조작을 막는다
function localImagePath(dir, postId, idx, ext) {
    const key = crypto.createHash('sha1').update(String(postId)).digest('hex');
    return path.join(dir, `${key}_${idx}.${ext}`);
}

const localSaver = (dir, postId) => async (idx, mime, buffer) => {
    fs.mkdirSync(dir, { recursive: true });
    // 같은 슬롯의 다른 확장자 파일은 제거
    for (const ext of new Set(Object.values(ALLOWED_MIME))) {
        const p = localImagePath(dir, postId, idx, ext);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.writeFileSync(localImagePath(dir, postId, idx, ALLOWED_MIME[mime]), buffer);
};

function localGetImage(dir, postId, idx) {
    for (const [mime, ext] of Object.entries(ALLOWED_MIME)) {
        const p = localImagePath(dir, postId, idx, ext);
        if (fs.existsSync(p)) return { mime, data: fs.readFileSync(p) };
    }
    return null;
}

function localDeleteImages(dir, postId) {
    if (!fs.existsSync(dir)) return;
    const prefix = crypto.createHash('sha1').update(String(postId)).digest('hex') + '_';
    fs.readdirSync(dir).filter(f => f.startsWith(prefix)).forEach(f => fs.unlinkSync(path.join(dir, f)));
}

module.exports = {
    hasInlineImages, externalizeImages,
    initPgImages, pgSaver, pgGetImage, pgDeleteImages, migratePgImages,
    localSaver, localGetImage, localDeleteImages
};

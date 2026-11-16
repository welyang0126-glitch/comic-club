const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const images = require('./lib/images');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// ── 비밀번호 해싱 ─────────────────────────────────────────────
// 예전 평문 비밀번호는 로그인 성공 시 그 자리에서 bcrypt 해시로 교체한다 (재가입 불필요)
const BCRYPT_ROUNDS = 10;
const isHashed = v => typeof v === 'string' && /^\$2[aby]\$\d{2}\$/.test(v);
const hashPassword = pwd => bcrypt.hash(String(pwd), BCRYPT_ROUNDS);

// 응답으로 내보내는 유저 객체에서 비밀번호 필드 제거
function publicUser(user) {
    if (!user) return user;
    const { pwd, password, ...rest } = user;
    return rest;
}

// 검증 결과: { ok, upgradedHash } — upgradedHash가 있으면 호출부에서 저장
async function verifyPassword(user, password) {
    if (!user || typeof user.pwd !== 'string' || typeof password !== 'string') return { ok: false };
    if (isHashed(user.pwd)) return { ok: await bcrypt.compare(password, user.pwd) };
    if (user.pwd !== password) return { ok: false };
    return { ok: true, upgradedHash: await hashPassword(password) };
}

// Railway 등에서 제공되는 Postgres 접속 URL
const dbUrl = process.env.DATABASE_URL;

let pool = null;
if (dbUrl) {
    pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 3,
        idleTimeoutMillis: 30000
    });
    console.log("PostgreSQL database configured.");
} else {
    console.log("⚠️ DATABASE_URL 환경변수가 없습니다. (PostgreSQL 비활성화)");
    console.log("로컬 테스트를 하시려면 Railway의 DATABASE_URL을 로컬 환경변수에 추가하시기 바랍니다.");
}

// ── 데이터베이스 초기화 ────────────────────────────────────────
async function initDB() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                data JSONB NOT NULL
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id VARCHAR(255) PRIMARY KEY,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("PostgreSQL tables successfully initialized!");

        // 어드민 사용자 기본 생성
        const check = await pool.query("SELECT * FROM users WHERE id = 'kevin'");
        if (check.rows.length === 0) {
            const defaultUser = {
                id: 'kevin', pwd: await hashPassword('test'), name: 'Kevin', handle: '@Kevin',
                color: '#f4c542', initial: 'K', bio: 'Admin · Comic Club founder ⚡',
                followers: 530, hearts: 108, items: [], postIds: []
            };
            await pool.query("INSERT INTO users (id, data) VALUES ($1, $2)", ['kevin', defaultUser]);
            console.log("Default admin 'kevin' seeded into Postgres.");
        }

        // 기본 포스트 시드
        const checkPosts = await pool.query("SELECT * FROM posts WHERE id = 'post-1'");
        if (checkPosts.rows.length === 0) {
            const post1 = {
                id: 'post-1', title: 'Neon Drift, Part 14', authorId: 'glo_rich',
                desc: 'Finally finished the shading in the rain scene! This chapter took me forever 😭✨',
                baseLikes: 284, likes: {}, comments: []
            };
            const post2 = {
                id: 'post-2', title: 'Dragonstar', authorId: 'jen_borden',
                desc: 'Character concept art for the upcoming reboot.',
                baseLikes: 820, likes: {}, comments: []
            };
            await pool.query("INSERT INTO posts (id, data) VALUES ($1, $2)", ['post-1', post1]);
            await pool.query("INSERT INTO posts (id, data) VALUES ($1, $2)", ['post-2', post2]);
        }

        // 포스트 이미지 테이블 생성 + 기존 base64 이미지 이전 (백업 테이블 생성 후 진행, 재실행 안전)
        await images.migratePgImages(pool);
    } catch (err) {
        console.error("DB Initialization Error:", err);
    }
}
initDB();

// ── 로컬 파일 스토리지 (Postgres 없을 때 fallback) ──────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const readLocalJSON = (file, def) => {
    if (!fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(def)); return def; }
    try { return JSON.parse(fs.readFileSync(file)); } catch(e) { return def; }
};
const saveLocalJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data));

let localUsers = readLocalJSON(path.join(DATA_DIR, 'users.json'), {});
let localPosts = readLocalJSON(path.join(DATA_DIR, 'posts.json'), {});

// 로컬 모드 이미지 저장 폴더 + 기존 base64 이미지 이전
const IMAGES_DIR = path.join(DATA_DIR, 'images');
(async () => {
    if (pool) return;
    let migrated = 0;
    for (const [id, post] of Object.entries(localPosts)) {
        if (!images.hasInlineImages(post)) continue;
        await images.externalizeImages(id, post, images.localSaver(IMAGES_DIR, id));
        migrated++;
    }
    if (migrated) {
        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
        console.log(`[images] ${migrated} local post(s) migrated`);
    }
})().catch(err => console.error('[images] local migration failed', err));

// ── API 엔드포인트 ────────────────────────────────────────────

// Railway health check — 이 엔드포인트가 있어야 Railway가 서버 상태를 올바르게 감지함
app.get('/health', (req, res) => res.json({ status: 'ok', db: !!pool }));

app.post('/api/auth/login', async (req, res) => {
    try {
        const { id, password } = req.body;
        if (typeof id !== 'string' || typeof password !== 'string') {
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        const key = id.toLowerCase();

        if (pool) {
            const result = await pool.query('SELECT data FROM users WHERE id = $1', [key]);
            const user = result.rows.length > 0 ? result.rows[0].data : null;
            const { ok, upgradedHash } = await verifyPassword(user, password);
            if (!ok) return res.json({ success: false, message: 'Invalid credentials' });
            if (upgradedHash) {
                user.pwd = upgradedHash;
                await pool.query('UPDATE users SET data = $1 WHERE id = $2', [user, key]);
            }
            res.json({ success: true, user: publicUser(user) });
        } else {
            const user = localUsers[key];
            const { ok, upgradedHash } = await verifyPassword(user, password);
            if (!ok) return res.json({ success: false, message: 'Invalid credentials' });
            if (upgradedHash) {
                user.pwd = upgradedHash;
                saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
            }
            res.json({ success: true, user: publicUser(user) });
        }
    } catch (err) {
        console.error('POST /api/auth/login error:', err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    const { id, pwd, name } = req.body;
    if (typeof id !== 'string' || typeof pwd !== 'string' || typeof name !== 'string' || !id || !pwd || !name) {
        return res.json({ success: false, message: 'Missing fields' });
    }
    const key = id.toLowerCase();

    const newUser = {
        id, pwd: await hashPassword(pwd), name,
        handle: '@' + name,
        color: '#ffcc00',
        initial: name.charAt(0).toUpperCase(),
        bio: 'New Member',
        followers: 0,
        hearts: 108,
        items: [],
        postIds: []
    };

    if (pool) {
        const check = await pool.query('SELECT id FROM users WHERE id = $1', [key]);
        if (check.rows.length > 0) return res.json({ success: false, message: 'ID already exists' });
        await pool.query('INSERT INTO users (id, data) VALUES ($1, $2)', [key, newUser]);
        res.json({ success: true, user: publicUser(newUser) });
    } else {
        if (localUsers[key]) return res.json({ success: false, message: 'ID already exists' });
        localUsers[key] = newUser;
        saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        res.json({ success: true, user: publicUser(newUser) });
    }
});

// 비밀번호 변경 — 현재 비밀번호를 bcrypt로 검증한 뒤 새 해시 저장
const MIN_PASSWORD_LENGTH = 6;
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const { id, currentPassword, newPassword } = req.body || {};
        if (typeof id !== 'string' || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ success: false, message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
        }
        const key = id.toLowerCase();
        const user = pool
            ? (await pool.query('SELECT data FROM users WHERE id = $1', [key])).rows[0]?.data
            : localUsers[key];
        const { ok } = await verifyPassword(user, currentPassword);
        if (!ok) return res.status(403).json({ success: false, message: 'Current password is incorrect.' });

        user.pwd = await hashPassword(newPassword);
        if (pool) await pool.query('UPDATE users SET data = $1 WHERE id = $2', [user, key]);
        else saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/auth/change-password error:', err);
        res.status(500).json({ success: false, message: 'Could not change password.' });
    }
});

app.get('/api/auth/check', async (req, res) => {
    const id = (req.query.id || '').toLowerCase();
    if (!id) return res.json({ exists: false });

    if (pool) {
        const check = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
        res.json({ exists: check.rows.length > 0 });
    } else {
        res.json({ exists: !!localUsers[id] });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = {};
        if (pool) {
            const result = await pool.query('SELECT id, data FROM users');
            result.rows.forEach(r => {
                const d = r.data;
                users[r.id] = {
                    id: r.id,
                    name: d.name || r.id,
                    handle: d.handle || '@' + r.id,
                    color: d.color || '#f5d000',
                    initial: d.initial || (d.name || r.id).charAt(0).toUpperCase(),
                    bio: d.bio || '',
                    followers: d.followers || 0,
                    hearts: d.hearts || 0,
                    postIds: d.postIds || []
                };
            });
        } else {
            Object.entries(localUsers).forEach(([id, d]) => {
                users[id] = {
                    id, name: d.name || id, handle: d.handle || '@' + id,
                    color: d.color || '#f5d000',
                    initial: d.initial || (d.name || id).charAt(0).toUpperCase(),
                    bio: d.bio || '', followers: d.followers || 0,
                    hearts: d.hearts || 0, postIds: d.postIds || []
                };
            });
        }
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 커서 기반 페이지네이션
//   ?limit=10            → 최신 10개 + nextCursor (limit 생략 시 전체 반환 — Popular 탭용)
//   ?before=<nextCursor> → 해당 커서 이후(더 오래된) 포스트
//   ?author=<userId>     → 특정 작가 포스트만
// 커서는 불투명 문자열: Postgres는 "created_at|id"(마이크로초까지 보존, 동시각 tie-break), 로컬은 post id
app.get('/api/posts', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 50);
        const before = req.query.before ? String(req.query.before) : null;
        const author = req.query.author ? String(req.query.author).toLowerCase() : null;

        let posts = [];
        let nextCursor = null;
        if (pool) {
            // created_at이 NULL인 예전 행도 빠지지 않도록 epoch로 취급 (정렬·커서·비교 모두 같은 식 사용)
            const TS = "COALESCE(created_at, 'epoch'::timestamp)";
            const where = [];
            const params = [];
            if (author) {
                params.push(author);
                where.push(`LOWER(data->>'authorId') = $${params.length}`);
            }
            if (before) {
                const sep = before.indexOf('|');
                if (sep > 0) {
                    params.push(before.slice(0, sep), before.slice(sep + 1));
                    where.push(`(${TS}, id) < ($${params.length - 1}::timestamp, $${params.length})`);
                }
            }
            let query = `SELECT id, data, created_at, ${TS}::text AS cursor_ts FROM posts`;
            if (where.length) query += ' WHERE ' + where.join(' AND ');
            query += ` ORDER BY ${TS} DESC, id DESC`;
            if (limit) {
                params.push(limit + 1); // 1개 더 조회해서 다음 페이지 존재 여부 판단
                query += ` LIMIT $${params.length}`;
            }
            const result = await pool.query(query, params);
            let rows = result.rows;
            if (limit && rows.length > limit) {
                rows = rows.slice(0, limit);
                const last = rows[rows.length - 1];
                nextCursor = `${last.cursor_ts}|${last.id}`;
            }
            posts = rows.map(r => ({ ...r.data, id: r.id, created_at: r.created_at }));
        } else {
            // 로컬 JSON은 삽입 순서 = 오래된 순이므로 뒤집어서 최신순으로
            let list = Object.values(localPosts).reverse();
            if (author) list = list.filter(p => (p.authorId || '').toLowerCase() === author);
            if (before) {
                const idx = list.findIndex(p => p.id === before);
                if (idx >= 0) list = list.slice(idx + 1);
            }
            if (limit && list.length > limit) {
                list = list.slice(0, limit);
                nextCursor = list[list.length - 1].id;
            }
            posts = list;
        }
        res.json({ success: true, posts, nextCursor });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const body = req.body;
        const authorKey = (body.authorId || body.uid || '').toLowerCase();

        // 게스트(미가입) 작성자 차단 — 클라이언트 UI는 이미 막고 있지만, API를 직접
        // 호출하는 경우를 대비한 서버 측 방어
        if (!authorKey || authorKey === 'guest' || authorKey === '@guest') {
            return res.status(403).json({ success: false, error: 'Guests cannot post. Please sign in.' });
        }
        if (pool) {
            const authorCheck = await pool.query('SELECT id FROM users WHERE id = $1', [authorKey]);
            if (authorCheck.rows.length === 0) {
                return res.status(403).json({ success: false, error: 'User not found' });
            }
        } else if (!localUsers[authorKey]) {
            return res.status(403).json({ success: false, error: 'User not found' });
        }

        const newPostId = body.id || ('post-' + Date.now());
        const postData = {
            ...body,
            id: newPostId,
            authorId: authorKey,
            time: body.time || 'Just now',
            createdAt: body.createdAt || new Date().toISOString(),
            baseLikes: body.baseLikes || 0,
            likes: body.likes || {},
            comments: body.comments || []
        };

        // base64 이미지는 별도 저장하고 포스트에는 URL만 남긴다
        await images.externalizeImages(newPostId, postData,
            pool ? images.pgSaver(pool, newPostId) : images.localSaver(IMAGES_DIR, newPostId));

        if (pool) {
            await pool.query(
                'INSERT INTO posts (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
                [newPostId, postData]
            );
            const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [authorKey]);
            if (userRes.rows.length > 0) {
                const userData = userRes.rows[0].data;
                if (!userData.postIds) userData.postIds = [];
                if (!userData.postIds.includes(newPostId)) userData.postIds.unshift(newPostId);
                await pool.query('UPDATE users SET data = $1 WHERE id = $2', [userData, authorKey]);
            }
        } else {
            localPosts[newPostId] = postData;
            saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
            if (localUsers[authorKey]) {
                if (!localUsers[authorKey].postIds) localUsers[authorKey].postIds = [];
                localUsers[authorKey].postIds.unshift(newPostId);
                saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
            }
        }
        res.json({ success: true, post: postData });
    } catch (err) {
        console.error('POST /api/posts error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 포스트 이미지 바이너리 — URL에 내용 해시(?v=)가 붙어 있어 1년 캐시
app.get('/api/posts/:id/images/:n', async (req, res) => {
    try {
        const idx = Number(req.params.n);
        if (!Number.isInteger(idx) || idx < 0) return res.status(404).end();
        const img = pool
            ? await images.pgGetImage(pool, req.params.id, idx)
            : images.localGetImage(IMAGES_DIR, req.params.id, idx);
        if (!img) return res.status(404).end();
        res.set('Cache-Control', 'public, max-age=31536000');
        res.set('X-Content-Type-Options', 'nosniff');
        res.type(img.mime).send(Buffer.from(img.data));
    } catch (err) {
        console.error('GET image error:', err);
        res.status(500).end();
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    const postId = req.params.id;
    const userId = req.body.uid || req.body.userId;

    if (pool) {
        const postRes = await pool.query('SELECT data FROM posts WHERE id = $1', [postId]);
        if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        const post = postRes.rows[0].data;
        const wasLiked = !!post.likes[userId];
        if (wasLiked) delete post.likes[userId];
        else post.likes[userId] = true;
        await pool.query('UPDATE posts SET data = $1 WHERE id = $2', [post, postId]);

        // 자기 자신 게시글은 하트 집계 제외
        const authorId = (post.authorId || '').toLowerCase();
        if (authorId && authorId !== userId.toLowerCase()) {
            const authorRes = await pool.query('SELECT data FROM users WHERE id = $1', [authorId]);
            if (authorRes.rows.length > 0) {
                const author = authorRes.rows[0].data;
                author.hearts = (author.hearts || 0) + (wasLiked ? -1 : 1);
                if (author.hearts < 0) author.hearts = 0;
                await pool.query('UPDATE users SET data = $1 WHERE id = $2', [author, authorId]);
            }
        }

        res.json({ success: true, post });
    } else {
        const post = localPosts[postId];
        if (!post) return res.status(404).json({ error: 'Post not found' });
        const wasLiked = !!post.likes[userId];
        if (wasLiked) delete post.likes[userId];
        else post.likes[userId] = true;

        const authorId = (post.authorId || '').toLowerCase();
        if (authorId && authorId !== userId.toLowerCase() && localUsers[authorId]) {
            localUsers[authorId].hearts = (localUsers[authorId].hearts || 0) + (wasLiked ? -1 : 1);
            if (localUsers[authorId].hearts < 0) localUsers[authorId].hearts = 0;
            saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        }

        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
        res.json({ success: true, post });
    }
});

app.post('/api/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;
    const { userId, text } = req.body;
    const userKey = userId.toLowerCase();

    let user, post;
    if (pool) {
        const postRes = await pool.query('SELECT data FROM posts WHERE id = $1', [postId]);
        if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        post = postRes.rows[0].data;
        const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [userKey]);
        user = userRes.rows.length > 0 ? userRes.rows[0].data : null;
    } else {
        post = localPosts[postId];
        if (!post) return res.status(404).json({ error: 'Post not found' });
        user = localUsers[userKey];
    }

    const handle = user ? user.handle : '@' + userId;
    const color = user ? user.color : '#f4c542';

    post.comments.push({
        id: 'u_' + Date.now(),
        author: handle,
        text,
        time: 'Just now',
        color: color,
        avatar: user ? user.avatar : null
    });

    if (pool) {
        await pool.query('UPDATE posts SET data = $1 WHERE id = $2', [post, postId]);
    } else {
        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
    }
    res.json({ success: true, comments: post.comments });
});

app.delete('/api/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const userId = (req.query.userId || '').toLowerCase();

    if (pool) {
        const postRes = await pool.query('SELECT data FROM posts WHERE id = $1', [postId]);
        if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

        const post = postRes.rows[0].data;
        if (post.authorId.toLowerCase() !== userId) return res.status(403).json({ error: 'Unauthorized to delete this post' });

        await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
        await images.pgDeleteImages(pool, postId);

        const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length > 0) {
            const userData = userRes.rows[0].data;
            userData.postIds = userData.postIds.filter(id => id !== postId);
            await pool.query('UPDATE users SET data = $1 WHERE id = $2', [userData, userId]);
        }
        res.json({ success: true });
    } else {
        const post = localPosts[postId];
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.authorId.toLowerCase() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        delete localPosts[postId];
        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
        images.localDeleteImages(IMAGES_DIR, postId);

        if (localUsers[userId]) {
            localUsers[userId].postIds = localUsers[userId].postIds.filter(id => id !== postId);
            saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        }
        res.json({ success: true });
    }
});

app.post('/api/users/:id/update', async (req, res) => {
    const key = req.params.id.toLowerCase();
    // 이 엔드포인트로는 비밀번호·id를 바꿀 수 없다 (인증 없는 경로로 계정 탈취 방지)
    const { pwd, password, id, ...changes } = req.body || {};
    if (pool) {
        const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [key]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const updated = { ...userRes.rows[0].data, ...changes };
        await pool.query('UPDATE users SET data = $1 WHERE id = $2', [updated, key]);
        res.json({ success: true, user: publicUser(updated) });
    } else {
        if (!localUsers[key]) return res.status(404).json({ error: 'User not found' });
        localUsers[key] = { ...localUsers[key], ...changes };
        saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        res.json({ success: true, user: publicUser(localUsers[key]) });
    }
});

// 프론트엔드 정적 파일 서빙 — public/ 만 공개 (server.js, data/, package.json 등 노출 방지)
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database connected? ${!!pool}`);
});

// Railway SIGTERM 수신 시 graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
        if (pool) await pool.end();
        process.exit(0);
    });
});

// 기존 포스트의 base64 이미지를 post_images 테이블로 옮기는 1회성 마이그레이션
//   사용법: DATABASE_URL=postgres://... node scripts/migrate-images.js
// 1) posts 테이블 전체를 backups/posts-<timestamp>.json 파일로 백업
// 2) migratePgImages: posts_backup_<YYYYMMDD> 테이블에 DB 내부 백업 후 이전 (재실행 안전)
// 서버도 시작할 때 같은 마이그레이션을 실행하므로, 이 스크립트는 수동 실행·검증용이다.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const images = require('../lib/images');

(async () => {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL 환경변수가 필요합니다.');
        process.exit(1);
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
    try {
        const rows = (await pool.query('SELECT id, data, created_at FROM posts ORDER BY created_at')).rows;
        const dir = path.join(__dirname, '..', 'backups');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `posts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(file, JSON.stringify(rows));
        console.log(`backup: ${rows.length} posts → ${file}`);

        const result = await images.migratePgImages(pool);
        console.log('done:', result);
    } finally {
        await pool.end();
    }
})().catch(err => { console.error(err); process.exit(1); });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Railway 등에서 제공되는 Postgres 접속 URL
const dbUrl = process.env.DATABASE_URL;

let pool = null;
if (dbUrl) {
    pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // 클라우드 DB 연결용
    });
    console.log("PostgreSQL database configured.");
} else {
    // 로컬 환경을 위한 안내
    console.log("⚠️ DATABASE_URL 환경변수가 없습니다. (PostgreSQL 비활성화)");
    console.log("로컬 테스트를 하시려면 Railway의 DATABASE_URL을 로컬 환경변수에 추가하시기 바랍니다.");
}

// ── 데이터베이스 초기화 (테이블 생성 등) ──────────────────────
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS images (
                id VARCHAR(255) PRIMARY KEY,
                data BYTEA NOT NULL,
                mimetype VARCHAR(100) NOT NULL
            );
        `);
        console.log("PostgreSQL tables successfully initialized!");

        // 어드민 사용자 기본 생성 로직
        const check = await pool.query("SELECT * FROM users WHERE id = 'kevin'");
        if (check.rows.length === 0) {
            const defaultUser = {
                id: 'kevin', pwd: 'test', name: 'Kevin', handle: '@Kevin',
                color: '#f4c542', initial: 'K', bio: 'Admin · Comic Club founder ⚡',
                followers: 530, hearts: 108, items: [], postIds: []
            };
            await pool.query("INSERT INTO users (id, data) VALUES ($1, $2)", ['kevin', defaultUser]);
            console.log("Default admin 'kevin' seeded into Postgres.");
        }
    } catch (err) {
        console.error("DB Initialization Error:", err);
    }
}
initDB();

// ── 로컬 파일 스토리지 (Fallback 구현체) ─────────────────────
// Postgres 연결이 불가능할 경우 기존처럼 파일 캐싱을 위해 남겨둠.
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

const readLocalJSON = (file, def) => {
    if (!fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(def)); return def; }
    try { return JSON.parse(fs.readFileSync(file)); } catch(e) { return def; }
};
const saveLocalJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data));

let localUsers = readLocalJSON(path.join(DATA_DIR, 'users.json'), {});
let localPosts = readLocalJSON(path.join(DATA_DIR, 'posts.json'), {});

// ── 이미지 업로드 설정 ─────────────────────────────────────
// 메모리 스토리지: DB 저장을 위해 파일 데이터를 메모리에 버퍼로 보관
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 이미지 제공 API (PostgreSQL 전용)
app.get('/api/images/:id', async (req, res) => {
    if (!pool) return res.status(404).send("DB not configured");
    try {
        const result = await pool.query('SELECT data, mimetype FROM images WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Not found');
        
        res.setHeader('Content-Type', result.rows[0].mimetype);
        res.send(result.rows[0].data);
    } catch(e) {
        console.error(e);
        res.status(500).send("Error reading image from Postgres");
    }
});


// ── API 엔드포인트 ────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
    const { id, password } = req.body;
    const key = id.toLowerCase();
    
    if (pool) {
        const result = await pool.query('SELECT data FROM users WHERE id = $1', [key]);
        if (result.rows.length > 0) {
            const user = result.rows[0].data;
            if (user.pwd === password) return res.json({ success: true, user });
        }
        res.json({ success: false, message: 'Invalid credentials' });
    } else {
        const user = localUsers[key];
        if (user && user.pwd === password) res.json({ success: true, user });
        else res.json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    const { id, pwd, name } = req.body;
    const key = id.toLowerCase();
    
    const newUser = {
        id, pwd, name,
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
        res.json({ success: true, user: newUser });
    } else {
        if (localUsers[key]) return res.json({ success: false, message: 'ID already exists' });
        localUsers[key] = newUser;
        saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        res.json({ success: true, user: newUser });
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
    if (pool) {
        const result = await pool.query('SELECT id, data FROM users');
        const usersObj = {};
        result.rows.forEach(r => usersObj[r.id] = r.data);
        res.json(usersObj);
    } else {
        res.json(localUsers);
    }
});

app.get('/api/posts', async (req, res) => {
    if (pool) {
        // created_at 기준으로 최신 글순 정렬
        const result = await pool.query('SELECT id, data FROM posts ORDER BY created_at DESC');
        const postsObj = {};
        result.rows.forEach(r => postsObj[r.id] = r.data);
        res.json(postsObj);
    } else {
        res.json(localPosts);
    }
});

app.post('/api/posts', upload.array('images', 20), async (req, res) => {
    const { title, desc, authorId } = req.body;
    const authorKey = authorId.toLowerCase();
    const imageUrls = [];

    if (pool) {
        for (const file of req.files) {
            const imageId = 'img-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
            await pool.query('INSERT INTO images (id, data, mimetype) VALUES ($1, $2, $3)', [imageId, file.buffer, file.mimetype]);
            imageUrls.push(`/api/images/${imageId}`);
        }
    } else {
        // 로컬에서는 기존 파일 시스템 폴더에 저장 (Fallback)
        for (const file of req.files) {
            const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
            fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);
            imageUrls.push(`/uploads/${filename}`);
        }
    }
    
    const newPostId = 'post-' + Date.now();
    const post = {
        id: newPostId,
        title,
        authorId: authorKey,
        imageClass: 'custom-upload',
        imageUrl: imageUrls[0], 
        imageUrls: imageUrls,   
        label: '🌟 NEW POST',
        scene: 'A new adventure begins...',
        desc: desc || 'No description provided.',
        time: 'Just now',
        baseLikes: 0,
        likes: {},
        comments: []
    };
    
    if (pool) {
        await pool.query('INSERT INTO posts (id, data) VALUES ($1, $2)', [newPostId, post]);
        const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [authorKey]);
        if (userRes.rows.length > 0) {
            const userData = userRes.rows[0].data;
            userData.postIds.unshift(newPostId);
            await pool.query('UPDATE users SET data = $1 WHERE id = $2', [userData, authorKey]);
        }
    } else {
        localPosts[newPostId] = post;
        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
        if (localUsers[authorKey]) {
            localUsers[authorKey].postIds.unshift(newPostId);
            saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        }
    }

    res.json({ success: true, post });
});

app.post('/api/posts/:id/like', async (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body;
    
    if (pool) {
        const postRes = await pool.query('SELECT data FROM posts WHERE id = $1', [postId]);
        if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        const post = postRes.rows[0].data;
        if (post.likes[userId]) delete post.likes[userId];
        else post.likes[userId] = true;
        await pool.query('UPDATE posts SET data = $1 WHERE id = $2', [post, postId]);
        res.json({ success: true, post });
    } else {
        const post = localPosts[postId];
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.likes[userId]) delete post.likes[userId];
        else post.likes[userId] = true;
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
        color: color
    });

    if (pool) {
        await pool.query('UPDATE posts SET data = $1 WHERE id = $2', [post, postId]);
    } else {
        saveLocalJSON(path.join(DATA_DIR, 'posts.json'), localPosts);
    }
    res.json({ success: true, comments: post.comments });
});

app.post('/api/users/:id/update', async (req, res) => {
    const key = req.params.id.toLowerCase();
    if (pool) {
        const userRes = await pool.query('SELECT data FROM users WHERE id = $1', [key]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const updated = { ...userRes.rows[0].data, ...req.body };
        await pool.query('UPDATE users SET data = $1 WHERE id = $2', [updated, key]);
        res.json({ success: true, user: updated });
    } else {
        if (!localUsers[key]) return res.status(404).json({ error: 'User not found' });
        localUsers[key] = { ...localUsers[key], ...req.body };
        saveLocalJSON(path.join(DATA_DIR, 'users.json'), localUsers);
        res.json({ success: true, user: localUsers[key] });
    }
});

// 프론트엔드 정적 파일 서빙
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database connected? ${!!pool}`);
});

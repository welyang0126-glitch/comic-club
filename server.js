const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 로컬 환경 또는 Railway Volume 마운트 경로
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 업로드 폴더 (정적 서빙)
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// DB 파일
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

// 기본 데이터
const DEFAULT_USERS = {
    'kevin': {
        id: 'kevin', pwd: 'test', name: 'Kevin', handle: '@Kevin',
        color: '#f4c542', initial: 'K', bio: 'Admin · Comic Club founder ⚡',
        followers: 530, hearts: 108, items: [], postIds: []
    }
};

const DEFAULT_POSTS = {
    'post-1': {
        title: 'Neon Drift, Part 14', authorId: 'glorich', imageClass: 'neon',
        label: '🌆 NEON CITY', scene: 'A lone figure walks through rain-soaked streets...',
        desc: 'Finally finished the rain scene! This chapter took me forever 😭✨', time: '2h ago',
        baseLikes: 284, likes: {},
        comments: [
            { id: 'c1', author: '@GloRich_', text: 'Finally done! This took so long 😭', time: '1h ago', color: '#6a0dad' },
            { id: 'c2', author: '@Alex', text: 'The rain scene looks amazing ✨', time: '45m ago', color: '#e07bbd' }
        ]
    }
};

// JSON 읽기/쓰기 유틸리티
const readJSON = (file, defaultData) => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        return defaultData;
    }
};

const writeJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

let usersDb = readJSON(USERS_FILE, DEFAULT_USERS);
let postsDb = readJSON(POSTS_FILE, DEFAULT_POSTS);

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// API: 로그인
app.post('/api/auth/login', (req, res) => {
    const { id, password } = req.body;
    const user = usersDb[id.toLowerCase()];
    if (user && user.pwd === password) {
        res.json({ success: true, user });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

// API: 회원가입
app.post('/api/auth/signup', (req, res) => {
    const { id, pwd, name } = req.body;
    const key = id.toLowerCase();
    if (usersDb[key]) {
        return res.json({ success: false, message: 'ID already exists' });
    }
    usersDb[key] = {
        id, pwd, name,
        handle: '@' + name,
        color: '#ffcc00',
        initial: name.charAt(0).toUpperCase(),
        bio: 'New Member',
        followers: 0,
        hearts: 108, // 가입 시 기본 하트
        items: [],
        postIds: []
    };
    writeJSON(USERS_FILE, usersDb);
    res.json({ success: true, user: usersDb[key] });
});

// API: 아이디 중복 확인
app.get('/api/auth/check', (req, res) => {
    const id = req.query.id;
    if (!id) return res.json({ exists: false });
    res.json({ exists: !!usersDb[id.toLowerCase()] });
});

// API: 모든 유저 정보 조회
app.get('/api/users', (req, res) => {
    res.json(usersDb);
});

// API: 모든 포스트 조회
app.get('/api/posts', (req, res) => {
    // 최신순으로 정렬 (Object.values 그대로 반환)
    res.json(postsDb);
});

app.get('/api/posts/:id', (req, res) => {
    const post = postsDb[req.params.id];
    if (post) res.json(post);
    else res.status(404).json({error: 'Not found'});
});

// API: 이미지 업로드 후 포스트 작성
app.post('/api/posts', upload.array('images', 20), (req, res) => {
    const { title, desc, authorId } = req.body;
    
    // 업로드된 파일들의 경로를 URL로 변환
    const imageUrls = req.files.map(f => `/uploads/${f.filename}`);
    const newPostId = 'post-' + Date.now();
    
    postsDb[newPostId] = {
        id: newPostId,
        title,
        authorId: authorId.toLowerCase(),
        imageClass: 'custom-upload',
        imageUrl: imageUrls[0], // 썸네일용
        imageUrls: imageUrls,   // 웹툰 뷰어용 전체
        label: '🌟 NEW POST',
        scene: 'A new adventure begins...',
        desc: desc || 'No description provided.',
        time: 'Just now',
        baseLikes: 0,
        likes: {},
        comments: []
    };
    writeJSON(POSTS_FILE, postsDb);

    if (usersDb[authorId.toLowerCase()]) {
        usersDb[authorId.toLowerCase()].postIds.unshift(newPostId);
        writeJSON(USERS_FILE, usersDb);
    }

    res.json({ success: true, post: postsDb[newPostId] });
});

// API: 좋아요 토글
app.post('/api/posts/:id/like', (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body;
    if (!postsDb[postId]) return res.status(404).json({ error: 'Post not found' });

    const post = postsDb[postId];
    if (post.likes[userId]) {
        delete post.likes[userId];
    } else {
        post.likes[userId] = true;
    }
    writeJSON(POSTS_FILE, postsDb);
    res.json({ success: true, post });
});

// API: 댓글 작성
app.post('/api/posts/:id/comments', (req, res) => {
    const postId = req.params.id;
    const { userId, text } = req.body;
    if (!postsDb[postId]) return res.status(404).json({ error: 'Post not found' });

    const user = usersDb[userId.toLowerCase()];
    const handle = user ? user.handle : '@' + userId;
    const color = user ? user.color : '#f4c542';

    postsDb[postId].comments.push({
        id: 'u_' + Date.now(),
        author: handle,
        text,
        time: 'Just now',
        color: color
    });
    writeJSON(POSTS_FILE, postsDb);
    res.json({ success: true, comments: postsDb[postId].comments });
});

// API: 사용자 정보 갱신 (하트 소진 등)
app.post('/api/users/:id/update', (req, res) => {
    const key = req.params.id.toLowerCase();
    if (!usersDb[key]) return res.status(404).json({ error: 'User not found' });

    // body 업데이트 병합
    usersDb[key] = { ...usersDb[key], ...req.body };
    writeJSON(USERS_FILE, usersDb);
    res.json({ success: true, user: usersDb[key] });
});

// 프론트엔드 정적 파일 서빙
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});

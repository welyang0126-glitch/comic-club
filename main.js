const initApp = () => {
    // --- 🎵 귀여운 반응형 소리 (Web Audio API) ---
    let audioCtx;
    function playCuteSound() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // 초등학생이 좋아할 만한 귀여운 '뽁!' 소리
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    // --- 💖 사랑스러운 효과음 (하트, 댓글용) ---
    function playLovelySound() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const t = audioCtx.currentTime;

        // 첫 번째 음
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, t); // A5 노트
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(t);
        osc1.stop(t + 0.2);

        // 두 번째 음 (반짝이는 산뜻한 높은 음)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, t + 0.1); // E6 노트
        gain2.gain.setValueAtTime(0, t + 0.1);
        gain2.gain.linearRampToValueAtTime(0.2, t + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(t + 0.1);
        osc2.stop(t + 0.3);
    }

    // 클릭 가능한 모든 요소에 소리 효과 일괄 적용
    document.addEventListener('click', (e) => {
        // 하트 누를 때와 댓글 관련 액션인지 확인
        const isLovelyAction = e.target.closest('.like-btn') ||
            e.target.closest('.comment-submit') ||
            e.target.closest('.comment-toggle-btn');

        const isClickable = e.target.closest('button') ||
            e.target.closest('.nav-item') ||
            e.target.closest('.pf-option') ||
            e.target.closest('.story-item') ||
            e.target.closest('.post-user') ||
            e.target.closest('a') ||
            e.target.closest('#drop-zone');

        if (isLovelyAction) {
            playLovelySound();
        } else if (isClickable) {
            playCuteSound();
        }
    });

    const startBtn = document.getElementById('start-btn');
    const loginModal = document.getElementById('login-modal');
    const closeModal = document.getElementById('close-modal');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');

    // 모달 열기
    startBtn.addEventListener('click', () => {
        loginModal.classList.remove('hidden');
        setTimeout(() => { emailInput.focus(); }, 100);
    });

    closeModal.addEventListener('click', () => loginModal.classList.add('hidden'));

    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.classList.add('hidden');
    });

    // ── 연동 데이터 전역 변수 ──────────────────────────────
    let USERS_DATA = {};
    let POSTS_CONTENT = {};
    let USERS_DB = {}; 

    // ── 오프라인 fallback 데이터 ───────────────────────────
    const FALLBACK_USERS = {
        'kevin': { name: 'Kevin', handle: '@Kevin', color: '#f4c542', initial: 'K', bio: 'Admin · Comic Club founder ⚡', followers: 530, postIds: ['kv-1'] },
        'alex':  { name: 'Alex',  handle: '@Alex',  color: '#e07bbd', initial: 'A', bio: 'Aspiring comic writer 🎨',      followers: 320, postIds: [] },
        'juno':  { name: 'Juno',  handle: '@Juno',  color: '#7bc8e0', initial: 'J', bio: 'Manga fan & aspiring artist',   followers: 180, postIds: [] },
        'sam':   { name: 'Sam',   handle: '@Sam',   color: '#a0e07b', initial: 'S', bio: 'Comic collector & critic',      followers: 240, postIds: [] },
        'rita':  { name: 'Rita',  handle: '@Rita',  color: '#e07b7b', initial: 'R', bio: 'Webtoon enthusiast 🌸',         followers: 160, postIds: [] },
    };

    const FALLBACK_POSTS = {
        'kv-1': { title: 'Comic Club Weekly Spotlight ⚡', authorId: 'kevin', imageClass: 'kevin-gold', label: '⚡ COMIC CLUB WEEKLY', scene: "This week's top picks — curated by the admin!", desc: 'Welcome to Comic Club! Upload your comics and share with the community 🎉', time: '1h ago', baseLikes: 0, likes: {}, comments: [] },
    };

    // ── 삭제된 포스트 localStorage 영속화 ─────────────────
    function getDeletedPosts() {
        try { return new Set(JSON.parse(localStorage.getItem('comicclub_deleted_posts') || '[]')); }
        catch { return new Set(); }
    }
    function persistDeletedPost(postId) {
        const deleted = getDeletedPosts();
        deleted.add(postId);
        localStorage.setItem('comicclub_deleted_posts', JSON.stringify([...deleted]));
    }

    // ── 로컬 업로드 포스트 localStorage 영속화 ────────────
    function getLocalPosts() {
        try { return JSON.parse(localStorage.getItem('comicclub_local_posts') || '[]'); }
        catch { return []; }
    }
    function saveLocalPost(post) {
        const posts = getLocalPosts().filter(p => p.id !== post.id);
        posts.unshift(post);
        localStorage.setItem('comicclub_local_posts', JSON.stringify(posts));
    }

    // ── localStorage 버전 체크: 구버전 캐시 강제 초기화 ──────
    const DB_VERSION = '3';
    if (localStorage.getItem('comicclub_version') !== DB_VERSION) {
        localStorage.removeItem('comicclub_deleted_posts');
        localStorage.setItem('comicclub_version', DB_VERSION);
    }

    async function loadBackendData() {
        try {
            const [usersRes, postsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/posts')
            ]);
            if (!usersRes.ok || !postsRes.ok) throw new Error('API error');
            USERS_DATA = await usersRes.json();
            USERS_DB = USERS_DATA;
            POSTS_CONTENT = await postsRes.json();
        } catch(e) {
            // 백엔드 없을 때 fallback 데이터 사용
            console.warn('백엔드 없음 → 오프라인 데이터 사용');
            USERS_DATA = FALLBACK_USERS;
            USERS_DB   = FALLBACK_USERS;
            POSTS_CONTENT = FALLBACK_POSTS;
        }

        // localStorage에 저장된 로컬 업로드 포스트 병합
        getLocalPosts().forEach(post => {
            POSTS_CONTENT[post.id] = post;
            const ukey = post.authorId.toLowerCase();
            if (USERS_DATA[ukey] && !USERS_DATA[ukey].postIds.includes(post.id)) {
                USERS_DATA[ukey].postIds.unshift(post.id);
            }
        });

        // 삭제된 포스트 필터링 — POSTS_CONTENT에서 제거
        getDeletedPosts().forEach(postId => {
            delete POSTS_CONTENT[postId];
            document.querySelectorAll(`.feed-post[data-post-id="${postId}"]`).forEach(el => el.remove());
        });

        // 모든 포스트를 피드에 동적 주입 (최신 업로드가 위에 오도록 reverse)
        const feedBody = document.querySelector('.feed-body');
        const allPostIds = Object.keys(POSTS_CONTENT).reverse();
        if (feedBody && allPostIds.length > 0) {
            const storyContainer = feedBody.querySelector('.story-container');
            if (storyContainer) {
                const htmls = allPostIds.map(buildPostCardHTML).filter(Boolean);
                storyContainer.insertAdjacentHTML('afterend', htmls.join(''));
            }
        }

        initFeed();
    }

    function getLikeCount(postId, currentUser) {
        if (!POSTS_CONTENT[postId]) return 0;
        return POSTS_CONTENT[postId].baseLikes + Object.keys(POSTS_CONTENT[postId].likes).length;
    }

    function isLiked(postId, currentUser) {
        if (!POSTS_CONTENT[postId]) return false;
        return !!POSTS_CONTENT[postId].likes[currentUser];
    }

    async function toggleLike(postId, currentUser) {
        if (!POSTS_CONTENT[postId]) return false;
        // Optimistic UI 반영
        const currentlyLiked = !!POSTS_CONTENT[postId].likes[currentUser];
        if (currentlyLiked) delete POSTS_CONTENT[postId].likes[currentUser];
        else POSTS_CONTENT[postId].likes[currentUser] = true;

        try {
            await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser })
            });
        } catch(e) { console.error('좋아요 실패', e); }
        
        return !currentlyLiked;
    }

    function getAllComments(postId) {
        if (!POSTS_CONTENT[postId]) return [];
        return POSTS_CONTENT[postId].comments || [];
    }

    async function addComment(postId, currentUser, text) {
        if (!POSTS_CONTENT[postId]) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser, text })
            });
            const data = await res.json();
            if (data.success) {
                POSTS_CONTENT[postId].comments = data.comments;
            }
        } catch(e) { console.error('댓글 작성 실패', e); }
    }

    // ── 피드 렌더 함수 ─────────────────────────────────
    function renderFeedPost(postId) {
        const currentUser = loggedInUser || 'Guest';

        // 본인 포스트에 삭제 버튼 동적 주입 (정적 HTML 카드 포함)
        const postCard = document.querySelector(`.feed-post[data-post-id="${postId}"]`);
        if (postCard && POSTS_CONTENT[postId]) {
            const content = POSTS_CONTENT[postId];
            const isOwn = currentUser !== 'Guest' && currentUser.toLowerCase() === content.authorId.toLowerCase();
            let delBtn = postCard.querySelector('.delete-post-btn');
            if (isOwn && !delBtn) {
                const postUserEl = postCard.querySelector('.post-user');
                if (postUserEl) {
                    postUserEl.insertAdjacentHTML('beforeend',
                        `<button class="delete-post-btn" data-post-id="${postId}"
                            style="margin-left:auto;background:none;border:none;color:#bbb;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;"
                            title="Delete post">🗑</button>`
                    );
                }
            } else if (delBtn) {
                delBtn.style.display = isOwn ? '' : 'none';
            }
        }

        // 좋아요 버튼
        const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
        const likeCount = likeBtn?.querySelector('.like-count');
        if (likeBtn && likeCount) {
            const liked = isLiked(postId, currentUser);
            likeCount.textContent = getLikeCount(postId, currentUser);
            likeBtn.querySelector('.like-icon').textContent = liked ? '❤️' : '🤍';
            likeBtn.classList.toggle('liked', liked);
        }

        // 댓글 수
        const commentToggle = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
        if (commentToggle) {
            commentToggle.querySelector('.comment-count').textContent = getAllComments(postId).length;
        }
    }

    function renderCommentList(postId) {
        const list = document.getElementById(`comment-list-${postId}`);
        if (!list) return;
        const comments = getAllComments(postId);
        if (comments.length === 0) {
            list.innerHTML = '<p class="comment-empty">No comments yet. Be the first!</p>';
            return;
        }
        list.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-avatar" style="${c.avatar ? `background-image: ${getAvatarSVG(c.avatar.gender, c.avatar.skin, c.avatar.hair)}; background-size: cover; background-position: center; border: 2px solid ${c.color};` : `background:${c.color}`}">${c.avatar ? '' : c.author.replace('@', '').charAt(0).toUpperCase()}</div>
                <div class="comment-body">
                    <p class="comment-author">${c.author}</p>
                    <p class="comment-text">${c.text}</p>
                    <p class="comment-time">${c.time}</p>
                </div>
            </div>
        `).join('');
        // 스크롤 맨 아래
        list.scrollTop = list.scrollHeight;
    }

    function initFeed() {
        Object.keys(POSTS_CONTENT).forEach(pid => renderFeedPost(pid));
    }

    // 서버 데이터 최초 로딩
    loadBackendData();

    // ── 상태 ──────────────────────────────────────────
    let hearts = 108;
    let loggedInUser = 'Guest';
    const purchasedItems = new Set();   // 구매한 아이템 이름 목록

    // 선택된 스타일 (적용 전)
    let pendingStyle = { shape: 'circle', badge: 'star', effect: 'none', gender: 'boy', skin: 'white', hair: 'black', expression: 'smile', bg: 'mint' };
    // 실제 적용된 스타일
    let appliedStyle = { shape: 'circle', badge: 'star', effect: 'none', gender: 'boy', skin: 'white', hair: 'black', expression: 'smile', bg: 'mint' };

    const badgeEmojis = { star: '⭐', fire: '🔥', shield: '🛡️', crown: '👑' };

    // ── 화면 전환 ──────────────────────────────────────
    const allScreens = ['feed-screen', 'upload-screen', 'shop-screen', 'profile-screen', 'user-profile-screen'];

    function showScreen(name) {
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));

        const map = { feed: 'feed-screen', upload: 'upload-screen', shop: 'shop-screen', profile: 'profile-screen' };
        if (map[name]) {
            document.getElementById(map[name]).classList.remove('hidden');
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.target === name);
        });

        if (name === 'profile') renderProfile();
        if (name === 'feed') initFeed();
    }

    // ── 유저 프로필 화면 (작가별 개인 피드) ───────────────
    function buildPostCardHTML(postId) {
        const content = POSTS_CONTENT[postId];
        const author = USERS_DATA[content.authorId];
        if (!content || !author) return '';
        return `
        <div class="feed-post" data-post-id="${postId}">
            <div class="post-user" data-user-id="${content.authorId}" style="cursor:pointer;">
                <div class="post-avatar" style="background:${author.color}">${author.initial}</div>
                <div>
                    <p class="post-username">${author.handle}</p>
                    <p class="post-time">${content.time}</p>
                </div>
            </div>
            <div class="post-images-container" style="display: flex; flex-direction: column; cursor: pointer;" data-webtoon-trigger="${postId}">
                ${(content.imageUrls && content.imageUrls.length > 0)
                  ? content.imageUrls.map(url => `
                      <img src="${url}" class="webtoon-feed-img" style="width: 100%; display: block; filter: saturate(1.2) contrast(1.1); box-shadow: 0 4px 15px rgba(0,0,0,0.5);" />
                    `).join('')
                  : `<div class="post-image ${content.imageClass}" ${content.imageUrl ? `style="background-image: url(${content.imageUrl}); background-size: cover; background-position: center;"` : ''}>
                        <div class="post-image-inner">
                            <p class="comic-label">${content.label || ''}</p>
                            <p class="comic-scene">${content.scene || ''}</p>
                        </div>
                     </div>`
                }
            </div>
            <p class="post-title" style="margin-top: 1rem;">${content.title}</p>
            <p class="post-desc">${author.handle} · ${content.desc}</p>
            <div class="post-actions">
                <button class="action-btn like-btn" data-post-id="${postId}">
                    <span class="like-icon">🤍</span><span class="like-count">${content.baseLikes || 0}</span>
                </button>
                <button class="action-btn comment-toggle-btn" data-post-id="${postId}">
                    💬 <span class="comment-count">${content.comments ? content.comments.length : 0}</span>
                </button>
                <button class="action-btn">↗ Share</button>
                ${(loggedInUser !== 'Guest' && loggedInUser.toLowerCase() === content.authorId.toLowerCase()) ? `
                <button class="action-btn delete-post-btn" data-post-id="${postId}" style="color: #ff4444; margin-left: auto;">🗑️</button>
                ` : ''}
            </div>
            <div class="comment-section" id="comments-${postId}">
                <div class="comment-list" id="comment-list-${postId}"></div>
                <div class="comment-input-row">
                    <input class="comment-input" type="text" placeholder="Add a comment..." data-post-id="${postId}">
                    <button class="comment-submit" data-post-id="${postId}">Post</button>
                </div>
            </div>
        </div>`;
    }

    function openWebtoonViewer(postId) {
        const content = POSTS_CONTENT[postId];
        if (!content) return;
        
        document.getElementById('webtoon-title').textContent = content.title;
        const viewerContent = document.getElementById('webtoon-content');
        viewerContent.innerHTML = ''; // 화면 초기화
        
        if (content.imageUrls && content.imageUrls.length > 0) {
            // 여러 사진 업로드된 경우 세로로 스크롤
            content.imageUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'webtoon-image';
                viewerContent.appendChild(img);
            });
        } else if (content.imageUrl) {
            // 과거 데이터 (사진 1장)
            const img = document.createElement('img');
            img.src = content.imageUrl;
            img.className = 'webtoon-image';
            viewerContent.appendChild(img);
        } else {
            // 기본 데이터 (이미지 없고 css 클래스 배경만 있는 경우)
            const placeholder = document.createElement('div');
            placeholder.className = `post-image ${content.imageClass}`;
            placeholder.style.width = '100%';
            placeholder.style.maxWidth = '600px';
            placeholder.style.height = '400px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'flex-end';
            placeholder.style.padding = '1rem';
            placeholder.innerHTML = `
                <div class="post-image-inner" style="color:white;">
                    <p class="comic-label" style="font-size: 0.8rem; font-weight: bold; margin-bottom:0.5rem; opacity:0.8">${content.label}</p>
                    <p class="comic-scene" style="font-size: 1rem; font-style: italic;">${content.scene}</p>
                </div>
            `;
            viewerContent.appendChild(placeholder);
        }
        
        document.getElementById('webtoon-viewer-screen').classList.remove('hidden');
    }

    function showUserProfile(userId) {
        const user = USERS_DATA[userId];
        if (!user) return;

        // 헤더 정보 채우기
        const avatarEl = document.getElementById('up-avatar-lg');
        avatarEl.textContent = user.initial;
        avatarEl.style.background = user.color;
        document.getElementById('up-name').textContent = user.name;
        document.getElementById('up-handle').textContent = user.handle;
        document.getElementById('up-bio').textContent = user.bio;
        document.getElementById('up-followers').textContent = `${user.followers.toLocaleString()} followers`;
        document.getElementById('up-postcount').textContent = `${user.postIds.length} comics`;

        // 포스트 목록 렌더 (= GET /api/users/:userId/posts)
        const list = document.getElementById('up-posts-list');
        if (user.postIds.length === 0) {
            list.innerHTML = '<div class="up-empty">No comics posted yet.</div>';
        } else {
            list.innerHTML = user.postIds.map(buildPostCardHTML).join('');
            // 렌더된 포스트 좋아요 상태 반영
            user.postIds.forEach(pid => renderFeedPost(pid));
        }

        // 화면 전환
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById('user-profile-screen').classList.remove('hidden');
    }

    // ── 내 프로필 모달 ────────────────────────────────────
    const myProfileModal = document.getElementById('my-profile-modal');

    function openMyProfileModal() {
        const user = USERS_DATA[loggedInUser.toLowerCase()] || null;
        const initial = loggedInUser.charAt(0).toUpperCase();
        const color = user ? user.color : '#ffcc00';

        // 아바타 색상 & 이니셜 (SVG 반영)
        const avatarEl = document.getElementById('mpm-avatar');
        avatarEl.style.backgroundImage = getAvatarSVG(appliedStyle.gender, appliedStyle.skin, appliedStyle.hair, appliedStyle.expression, appliedStyle.bg);
        avatarEl.style.borderColor = color;

        document.getElementById('mpm-name').textContent = loggedInUser;
        document.getElementById('mpm-handle').textContent = `@${loggedInUser}`;
        document.getElementById('mpm-hearts').textContent = hearts;
        document.getElementById('mpm-items').textContent = purchasedItems.size;

        myProfileModal.classList.remove('hidden');
    }

    function closeMyProfileModal() {
        myProfileModal.classList.add('hidden');
    }

    // 아바타 버튼 3개 공통 클릭 → 모달 열기
    ['feed-avatar-btn', 'upload-avatar-btn', 'shop-avatar-btn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', openMyProfileModal);
    });

    // 모달 닫기 (X 버튼 & 오버레이 클릭)
    document.getElementById('mpm-close').addEventListener('click', closeMyProfileModal);
    myProfileModal.addEventListener('click', (e) => {
        if (e.target === myProfileModal) closeMyProfileModal();
    });

    // ── 하트 표시 업데이트 ─────────────────────────────
    function updateHeartDisplays() {
        document.getElementById('balance-display').textContent = `${hearts} ❤️`;
        document.getElementById('shop-heart-display').textContent = `${hearts} ❤️`;
        document.getElementById('profile-heart-display').textContent = `${hearts} ❤️`;
        if (document.getElementById('upload-heart-count'))
            document.getElementById('upload-heart-count').textContent = `${hearts} ❤️`;
    }

    function getAvatarSVG(gender, skinTone, hairTone, expression, bgColor) {
        const skinColors = {
            'white': '#ffd1b3',
            'yellow': '#f5d08e',
            'brown': '#b37a4c',
            'black': '#50301a'
        };
        const hairColors = {
            'blonde': '#ffcc00',
            'red': '#d32f2f',
            'brown': '#6a4e32',
            'black': '#2c1b18',
            'white': '#ffffff'
        };
        const bgColors = {
            'mint': '#a4e5d9', 'pink': '#ffb6c1', 'purple': '#c9b1ff',
            'yellow': '#fff3b0', 'sky': '#87ceeb'
        };
        const c = skinColors[skinTone] || skinColors['white'];
        const hc = hairColors[hairTone] || hairColors['black'];
        const bg = bgColors[bgColor] || bgColors['mint'];

        // Expression paths
        const expressions = {
            'smile': '<path d="M 45 49 Q 50 54 55 49" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" />',
            'wink': '<path d="M 45 49 Q 50 54 55 49" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" /><line x1="56" y1="40" x2="62" y2="40" stroke="#111" stroke-width="2" stroke-linecap="round" />',
            'surprised': '<ellipse cx="50" cy="51" rx="4" ry="5" fill="#111" />',
            'cool': '<rect x="36" y="37" width="12" height="5" rx="2" fill="#111" /><rect x="52" y="37" width="12" height="5" rx="2" fill="#111" /><path d="M 48 37 L 52 37" stroke="#111" stroke-width="1.5" /><path d="M 45 49 Q 50 52 55 49" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" />',
            'heart': '<path d="M 45 49 Q 50 54 55 49" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" /><path d="M39 38 C37 35 41 34 42 37 C43 34 47 35 45 38 C43 41 42 42 42 42 C42 42 41 41 39 38Z" fill="#e74c3c" /><path d="M55 38 C53 35 57 34 58 37 C59 34 63 35 61 38 C59 41 58 42 58 42 C58 42 57 41 55 38Z" fill="#e74c3c" />'
        };
        const expr = expression || 'smile';
        const eyesDefault = expr === 'cool' ? '' : '<circle cx="41" cy="40" r="3" fill="#111" /><circle cx="59" cy="40" r="3" fill="#111" />';
        const winkOverride = expr === 'wink' ? '<circle cx="41" cy="40" r="3" fill="#111" />' : eyesDefault;

        const svg = `
        <svg viewBox="15 15 70 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="100" height="100" fill="${bg}" />
            ${gender === 'girl' ? `<path d="M25 40 Q15 90 25 100 L75 100 Q85 90 75 40 Z" fill="${hc}" />` : ''}
            <rect x="42" y="60" width="16" height="15" fill="${c}" />
            <rect x="42" y="60" width="16" height="5" fill="rgba(0,0,0,0.1)" />
            <path d="M 20 100 C 20 70, 80 70, 80 100" fill="#ffffff" />
            <path d="M 42 70 C 46 76, 54 76, 58 70" fill="${c}" />
            <circle cx="50" cy="42" r="23" fill="${c}" />
            ${winkOverride}
            <circle cx="37" cy="46" r="3" fill="#ff7da7" opacity="0.4" />
            <circle cx="63" cy="46" r="3" fill="#ff7da7" opacity="0.4" />
            ${expressions[expr] || expressions['smile']}
            ${gender === 'boy' ? `<path d="M22 45 C15 10, 85 10, 78 45 C70 25, 30 25, 22 45" fill="${hc}" />` : `<path d="M22 45 C30 20, 70 20, 78 45 C75 30, 25 30, 22 45" fill="${hc}" />`}
        </svg>
        `.trim().replace(/\n/g, '').replace(/\s+/g, ' ');
        return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }

    // ── 아바타 미리보기 적용 ───────────────────────────
    function applyAvatarStyle(style) {
        const ring = document.getElementById('avatar-ring');
        const badge = document.getElementById('avatar-badge');
        const inner = document.getElementById('avatar-inner');

        // SVG 적용
        inner.style.backgroundImage = getAvatarSVG(style.gender, style.skin, style.hair, style.expression, style.bg);

        // 글자 제거
        const avatarEmojiEl = document.getElementById('avatar-emoji');
        if (avatarEmojiEl) avatarEmojiEl.textContent = '';

        // 기존 클래스 초기화
        ring.className = 'profile-avatar-ring';

        // Shape
        if (style.shape === 'rounded') ring.classList.add('shape-rounded-ring');
        if (style.shape === 'golden') ring.classList.add('shape-golden-ring');
        if (style.shape === 'hex') ring.classList.add('shape-hex-ring');

        // Effect
        if (style.effect === 'dark') ring.classList.add('effect-dark');
        if (style.effect === 'galaxy') ring.classList.add('effect-galaxy');
        if (style.effect === 'gold') ring.classList.add('effect-gold');

        // Badge
        badge.textContent = badgeEmojis[style.badge] || '⭐';
    }

    // ── 프로필 화면 렌더 ───────────────────────────────
    function renderProfile() {
        updateHeartDisplays();

        // 클로젯
        const closetEmpty = document.getElementById('closet-empty');
        const closetList = document.getElementById('closet-list');
        closetList.innerHTML = '';
        if (purchasedItems.size === 0) {
            closetEmpty.style.display = 'block';
        } else {
            closetEmpty.style.display = 'none';
            purchasedItems.forEach(item => {
                const tag = document.createElement('span');
                tag.className = 'closet-tag';
                tag.textContent = item;
                closetList.appendChild(tag);
            });
        }

        // 잠금 해제: 구매 아이템에 따라 locked 제거
        document.querySelectorAll('.pf-option[data-item]').forEach(opt => {
            const needed = opt.dataset.item;
            if (purchasedItems.has(needed)) {
                opt.classList.remove('locked');
            } else {
                opt.classList.add('locked');
            }
        });

        // 선택 상태 반영 (pending 기준)
        document.querySelectorAll('.pf-option').forEach(opt => {
            const group = opt.dataset.group;
            opt.classList.toggle('selected', pendingStyle[group] === opt.dataset.value);
        });

        // 현재 적용된 스타일로 아바타 미리보기
        applyAvatarStyle(appliedStyle);

        // E2: 카운터 애니메이션
        const heartDisplay = document.getElementById('profile-heart-display');
        if (heartDisplay && window.animateCounter) {
            heartDisplay.textContent = '0';
            window.animateCounter(heartDisplay, hearts);
            // 하트 이모지 추후 추가
            setTimeout(() => heartDisplay.textContent = `${hearts} ❤️`, 1200);
        }
    }

    // ── 클릭 이벤트 통합 처리 ─────────────────────────
    document.addEventListener('click', (e) => {

        // 하단 네비
        const navItem = e.target.closest('.nav-item[data-target]');
        if (navItem) {
            const target = navItem.dataset.target;
            if (['feed', 'upload', 'shop', 'profile'].includes(target)) showScreen(target);
        }


        // 옵션 선택 (프로필)
        const pfOpt = e.target.closest('.pf-option:not(.locked)');
        if (pfOpt && pfOpt.dataset.group) {
            const group = pfOpt.dataset.group;
            pendingStyle[group] = pfOpt.dataset.value;
            // 같은 그룹 selected 업데이트
            document.querySelectorAll(`.pf-option[data-group="${group}"]`).forEach(o => {
                o.classList.toggle('selected', o.dataset.value === pendingStyle[group]);
            });
            // 라이브 미리보기 반영
            applyAvatarStyle(pendingStyle);
        }

        // Apply Style 버튼
        if (e.target.closest('#apply-style-btn')) {
            appliedStyle = { ...pendingStyle };
            applyAvatarStyle(appliedStyle);
            
            const color = '#ffcc00';
            updateAllAvatarBtns('', color);

            // 로그인 상태라면 Railway 백엔드로 저장
            if (loggedInUser !== 'Guest') {
                const userKey = loggedInUser.toLowerCase();
                fetch(`/api/users/${userKey}/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: appliedStyle })
                }).catch(err => console.error(err));
            }

            const btn = document.getElementById('apply-style-btn');
            btn.textContent = '✅ Applied!';
            setTimeout(() => { btn.textContent = '✓ Apply Style'; }, 1500);
        }

        // ── 좋아요 버튼 ──────────────────────────────────
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const postId = likeBtn.dataset.postId;
            const user = loggedInUser || 'Guest';

            // Optimistic UI: 즉시 반영
            const wasLiked = isLiked(postId, user);
            const countEl = likeBtn.querySelector('.like-count');
            const iconEl = likeBtn.querySelector('.like-icon');
            const newLiked = !wasLiked;
            countEl.textContent = parseInt(countEl.textContent) + (newLiked ? 1 : -1);
            iconEl.textContent = newLiked ? '❤️' : '🤍';
            likeBtn.classList.toggle('liked', newLiked);

            // 팝 애니메이션
            likeBtn.classList.remove('pop');
            void likeBtn.offsetWidth; // reflow
            likeBtn.classList.add('pop');

            // B2: 하트 파티클 터지는 효과
            if (newLiked && window.spawnHeartParticles) {
                window.spawnHeartParticles(likeBtn);
            }

            // localStorage 동기화
            toggleLike(postId, user);
        }

        // ── 댓글 토글 버튼 ───────────────────────────────
        const commentToggleBtn = e.target.closest('.comment-toggle-btn');
        if (commentToggleBtn) {
            const postId = commentToggleBtn.dataset.postId;
            const section = document.getElementById(`comments-${postId}`);
            const isOpen = section.classList.toggle('open');
            if (isOpen) renderCommentList(postId);
        }

        // ── 댓글 게시 버튼 ───────────────────────────────
        const submitBtn = e.target.closest('.comment-submit');
        if (submitBtn) {
            const postId = submitBtn.dataset.postId;
            const input = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
            const text = input.value.trim();
            if (!text) return;

            input.value = '';
            addComment(postId, loggedInUser || 'Guest', text).then(() => {
                renderCommentList(postId);
                // 댓글 수 업데이트
                const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
                if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = getAllComments(postId).length;
            });
        }

        // ── 포스트 삭제 버튼 ───────────────────────────────
        const deleteBtn = e.target.closest('.delete-post-btn');
        if (deleteBtn) {
            const postId = deleteBtn.dataset.postId;
            if (!confirm('정말로 이 포스트를 삭제하시겠습니까?')) return;

            // localStorage에 삭제 기록 (페이지 새로고침 후에도 유지)
            persistDeletedPost(postId);

            // DOM에서 즉시 제거
            document.querySelectorAll(`.feed-post[data-post-id="${postId}"]`).forEach(card => card.remove());

            // 메모리에서 제거
            delete POSTS_CONTENT[postId];

            // 유저 postIds 배열에서도 제거
            const ukey = loggedInUser.toLowerCase();
            if (USERS_DATA[ukey]) {
                USERS_DATA[ukey].postIds = USERS_DATA[ukey].postIds.filter(id => id !== postId);
                if (!document.getElementById('profile-screen').classList.contains('hidden')) renderProfile();
                const countEl = document.getElementById('up-postcount');
                if (countEl && !document.getElementById('user-profile-screen').classList.contains('hidden')) {
                    countEl.textContent = `${USERS_DATA[ukey].postIds.length} comics`;
                }
            }

            // 백엔드가 있을 경우 동기화 (실패해도 무시)
            fetch(`/api/posts/${postId}?userId=${loggedInUser}`, { method: 'DELETE' }).catch(() => {});
        }

        // ── 공유 버튼 클릭 ───────────────────────────────
        const shareBtn = e.target.closest('.action-btn');
        if (shareBtn && shareBtn.textContent.includes('Share')) {
            const feedPost = shareBtn.closest('.feed-post');
            if (feedPost) {
                const postId = feedPost.dataset.postId;
                const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('링크가 복사되었습니다! 친구들에게 공유해보세요.');
                }).catch(err => {
                    console.error('클립보드 복사 실패:', err);
                });
            }
        }

        // ── 스토리 아바타 클릭 → 유저 프로필 ────────────────
        const storyItem = e.target.closest('.story-item[data-user-id]');
        if (storyItem) showUserProfile(storyItem.dataset.userId);

        // ── 포스트 작성자 클릭 → 유저 프로필 ────────────────
        const postUser = e.target.closest('.post-user[data-user-id]');
        if (postUser) showUserProfile(postUser.dataset.userId);

        // ── 포스트 이미지 클릭 → 유저 프로필 ────────────────
        const postImage = e.target.closest('.post-image[data-user-id]');
        if (postImage) showUserProfile(postImage.dataset.userId);

        // ── 웹툰 뷰어 열기 ──────────────────────────────────
        const webtoonTrigger = e.target.closest('[data-webtoon-trigger]');
        if (webtoonTrigger) {
            const postId = webtoonTrigger.dataset.webtoonTrigger;
            openWebtoonViewer(postId);
        }

        // ── 웹툰 뷰어 Back 버튼 ─────────────────────────────
        if (e.target.closest('#webtoon-back-btn')) {
            document.getElementById('webtoon-viewer-screen').classList.add('hidden');
        }

        // ── 유저 프로필 Back 버튼 → 피드 ────────────────────
        if (e.target.closest('#up-back-btn')) showScreen('feed');

        // Shop More (프로필 → 상점)
        if (e.target.closest('#go-shop-from-profile')) showScreen('shop');

        // ── D2/D3: Shop 구매 ─────────────────────────────
        const buyBtn = e.target.closest('.buy-btn');
        if (buyBtn) {
            const card = buyBtn.closest('.shop-card') || buyBtn.closest('.shop-featured');
            if (!card) return;
            const price = parseInt(card.dataset.price) || 0;
            const itemName = card.dataset.name || 'Item';

            if (purchasedItems.has(itemName)) {
                alert('이미 구매한 아이템입니다!');
                return;
            }
            if (hearts < price) {
                alert('하트가 부족합니다! 💔');
                return;
            }

            hearts -= price;
            purchasedItems.add(itemName);
            updateHeartDisplays();

            // D3: 언락 애니메이션
            card.classList.add('unlocking');
            buyBtn.textContent = '✅ Owned';
            buyBtn.disabled = true;
            buyBtn.style.opacity = '0.6';
            setTimeout(() => card.classList.remove('unlocking'), 700);

            // D2: 컨페티 효과
            if (window.spawnConfetti) window.spawnConfetti();
        }

        // Logout (프로필 화면 버튼 & 내 프로필 모달 버튼 공통)
        if (e.target.closest('#logout-btn') || e.target.closest('#mpm-logout-btn')) {
            doLogout();
        }
    });

    function updateAllAvatarBtns(initial, color) {
        ['feed-avatar-btn', 'upload-avatar-btn', 'shop-avatar-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.style.backgroundImage = getAvatarSVG(appliedStyle.gender, appliedStyle.skin, appliedStyle.hair, appliedStyle.expression, appliedStyle.bg);
            btn.style.backgroundSize = 'cover';
            btn.style.backgroundPosition = 'center';
            btn.style.borderColor = color;
            btn.textContent = '';
        });
    }

    function doLogout() {
        closeMyProfileModal();
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
        loginModal.classList.remove('hidden');
        const heroSection = document.querySelector('main.hero-section');
        if (heroSection) heroSection.style.display = '';
        // 인증 정보 + 상태 전부 초기화
        hearts = 108;
        loggedInUser = 'Guest';
        purchasedItems.clear();
        pendingStyle = { shape: 'circle', badge: 'star', effect: 'none', gender: 'boy', skin: 'white', hair: 'black' };
        appliedStyle = { shape: 'circle', badge: 'star', effect: 'none', gender: 'boy', skin: 'white', hair: 'black' };
        updateAllAvatarBtns('?', '#ccc');
    }

    // ── 로그인 & 회원가입 ────────────────────────────────────────
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const goSignupBtn = document.getElementById('go-signup');
    const goLoginBtn = document.getElementById('go-login');
    const signupForm = document.getElementById('signup-form');
    const checkIdBtn = document.getElementById('check-id-btn');
    const idCheckMsg = document.getElementById('id-check-msg');
    const signupId = document.getElementById('signup-id');

    let isIdChecked = false;
    // 유저 데이터베이스 (MOCK)
    USERS_DB = {
        'kevin': { id: 'Kevin', pwd: 'acccng', name: 'Kevin' },
        'admin': { id: 'admin', pwd: 'admin', name: 'Admin User' },
        'test': { id: 'test', pwd: 'test', name: 'Test User' },
        'comic': { id: 'comic', pwd: '1234', name: 'Comic Master' }
    };

    function toggleAuthMode(toSignup) {
        if (toSignup) {
            loginSection.classList.add('auth-hidden');
            signupSection.classList.remove('auth-hidden');
        } else {
            signupSection.classList.add('auth-hidden');
            loginSection.classList.remove('auth-hidden');
        }
        loginForm.reset();
        if (signupForm) signupForm.reset();
        if (idCheckMsg) {
            idCheckMsg.textContent = '';
            idCheckMsg.className = 'check-msg';
        }
        isIdChecked = false;
    }

    if (goSignupBtn) {
        goSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuthMode(true);
        });
    }

    if (goLoginBtn) {
        goLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuthMode(false);
        });
    }

    if (signupId) {
        signupId.addEventListener('input', () => {
            isIdChecked = false;
            idCheckMsg.textContent = '';
            idCheckMsg.className = 'check-msg';
        });
    }

    if (checkIdBtn) {
        checkIdBtn.addEventListener('click', async () => {
            const idValue = signupId.value.trim();
            if (!idValue) {
                idCheckMsg.textContent = '아이디를 입력해주세요.';
                idCheckMsg.className = 'check-msg error';
                return;
            }
            try {
                const res = await fetch(`/api/auth/check?id=${idValue}`);
                const data = await res.json();
                if (data.exists) {
                    idCheckMsg.textContent = '이미 사용 중인 아이디입니다.';
                    idCheckMsg.className = 'check-msg error';
                    isIdChecked = false;
                } else {
                    idCheckMsg.textContent = '사용 가능한 아이디입니다.';
                    idCheckMsg.className = 'check-msg success';
                    isIdChecked = true;
                }
            } catch(e) {
                console.error('ID check failed', e);
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('email').value.trim();
        const pwd = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password: pwd })
            });
            const data = await res.json();

            if (data.success) {
                loginModal.classList.add('hidden');
                loginForm.reset();
                loggedInUser = data.user.id; // Fix: Use ID instead of name for data mapping

                // 로그인 유저 정보로 UI 업데이트
                const profileNameEl = document.querySelector('.profile-name');
                if (profileNameEl) profileNameEl.textContent = data.user.name;

                const initial = data.user.initial || data.user.name.charAt(0).toUpperCase();
                const color = data.user.color || '#ffcc00';
                const avatarEmojiEl = document.getElementById('avatar-emoji');
                if (avatarEmojiEl) avatarEmojiEl.textContent = '';
                
                if (data.user.avatar) {
                    appliedStyle = { ...appliedStyle, ...data.user.avatar };
                    pendingStyle = { ...appliedStyle };
                }
                applyAvatarStyle(appliedStyle);
                updateAllAvatarBtns(initial, color);

                const heroSection = document.querySelector('main.hero-section');
                if (heroSection) heroSection.style.display = 'none';

                showScreen('upload');
            } else {
                alert('아이디가 존재하지 않거나 비밀번호가 일치하지 않습니다.');
            }
        } catch(e) {
            console.error('Login failed', e);
            alert('로그인 처리 중 오류가 발생했습니다.');
        }
    });

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isIdChecked) {
                alert('아이디 중복 확인을 완료해주세요.');
                return;
            }

            const newId = document.getElementById('signup-id').value.trim();
            const newName = document.getElementById('signup-name').value.trim();
            const pwd = document.getElementById('signup-pwd').value;
            const confirmPwd = document.getElementById('signup-pwd-confirm').value;

            if (pwd !== confirmPwd) {
                alert('비밀번호가 일치하지 않습니다.');
                return;
            }

            try {
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newId, pwd, name: newName })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`회원가입이 완료되었습니다!\n환영합니다, ${newName}님.\n이제 가입하신 계정으로 로그인 해주세요.`);
                    toggleAuthMode(false);
                } else {
                    alert(data.message || '가입에 실패했습니다.');
                }
            } catch(e) { console.error('회원가입 실패', e); }
        });
    }

    // ── 업로드 화면 ───────────────────────────────────
    let uploadedImages = [];
    let uploadedFiles = []; // 실제 전송할 파일 객체 배열
    const dropZone = document.getElementById('drop-zone');
    const panelInput = document.getElementById('panel-input');
    const thumbnailStrip = document.querySelector('.thumbnail-strip');
    const thumbAddBtn = document.getElementById('thumb-add-btn');

    let dragSrcIndex = null;

    const renderThumbnails = () => {
        // 기존 썸네일(미리보기, 플레이스홀더) 제거
        const existingThumbs = thumbnailStrip.querySelectorAll('.thumb-preview, .thumb-placeholder');
        existingThumbs.forEach(el => el.remove());

        // 업로드된 이미지 썸네일 새로 추가
        uploadedImages.forEach((dataUrl, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb-preview';
            thumb.dataset.index = idx;
            thumb.draggable = true;
            thumb.style.width = '56px';
            thumb.style.height = '56px';
            thumb.style.borderRadius = '8px';
            thumb.style.backgroundImage = `url(${dataUrl})`;
            thumb.style.backgroundSize = 'cover';
            thumb.style.backgroundPosition = 'center';
            thumb.style.flexShrink = '0';
            thumb.style.cursor = 'grab';
            thumb.style.position = 'relative';
            thumb.style.transition = 'transform 0.15s, opacity 0.15s, box-shadow 0.15s';
            thumb.style.border = '2px solid transparent';

            // 순번 표시
            const badge = document.createElement('span');
            badge.textContent = idx + 1;
            badge.style.cssText = 'position:absolute;top:-6px;left:-6px;background:#ffcc00;color:#111;width:20px;height:20px;border-radius:50%;font-size:0.65rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);pointer-events:none;';
            thumb.appendChild(badge);

            // 삭제 버튼
            const delBtn = document.createElement('span');
            delBtn.textContent = '✕';
            delBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#ff4444;color:#fff;width:18px;height:18px;border-radius:50%;font-size:0.6rem;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.15s;';
            thumb.appendChild(delBtn);
            thumb.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
            thumb.addEventListener('mouseleave', () => delBtn.style.opacity = '0');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                uploadedImages.splice(idx, 1);
                uploadedFiles.splice(idx, 1);
                renderThumbnails();
            });

            // 드래그 이벤트
            thumb.addEventListener('dragstart', (e) => {
                dragSrcIndex = idx;
                thumb.style.opacity = '0.4';
                thumb.style.boxShadow = '0 0 0 3px #ffcc00';
                e.dataTransfer.effectAllowed = 'move';
            });
            thumb.addEventListener('dragend', () => {
                thumb.style.opacity = '1';
                thumb.style.boxShadow = 'none';
                dragSrcIndex = null;
                // 모든 보더 초기화
                thumbnailStrip.querySelectorAll('.thumb-preview').forEach(t => t.style.border = '2px solid transparent');
            });
            thumb.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                thumb.style.border = '2px solid #ffcc00';
            });
            thumb.addEventListener('dragleave', () => {
                thumb.style.border = '2px solid transparent';
            });
            thumb.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetIdx = idx;
                if (dragSrcIndex === null || dragSrcIndex === targetIdx) return;

                // 배열 순서 교환
                const [movedImg] = uploadedImages.splice(dragSrcIndex, 1);
                uploadedImages.splice(targetIdx, 0, movedImg);
                const [movedFile] = uploadedFiles.splice(dragSrcIndex, 1);
                uploadedFiles.splice(targetIdx, 0, movedFile);

                dragSrcIndex = null;
                renderThumbnails();
            });

            // 썸네일 클릭 시 메인 화면 변경
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                dropZone.style.backgroundImage = `url(${dataUrl})`;
            });
            thumbnailStrip.insertBefore(thumb, thumbAddBtn);
        });

        // 3개 미만이면 placeholder 채우기
        const currentCount = uploadedImages.length;
        for (let i = 0; i < Math.max(0, 3 - currentCount); i++) {
            const ph = document.createElement('div');
            ph.className = 'thumb-placeholder';
            thumbnailStrip.insertBefore(ph, thumbAddBtn);
        }

        if (uploadedImages.length > 0) {
            const latestDataUrl = uploadedImages[uploadedImages.length - 1];
            dropZone.style.backgroundImage = `url(${latestDataUrl})`;
            dropZone.style.backgroundSize = 'cover';
            dropZone.style.backgroundPosition = 'center';
            dropZone.querySelector('.drop-icon').style.display = 'none';
            dropZone.querySelector('.drop-main').style.display = 'none';
            dropZone.querySelector('.drop-sub').style.display = 'none';
        } else {
            dropZone.style.backgroundImage = 'none';
            dropZone.querySelector('.drop-icon').style.display = 'block';
            dropZone.querySelector('.drop-main').style.display = 'block';
            dropZone.querySelector('.drop-sub').style.display = 'block';
        }

        // 편집 툴바 표시/숨기기
        const editorToolbar = document.getElementById('editor-toolbar');
        if (editorToolbar) editorToolbar.style.display = uploadedImages.length > 0 ? 'flex' : 'none';
        if (uploadedImages.length === 0) {
            document.getElementById('gap-slider-wrap').style.display = 'none';
            dropZone.querySelectorAll('.speech-bubble').forEach(b => b.remove());
        }
    };

    // ── 말풍선 편집 기능 ───────────────────────────────
    function makeDraggable(el) {
        let ox, oy;
        el.addEventListener('mousedown', e => {
            if (e.target.contentEditable === 'true') return;
            ox = e.clientX - el.offsetLeft;
            oy = e.clientY - el.offsetTop;
            const move = e2 => {
                el.style.left = (e2.clientX - ox) + 'px';
                el.style.top  = (e2.clientY - oy) + 'px';
                el.style.transform = 'none';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
        el.addEventListener('touchstart', e => {
            const t = e.touches[0];
            ox = t.clientX - el.offsetLeft;
            oy = t.clientY - el.offsetTop;
            const move = e2 => {
                const t2 = e2.touches[0];
                el.style.left = (t2.clientX - ox) + 'px';
                el.style.top  = (t2.clientY - oy) + 'px';
                el.style.transform = 'none';
            };
            const up = () => {
                document.removeEventListener('touchmove', move);
                document.removeEventListener('touchend', up);
            };
            document.addEventListener('touchmove', move, { passive: true });
            document.addEventListener('touchend', up);
        }, { passive: true });
    }

    function addBubble(type) {
        if (uploadedImages.length === 0) { alert('이미지를 먼저 선택해주세요.'); return; }
        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble ' + type;
        bubble.style.cssText = `
            position: absolute;
            left: 50%; top: 30%;
            transform: translate(-50%, -50%);
            min-width: 80px; min-height: 40px;
            padding: 8px 14px;
            background: ${type === 'thought' ? '#f0f0ff' : '#fff'};
            border: 2px solid ${type === 'thought' ? '#6c5ce7' : '#1a1a1a'};
            border-radius: ${type === 'thought' ? '40px' : '16px'};
            cursor: move;
            z-index: 10;
            font-family: Nunito, sans-serif;
            font-weight: 700;
            font-size: 14px;
            user-select: none;
            box-shadow: 2px 2px 0px rgba(0,0,0,0.15);
        `;

        const text = document.createElement('div');
        text.contentEditable = true;
        text.textContent = type === 'thought' ? '생각 중...' : '말해봐요!';
        text.style.cssText = 'outline:none; min-width:40px; text-align:center;';
        text.onclick = e => e.stopPropagation();

        const tail = document.createElement('div');
        if (type === 'speech') {
            tail.style.cssText = `
                position:absolute; bottom:-12px; left:16px;
                width:0; height:0;
                border-left:8px solid transparent;
                border-right:8px solid transparent;
                border-top:12px solid #1a1a1a;
            `;
            const tailInner = document.createElement('div');
            tailInner.style.cssText = `
                position:absolute; bottom:2px; left:-6px;
                width:0; height:0;
                border-left:6px solid transparent;
                border-right:6px solid transparent;
                border-top:10px solid #fff;
            `;
            tail.appendChild(tailInner);
        } else {
            tail.innerHTML = `
                <div style="position:absolute;bottom:-18px;left:12px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
                    <div style="width:10px;height:10px;border-radius:50%;background:#f0f0ff;border:2px solid #6c5ce7;"></div>
                    <div style="width:6px;height:6px;border-radius:50%;background:#f0f0ff;border:2px solid #6c5ce7;margin-left:2px;"></div>
                    <div style="width:4px;height:4px;border-radius:50%;background:#f0f0ff;border:2px solid #6c5ce7;margin-left:4px;"></div>
                </div>
            `;
        }

        const del = document.createElement('button');
        del.textContent = '✕';
        del.style.cssText = `
            position:absolute; top:-10px; right:-10px;
            background:#e24b4a; color:#fff; border:none;
            border-radius:50%; width:22px; height:22px;
            font-size:11px; cursor:pointer; line-height:1;
            font-weight:800;
        `;
        del.onclick = (e) => { e.stopPropagation(); bubble.remove(); };

        bubble.appendChild(text);
        bubble.appendChild(tail);
        bubble.appendChild(del);
        makeDraggable(bubble);
        dropZone.appendChild(bubble);
    }

    function clearBubbles() {
        dropZone.querySelectorAll('.speech-bubble').forEach(b => b.remove());
        const gs = document.getElementById('gap-slider');
        if (gs) gs.value = 8;
        thumbnailStrip.style.gap = '8px';
        const gv = document.getElementById('gap-value');
        if (gv) gv.textContent = '8px';
        document.getElementById('gap-slider-wrap').style.display = 'none';
    }

    function toggleGapSlider() {
        const wrap = document.getElementById('gap-slider-wrap');
        wrap.style.display = wrap.style.display === 'flex' ? 'none' : 'flex';
    }

    // 툴바 버튼 이벤트 리스너
    document.getElementById('btn-speech-bubble').addEventListener('click', () => addBubble('speech'));
    document.getElementById('btn-thought-bubble').addEventListener('click', () => addBubble('thought'));
    document.getElementById('btn-gap-toggle').addEventListener('click', toggleGapSlider);
    document.getElementById('btn-clear-bubbles').addEventListener('click', clearBubbles);
    document.getElementById('gap-slider').addEventListener('input', function() {
        thumbnailStrip.style.gap = this.value + 'px';
        document.getElementById('gap-value').textContent = this.value + 'px';
    });

    // 파일 읽어서 배열에 추가하는 함수
    const handleFiles = (files) => {
        if (!files || files.length === 0) return;
        Array.from(files).forEach(file => {
            uploadedFiles.push(file); // 서버 전송 대비
            const reader = new FileReader();
            reader.onload = (ev) => {
                uploadedImages.push(ev.target.result);
                renderThumbnails();
            };
            reader.readAsDataURL(file);
        });
    };

    dropZone.addEventListener('click', () => panelInput.click());
    panelInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        panelInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#ffcc00'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#ccc'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        handleFiles(e.dataTransfer.files);
    });

    thumbAddBtn.addEventListener('click', () => panelInput.click());

    // 업로드 완료 처리 — 미리보기 모달 먼저 표시
    const uploadBtn = document.querySelector('.upload-btn');
    const previewModal = document.getElementById('upload-preview-modal');
    const previewBackBtn = document.getElementById('preview-back-btn');
    const previewCancelBtn = document.getElementById('preview-cancel-btn');
    const previewConfirmBtn = document.getElementById('preview-confirm-btn');

    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            if (uploadedFiles.length === 0) {
                alert('사진을 먼저 업로드해주세요!');
                return;
            }
            const titleInput = document.querySelector('.field-input').value.trim();
            if (!titleInput) {
                alert('제목을 입력해주세요.');
                return;
            }
            const descInput = document.getElementById('desc-area').value.trim();

            // 미리보기 모달에 정보 채우기
            document.getElementById('preview-comic-title').textContent = titleInput;
            document.getElementById('preview-comic-desc').textContent = descInput || 'No description';

            const previewImagesEl = document.getElementById('preview-images');
            previewImagesEl.innerHTML = '';
            uploadedImages.forEach(dataUrl => {
                const img = document.createElement('img');
                img.src = dataUrl;
                previewImagesEl.appendChild(img);
            });

            // 미리보기 모달 열기
            previewModal.classList.remove('hidden');
        });
    }

    // 미리보기 → 뒤로가기 / 수정
    if (previewBackBtn) previewBackBtn.addEventListener('click', () => previewModal.classList.add('hidden'));
    if (previewCancelBtn) previewCancelBtn.addEventListener('click', () => previewModal.classList.add('hidden'));

    // 미리보기 → 최종 업로드
    if (previewConfirmBtn) {
        previewConfirmBtn.addEventListener('click', async () => {
            const titleInput = document.querySelector('.field-input').value.trim();
            const descInput = document.getElementById('desc-area').value.trim();
            const currentUser = loggedInUser || 'Guest';

            const formData = new FormData();
            formData.append('title', titleInput);
            formData.append('desc', descInput);
            formData.append('authorId', currentUser);
            uploadedFiles.forEach(file => formData.append('images', file));

            previewConfirmBtn.textContent = 'Publishing...';
            previewConfirmBtn.disabled = true;

            // C1: 프로그레스 바 표시
            const progressWrap = document.querySelector('.upload-progress-wrap') || (() => {
                const w = document.createElement('div');
                w.className = 'upload-progress-wrap';
                w.innerHTML = '<div class="upload-progress-bar"></div>';
                previewConfirmBtn.parentElement.insertBefore(w, previewConfirmBtn.nextSibling);
                return w;
            })();
            progressWrap.style.display = 'block';
            const progressBar = progressWrap.querySelector('.upload-progress-bar');
            progressBar.style.width = '0%';
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 85) progress = 85;
                progressBar.style.width = progress + '%';
            }, 200);

            try {
                const res = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if (data.success) {
                    const newPostId = data.post.id;
                    POSTS_CONTENT[newPostId] = data.post;
                    const ukey = currentUser.toLowerCase();
                    if (USERS_DATA[ukey]) {
                        USERS_DATA[ukey].postIds.unshift(newPostId);
                    }

                    // 피드화면에 출력
                    const feedBody = document.querySelector('.feed-body');
                    const storyContainer = feedBody ? feedBody.querySelector('.story-container') : null;
                    if (storyContainer) {
                        storyContainer.insertAdjacentHTML('afterend', buildPostCardHTML(newPostId));
                        renderFeedPost(newPostId);
                    }

                    // 모달 닫기
                    previewModal.classList.add('hidden');

                    alert('업로드 완료! 피드에 성공적으로 게시되었습니다. 🎉');

                    // 폼 초기화
                    uploadedImages = [];
                    uploadedFiles = [];
                    renderThumbnails();
                    document.querySelector('.field-input').value = '';
                    document.getElementById('desc-area').value = '';
                    document.getElementById('char-count').textContent = '0 / 240 characters';

                    // 피드 화면으로 이동
                    showScreen('feed');
                } else {
                    alert('업로드에 실패했습니다.');
                }
            } catch(e) {
                // 오프라인 fallback — 로컬 포스트로 즉시 처리
                const ukey = currentUser.toLowerCase();
                const author = USERS_DATA[ukey];
                if (author) {
                    const newPostId = `local-${Date.now()}`;
                    const newPost = {
                        id: newPostId,
                        authorId: ukey,
                        title: titleInput,
                        desc: descInput || '',
                        imageUrls: [...uploadedImages],
                        imageClass: 'custom-upload',
                        time: 'Just now',
                        baseLikes: 0,
                        likes: {},
                        comments: []
                    };
                    POSTS_CONTENT[newPostId] = newPost;
                    USERS_DATA[ukey].postIds.unshift(newPostId);
                    saveLocalPost(newPost);

                    const feedBody2 = document.querySelector('.feed-body');
                    const storyContainer2 = feedBody2 ? feedBody2.querySelector('.story-container') : null;
                    if (storyContainer2) {
                        storyContainer2.insertAdjacentHTML('afterend', buildPostCardHTML(newPostId));
                        renderFeedPost(newPostId);
                    }

                    previewModal.classList.add('hidden');
                    alert('업로드 완료! 피드에 성공적으로 게시되었습니다. 🎉');

                    uploadedImages = [];
                    uploadedFiles = [];
                    renderThumbnails();
                    document.querySelector('.field-input').value = '';
                    document.getElementById('desc-area').value = '';
                    document.getElementById('char-count').textContent = '0 / 240 characters';
                    showScreen('feed');
                } else {
                    console.error('업로드 실패', e);
                }
            } finally {
                clearInterval(progressInterval);
                progressBar.style.width = '100%';
                setTimeout(() => { progressWrap.style.display = 'none'; progressBar.style.width = '0%'; }, 500);
                previewConfirmBtn.textContent = '⬆ Publish to Feed';
                previewConfirmBtn.disabled = false;
            }
        });
    }

    const descArea = document.getElementById('desc-area');
    const charCount = document.getElementById('char-count');
    descArea.addEventListener('input', () => {
        charCount.textContent = `${descArea.value.length} / 240 characters`;
    });

    // 댓글 입력창 엔터키 제출
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target.closest('.comment-input');
        if (!input) return;
        const postId = input.dataset.postId;
        const text = input.value.trim();
        if (!text) return;
        addComment(postId, loggedInUser || 'Guest', text);
        input.value = '';
        renderCommentList(postId);
        const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
        if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = getAllComments(postId).length;
    });

    // ── 공유 링크 처리 (URL 파라미터 확인) ────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPostId = urlParams.get('post');
    if (sharedPostId) {
        showScreen('feed'); // 피드 화면으로 즉시 이동
        setTimeout(() => {
            const targetPost = document.querySelector(`.feed-post[data-post-id="${sharedPostId}"]`);
            if (targetPost) {
                targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 시각적 피드백 (하이라이트 효과)
                targetPost.style.transition = 'box-shadow 0.5s, transform 0.5s';
                targetPost.style.boxShadow = '0 0 20px 5px rgba(255, 204, 0, 0.8)';
                targetPost.style.transform = 'scale(1.02)';
                targetPost.style.borderRadius = '16px';

                setTimeout(() => {
                    targetPost.style.boxShadow = '';
                    targetPost.style.transform = '';
                }, 2000);
            }
        }, 300); // 렌더링 대기 후 스크롤
    }

    // ── A3: 타이핑 효과 ──────────────────────────────────
    const typingEl = document.getElementById('typing-subtitle');
    if (typingEl) {
        const phrases = [
            'Your space to create, share, and enjoy comics with friends.',
            'Draw your story. Share your world.',
            'Where imagination meets community.',
        ];
        let phraseIdx = 0;
        let charIdx = 0;
        let isDeleting = false;

        function typeLoop() {
            const current = phrases[phraseIdx];
            if (!isDeleting) {
                typingEl.innerHTML = current.substring(0, charIdx) + '<span class="typing-cursor"></span>';
                charIdx++;
                if (charIdx > current.length) {
                    isDeleting = true;
                    setTimeout(typeLoop, 2000);
                    return;
                }
                setTimeout(typeLoop, 50);
            } else {
                typingEl.innerHTML = current.substring(0, charIdx) + '<span class="typing-cursor"></span>';
                charIdx--;
                if (charIdx < 0) {
                    isDeleting = false;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    setTimeout(typeLoop, 400);
                    return;
                }
                setTimeout(typeLoop, 25);
            }
        }
        typeLoop();
    }

    // ── B2: 하트 터지는 파티클 ────────────────────────────
    window.spawnHeartParticles = function(btn) {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const emojis = ['❤️', '💕', '💖', '✨', '💗'];
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('span');
            p.className = 'heart-particle';
            p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            const angle = (Math.PI * 2 * i) / 8;
            const dist = 40 + Math.random() * 30;
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 850);
        }
    };

    // ── D2: 컨페티 효과 ──────────────────────────────────
    window.spawnConfetti = function() {
        const colors = ['#ffcc00', '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#feca57'];
        for (let i = 0; i < 40; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDuration = (1 + Math.random() * 1) + 's';
            piece.style.animationDelay = Math.random() * 0.5 + 's';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            document.body.appendChild(piece);
            setTimeout(() => piece.remove(), 2500);
        }
    };

    // ── E2: 카운터 애니메이션 ────────────────────────────
    window.animateCounter = function(el, target) {
        let current = 0;
        const step = Math.max(1, Math.floor(target / 30));
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(interval);
            }
            el.textContent = current.toLocaleString();
        }, 30);
    };

    // ── B6: 당겨서 새로고침 ──────────────────────────────
    const feedBody = document.querySelector('.feed-body');
    const pullIndicator = document.getElementById('pull-indicator');
    if (feedBody && pullIndicator) {
        let touchStartY = 0;
        let pulling = false;

        feedBody.addEventListener('touchstart', (e) => {
            if (feedBody.scrollTop === 0) {
                touchStartY = e.touches[0].clientY;
                pulling = true;
            }
        });

        feedBody.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            const diff = e.touches[0].clientY - touchStartY;
            if (diff > 60) {
                pullIndicator.classList.add('visible');
            }
        });

        feedBody.addEventListener('touchend', () => {
            if (pullIndicator.classList.contains('visible')) {
                pullIndicator.innerHTML = '<span class="pull-spinner">🔄</span> 새로고침 중...';
                loadBackendData().then(() => {
                    pullIndicator.innerHTML = '✅ 완료!';
                    setTimeout(() => pullIndicator.classList.remove('visible'), 800);
                });
            }
            pulling = false;
        });
    }

};

// 페이지 로드 상태에 따라 즉시 실행 또는 이벤트 대기
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

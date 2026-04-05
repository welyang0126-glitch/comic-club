document.addEventListener('DOMContentLoaded', () => {
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

    // ── 유저 데이터 (= /api/users 에 해당) ────────────────
    const USERS_DATA = {
        'glorich':    { name: 'GloRich_',    handle: '@GloRich_',    color: '#6a0dad', initial: 'G', bio: 'Neon Drift creator ✨ Comic artist since 2019', followers: 1240, postIds: ['post-1', 'gp-2', 'gp-3'] },
        'jen_borden': { name: 'jen_borden',  handle: '@jen_borden',  color: '#e07b7b', initial: 'J', bio: 'DragonStar illustrator 🐉 Fantasy comic creator', followers: 2310, postIds: ['post-2', 'jp-2'] },
        'kevin':      { name: 'Kevin',       handle: '@Kevin',       color: '#f4c542', initial: 'K', bio: 'Admin · Comic Club founder ⚡', followers: 530,  postIds: [] },
        'alex':       { name: 'Alex',        handle: '@Alex',        color: '#e07bbd', initial: 'A', bio: 'Aspiring comic writer 🎨', followers: 320,  postIds: [] },
        'juno':       { name: 'Juno',        handle: '@Juno',        color: '#7bc8e0', initial: 'J', bio: 'Manga fan & aspiring artist', followers: 180,  postIds: [] },
        'sam':        { name: 'Sam',         handle: '@Sam',         color: '#a0e07b', initial: 'S', bio: 'Comic collector & critic', followers: 240,  postIds: [] },
        'rita':       { name: 'Rita',        handle: '@Rita',        color: '#e07b7b', initial: 'R', bio: 'Webtoon enthusiast 🌸', followers: 160,  postIds: [] },
    };

    // ── 포스트 콘텐츠 (= /api/posts 에 해당) ──────────────
    const POSTS_CONTENT = {
        'post-1': { title: 'Neon Drift, Part 14',   authorId: 'glorich',    imageClass: 'neon',   label: '🌆 NEON CITY',  scene: 'A lone figure walks through rain-soaked streets...', desc: 'Finally finished the rain scene! This chapter took me forever 😭✨', time: '2h ago' },
        'post-2': { title: 'DragonStar',            authorId: 'jen_borden', imageClass: 'dragon', label: '🐉 DRAGONSTAR', scene: 'The dragon soars above the golden plains!',           desc: 'A dragon bright is a dragon right — new episode drops this Friday 🔥', time: '5h ago' },
        'gp-2':   { title: 'Neon Drift, Part 13',   authorId: 'glorich',    imageClass: 'neon',   label: '🌆 NEON CITY',  scene: 'Two figures face off under flickering neon lights...', desc: 'The confrontation scene is finally here 💥 Took 3 weeks to draw!', time: '3d ago' },
        'gp-3':   { title: 'Neon Drift, Part 1',    authorId: 'glorich',    imageClass: 'neon',   label: '🌆 NEON CITY',  scene: 'A city that never sleeps. A story just beginning...', desc: 'Where it all began. The very first chapter! 🌟 Throwback', time: '2mo ago' },
        'jp-2':   { title: 'DragonStar: Origins',   authorId: 'jen_borden', imageClass: 'dragon', label: '🐉 DRAGONSTAR', scene: 'A young dragon hatches from a golden egg...', desc: 'The origin story — how DragonStar was born 🔥 Prequel chapter!', time: '1wk ago' },
    };

    // ── 피드 DB (localStorage) ─────────────────────────
    const POST_DEFAULTS = {
        'post-1': { baseLikes: 284, baseComments: [
            { id: 'c1', author: '@GloRich_', text: 'Finally done! This took so long 😭', time: '1h ago', color: '#6a0dad' },
            { id: 'c2', author: '@Alex',     text: 'The rain scene looks amazing ✨',    time: '45m ago', color: '#e07bbd' },
            { id: 'c3', author: '@Juno',     text: 'Chapter 14 already? Time flies 🔥',  time: '20m ago', color: '#7bc8e0' },
        ]},
        'post-2': { baseLikes: 512, baseComments: [
            { id: 'c4', author: '@jen_borden', text: 'DragonStar forever 🐉❤️',           time: '4h ago', color: '#e07b7b' },
            { id: 'c5', author: '@Sam',        text: 'The colors in this are insane!!',  time: '3h ago', color: '#a0e07b' },
        ]},
        'gp-2':  { baseLikes: 156, baseComments: [
            { id: 'g1', author: '@Rita', text: 'That fight scene!! 🔥🔥', time: '2d ago', color: '#e07b7b' },
        ]},
        'gp-3':  { baseLikes: 89,  baseComments: [
            { id: 'g2', author: '@Sam', text: 'Going back to the beginning 🥺', time: '1mo ago', color: '#a0e07b' },
        ]},
        'jp-2':  { baseLikes: 203, baseComments: [
            { id: 'j1', author: '@Alex', text: 'The origin story is 🤯', time: '6d ago', color: '#e07bbd' },
            { id: 'j2', author: '@Juno', text: 'I love prequel content!!',  time: '5d ago', color: '#7bc8e0' },
        ]},
    };

    function loadPostDB() {
        try { return JSON.parse(localStorage.getItem('comicclub_posts') || '{}'); }
        catch { return {}; }
    }

    function savePostDB(db) {
        localStorage.setItem('comicclub_posts', JSON.stringify(db));
    }

    function getPostData(postId) {
        const db = loadPostDB();
        if (!db[postId]) {
            db[postId] = { likes: {}, extraComments: [] };
            savePostDB(db);
        }
        return db[postId];
    }

    // 좋아요 수 = 기본값 + 내 좋아요 여부
    function getLikeCount(postId, currentUser) {
        const def  = POST_DEFAULTS[postId];
        const data = getPostData(postId);
        const myLike = data.likes[currentUser] ? 1 : 0;
        return def.baseLikes + myLike;
    }

    function isLiked(postId, currentUser) {
        return !!getPostData(postId).likes[currentUser];
    }

    function toggleLike(postId, currentUser) {
        const db   = loadPostDB();
        if (!db[postId]) db[postId] = { likes: {}, extraComments: [] };
        db[postId].likes[currentUser] = !db[postId].likes[currentUser];
        savePostDB(db);
        return db[postId].likes[currentUser];
    }

    function getAllComments(postId) {
        const base  = POST_DEFAULTS[postId].baseComments;
        const extra = getPostData(postId).extraComments || [];
        return [...base, ...extra];
    }

    function addComment(postId, currentUser, text) {
        const db = loadPostDB();
        if (!db[postId]) db[postId] = { likes: {}, extraComments: [] };
        db[postId].extraComments.push({
            id:     'u_' + Date.now(),
            author: '@' + currentUser,
            text,
            time:   'Just now',
            color:  '#f4c542',
        });
        savePostDB(db);
    }

    // ── 피드 렌더 함수 ─────────────────────────────────
    function renderFeedPost(postId) {
        const currentUser = loggedInUser || 'Guest';

        // 좋아요 버튼
        const likeBtn   = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
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
                <div class="comment-avatar" style="background:${c.color}">${c.author.replace('@','').charAt(0).toUpperCase()}</div>
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
        Object.keys(POST_DEFAULTS).forEach(pid => renderFeedPost(pid));
    }

    // ── 상태 ──────────────────────────────────────────
    let hearts = 108;
    let loggedInUser = 'Guest';
    const purchasedItems = new Set();   // 구매한 아이템 이름 목록

    // 선택된 스타일 (적용 전)
    let pendingStyle = { shape: 'circle', badge: 'star', effect: 'none' };
    // 실제 적용된 스타일
    let appliedStyle = { shape: 'circle', badge: 'star', effect: 'none' };

    const badgeEmojis  = { star: '⭐', fire: '🔥', shield: '🛡️', crown: '👑' };

    // ── 화면 전환 ──────────────────────────────────────
    const allScreens = ['feed-screen', 'upload-screen', 'shop-screen', 'profile-screen', 'user-profile-screen'];

    function showScreen(name) {
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
        const map = { feed: 'feed-screen', upload: 'upload-screen', shop: 'shop-screen', profile: 'profile-screen' };
        if (map[name]) document.getElementById(map[name]).classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.target === name);
        });

        if (name === 'profile') renderProfile();
        if (name === 'feed')    initFeed();
    }

    // ── 유저 프로필 화면 (작가별 개인 피드) ───────────────
    function buildPostCardHTML(postId) {
        const content = POSTS_CONTENT[postId];
        const author  = USERS_DATA[content.authorId];
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
            <div class="post-image ${content.imageClass}">
                <div class="post-image-inner">
                    <p class="comic-label">${content.label}</p>
                    <p class="comic-scene">${content.scene}</p>
                </div>
            </div>
            <p class="post-title">${content.title}</p>
            <p class="post-desc">${author.handle} · ${content.desc}</p>
            <div class="post-actions">
                <button class="action-btn like-btn" data-post-id="${postId}">
                    <span class="like-icon">🤍</span><span class="like-count">${POST_DEFAULTS[postId]?.baseLikes ?? 0}</span>
                </button>
                <button class="action-btn comment-toggle-btn" data-post-id="${postId}">
                    💬 <span class="comment-count">${(POST_DEFAULTS[postId]?.baseComments?.length ?? 0)}</span>
                </button>
                <button class="action-btn">↗ Share</button>
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

    function showUserProfile(userId) {
        const user = USERS_DATA[userId];
        if (!user) return;

        // 헤더 정보 채우기
        const avatarEl = document.getElementById('up-avatar-lg');
        avatarEl.textContent   = user.initial;
        avatarEl.style.background = user.color;
        document.getElementById('up-name').textContent      = user.name;
        document.getElementById('up-handle').textContent    = user.handle;
        document.getElementById('up-bio').textContent       = user.bio;
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
        const color   = user ? user.color : '#ffcc00';

        // 아바타 색상 & 이니셜
        const avatarEl = document.getElementById('mpm-avatar');
        avatarEl.textContent      = initial;
        avatarEl.style.background = color;
        avatarEl.style.color      = color === '#ffcc00' ? '#111' : '#fff';
        avatarEl.style.borderColor = color;

        document.getElementById('mpm-name').textContent   = loggedInUser;
        document.getElementById('mpm-handle').textContent = `@${loggedInUser}`;
        document.getElementById('mpm-hearts').textContent = hearts;
        document.getElementById('mpm-items').textContent  = purchasedItems.size;

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
        document.getElementById('balance-display').textContent       = `${hearts} ❤️`;
        document.getElementById('shop-heart-display').textContent    = `${hearts} ❤️`;
        document.getElementById('profile-heart-display').textContent = `${hearts} ❤️`;
        if (document.getElementById('upload-heart-count'))
            document.getElementById('upload-heart-count').textContent = `${hearts} ❤️`;
    }

    // ── 아바타 미리보기 적용 ───────────────────────────
    function applyAvatarStyle(style) {
        const ring  = document.getElementById('avatar-ring');
        const badge = document.getElementById('avatar-badge');

        // 기존 클래스 초기화
        ring.className = 'profile-avatar-ring';

        // Shape
        if (style.shape === 'rounded') ring.classList.add('shape-rounded-ring');
        if (style.shape === 'golden')  ring.classList.add('shape-golden-ring');
        if (style.shape === 'hex')     ring.classList.add('shape-hex-ring');

        // Effect
        if (style.effect === 'dark')   ring.classList.add('effect-dark');
        if (style.effect === 'galaxy') ring.classList.add('effect-galaxy');
        if (style.effect === 'gold')   ring.classList.add('effect-gold');

        // Badge
        badge.textContent = badgeEmojis[style.badge] || '⭐';
    }

    // ── 프로필 화면 렌더 ───────────────────────────────
    function renderProfile() {
        updateHeartDisplays();

        // 클로젯
        const closetEmpty = document.getElementById('closet-empty');
        const closetList  = document.getElementById('closet-list');
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
    }

    // ── 클릭 이벤트 통합 처리 ─────────────────────────
    document.addEventListener('click', (e) => {

        // 하단 네비
        const navItem = e.target.closest('.nav-item[data-target]');
        if (navItem) {
            const target = navItem.dataset.target;
            if (['feed', 'upload', 'shop', 'profile'].includes(target)) showScreen(target);
        }

        // 구매 버튼
        const buyBtn = e.target.closest('.buy-btn');
        if (buyBtn) {
            const card  = buyBtn.closest('[data-price]');
            if (!card) return;
            const price = parseInt(card.dataset.price);
            const name  = card.dataset.name;
            if (purchasedItems.has(name)) {
                alert(`You already own "${name}"!`);
            } else if (hearts < price) {
                alert(`Not enough hearts! You need ❤️ ${price} but have ❤️ ${hearts}.`);
            } else {
                hearts -= price;
                purchasedItems.add(name);
                updateHeartDisplays();
                alert(`✅ Purchased "${name}"! Remaining: ❤️ ${hearts}`);
            }
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
        }

        // Apply Style 버튼
        if (e.target.closest('#apply-style-btn')) {
            appliedStyle = { ...pendingStyle };
            applyAvatarStyle(appliedStyle);
            const btn = document.getElementById('apply-style-btn');
            btn.textContent = '✅ Applied!';
            setTimeout(() => { btn.textContent = '✓ Apply Style'; }, 1500);
        }

        // ── 좋아요 버튼 ──────────────────────────────────
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const postId = likeBtn.dataset.postId;
            const user   = loggedInUser || 'Guest';

            // Optimistic UI: 즉시 반영
            const wasLiked = isLiked(postId, user);
            const countEl  = likeBtn.querySelector('.like-count');
            const iconEl   = likeBtn.querySelector('.like-icon');
            const newLiked = !wasLiked;
            countEl.textContent = parseInt(countEl.textContent) + (newLiked ? 1 : -1);
            iconEl.textContent  = newLiked ? '❤️' : '🤍';
            likeBtn.classList.toggle('liked', newLiked);

            // 팝 애니메이션
            likeBtn.classList.remove('pop');
            void likeBtn.offsetWidth; // reflow
            likeBtn.classList.add('pop');

            // localStorage 동기화
            toggleLike(postId, user);
        }

        // ── 댓글 토글 버튼 ───────────────────────────────
        const commentToggleBtn = e.target.closest('.comment-toggle-btn');
        if (commentToggleBtn) {
            const postId  = commentToggleBtn.dataset.postId;
            const section = document.getElementById(`comments-${postId}`);
            const isOpen  = section.classList.toggle('open');
            if (isOpen) renderCommentList(postId);
        }

        // ── 댓글 게시 버튼 ───────────────────────────────
        const submitBtn = e.target.closest('.comment-submit');
        if (submitBtn) {
            const postId = submitBtn.dataset.postId;
            const input  = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
            const text   = input.value.trim();
            if (!text) return;

            addComment(postId, loggedInUser || 'Guest', text);
            input.value = '';
            renderCommentList(postId);

            // 댓글 수 업데이트
            const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
            if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = getAllComments(postId).length;
        }

        // ── 스토리 아바타 클릭 → 유저 프로필 ────────────────
        const storyItem = e.target.closest('.story-item[data-user-id]');
        if (storyItem) showUserProfile(storyItem.dataset.userId);

        // ── 포스트 작성자 클릭 → 유저 프로필 ────────────────
        const postUser = e.target.closest('.post-user[data-user-id]');
        if (postUser) showUserProfile(postUser.dataset.userId);

        // ── 유저 프로필 Back 버튼 → 피드 ────────────────────
        if (e.target.closest('#up-back-btn')) showScreen('feed');

        // Shop More (프로필 → 상점)
        if (e.target.closest('#go-shop-from-profile')) showScreen('shop');

        // Logout (프로필 화면 버튼 & 내 프로필 모달 버튼 공통)
        if (e.target.closest('#logout-btn') || e.target.closest('#mpm-logout-btn')) {
            doLogout();
        }
    });

    function updateAllAvatarBtns(initial, color) {
        ['feed-avatar-btn', 'upload-avatar-btn', 'shop-avatar-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.textContent       = initial;
            btn.style.background  = color;
            btn.style.borderColor = color;
            btn.style.color       = color === '#ffcc00' ? '#111' : '#fff';
        });
    }

    function doLogout() {
        closeMyProfileModal();
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
        loginModal.classList.remove('hidden');
        // 인증 정보 + 상태 전부 초기화
        hearts = 108;
        loggedInUser = 'Guest';
        purchasedItems.clear();
        pendingStyle = { shape: 'circle', badge: 'star', effect: 'none' };
        appliedStyle = { shape: 'circle', badge: 'star', effect: 'none' };
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
    const USERS_DB = {
        'kevin': { id: 'Kevin', pwd: 'acccng', name: 'Kevin' },
        'admin': { id: 'admin', pwd: 'admin', name: 'Admin User' },
        'test':  { id: 'test', pwd: 'test', name: 'Test User' },
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
        checkIdBtn.addEventListener('click', () => {
            const idValue = signupId.value.trim();
            if (!idValue) {
                idCheckMsg.textContent = '아이디를 입력해주세요.';
                idCheckMsg.className = 'check-msg error';
                return;
            }
            if (USERS_DB[idValue.toLowerCase()]) {
                idCheckMsg.textContent = '이미 사용 중인 아이디입니다.';
                idCheckMsg.className = 'check-msg error';
                isIdChecked = false;
            } else {
                idCheckMsg.textContent = '사용 가능한 아이디입니다.';
                idCheckMsg.className = 'check-msg success';
                isIdChecked = true;
            }
        });
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id  = document.getElementById('email').value.trim();
        const pwd = document.getElementById('password').value;
        
        const user = USERS_DB[id.toLowerCase()];

        if (user && user.pwd === pwd) {
            loginModal.classList.add('hidden');
            loginForm.reset();
            loggedInUser = user.name;

            // 로그인 유저 정보로 UI 업데이트
            const profileNameEl = document.querySelector('.profile-name');
            if (profileNameEl) profileNameEl.textContent = user.name;

            const initial  = user.name.charAt(0).toUpperCase();
            const userData = USERS_DATA[user.name.toLowerCase()];
            const color    = userData ? userData.color : '#ffcc00';
            const avatarEmojiEl = document.getElementById('avatar-emoji');
            if (avatarEmojiEl) avatarEmojiEl.textContent = initial;
            updateAllAvatarBtns(initial, color);

            showScreen('upload');
        } else {
            alert('아이디가 존재하지 않거나 비밀번호가 일치하지 않습니다.');
        }
    });

    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
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
            
            // DB에 새 유저 정보 저장
            USERS_DB[newId.toLowerCase()] = {
                id: newId,
                pwd: pwd,
                name: newName
            };
            
            alert(`회원가입이 완료되었습니다!\n환영합니다, ${newName}님.\n이제 가입하신 계정으로 로그인 해주세요.`);
            toggleAuthMode(false);
        });
    }

    // ── 업로드 화면 ───────────────────────────────────
    const dropZone  = document.getElementById('drop-zone');
    const panelInput = document.getElementById('panel-input');
    dropZone.addEventListener('click', () => panelInput.click());
    dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.style.borderColor = '#ffcc00'; });
    dropZone.addEventListener('dragleave', ()  => { dropZone.style.borderColor = '#ccc'; });
    dropZone.addEventListener('drop',      (e) => { e.preventDefault(); dropZone.style.borderColor = '#ccc'; });
    document.getElementById('thumb-add-btn').addEventListener('click', () => panelInput.click());

    const descArea  = document.getElementById('desc-area');
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
        const text   = input.value.trim();
        if (!text) return;
        addComment(postId, loggedInUser || 'Guest', text);
        input.value = '';
        renderCommentList(postId);
        const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
        if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = getAllComments(postId).length;
    });
});

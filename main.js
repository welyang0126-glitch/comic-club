document.addEventListener('DOMContentLoaded', () => {
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

    async function loadBackendData() {
        try {
            const [usersRes, postsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/posts')
            ]);
            USERS_DATA = await usersRes.json();
            USERS_DB = USERS_DATA; 
            POSTS_CONTENT = await postsRes.json();

            // 커스텀 포스트(서버 저장된) 피드 주입
            const feedBody = document.querySelector('.feed-body');
            const customPosts = Object.keys(POSTS_CONTENT).filter(id => POSTS_CONTENT[id].imageClass === 'custom-upload');
            if (feedBody && customPosts.length > 0) {
                const htmls = customPosts.map(buildPostCardHTML);
                const storyStrip = feedBody.querySelector('.story-strip');
                if (storyStrip) {
                    storyStrip.insertAdjacentHTML('afterend', htmls.join(''));
                }
            }

            initFeed();
        } catch(e) {
            console.error('백엔드 연동 실패:', e);
        }
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
                <div class="comment-avatar" style="background:${c.color}">${c.author.replace('@', '').charAt(0).toUpperCase()}</div>
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
    let pendingStyle = { shape: 'circle', badge: 'star', effect: 'none' };
    // 실제 적용된 스타일
    let appliedStyle = { shape: 'circle', badge: 'star', effect: 'none' };

    const badgeEmojis = { star: '⭐', fire: '🔥', shield: '🛡️', crown: '👑' };

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
            <div class="post-image ${content.imageClass}" ${content.imageUrl ? `style="background-image: url(${content.imageUrl}); background-size: cover; background-position: center; cursor: pointer;"` : 'style="cursor: pointer;"'} data-webtoon-trigger="${postId}">
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

        // 아바타 색상 & 이니셜
        const avatarEl = document.getElementById('mpm-avatar');
        avatarEl.textContent = initial;
        avatarEl.style.background = color;
        avatarEl.style.color = color === '#ffcc00' ? '#111' : '#fff';
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

    // ── 아바타 미리보기 적용 ───────────────────────────
    function applyAvatarStyle(style) {
        const ring = document.getElementById('avatar-ring');
        const badge = document.getElementById('avatar-badge');

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
            const card = buyBtn.closest('[data-price]');
            if (!card) return;
            const price = parseInt(card.dataset.price);
            const name = card.dataset.name;
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

            addComment(postId, loggedInUser || 'Guest', text);
            input.value = '';
            renderCommentList(postId);

            // 댓글 수 업데이트
            const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
            if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = getAllComments(postId).length;
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

        // Logout (프로필 화면 버튼 & 내 프로필 모달 버튼 공통)
        if (e.target.closest('#logout-btn') || e.target.closest('#mpm-logout-btn')) {
            doLogout();
        }
    });

    function updateAllAvatarBtns(initial, color) {
        ['feed-avatar-btn', 'upload-avatar-btn', 'shop-avatar-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.textContent = initial;
            btn.style.background = color;
            btn.style.borderColor = color;
            btn.style.color = color === '#ffcc00' ? '#111' : '#fff';
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
        const id = document.getElementById('email').value.trim();
        const pwd = document.getElementById('password').value;

        const user = USERS_DB[id.toLowerCase()];

        if (user && user.pwd === pwd) {
            loginModal.classList.add('hidden');
            loginForm.reset();
            loggedInUser = user.name;

            // 로그인 유저 정보로 UI 업데이트
            const profileNameEl = document.querySelector('.profile-name');
            if (profileNameEl) profileNameEl.textContent = user.name;

            const initial = user.name.charAt(0).toUpperCase();
            const userData = USERS_DATA[user.name.toLowerCase()];
            const color = userData ? userData.color : '#ffcc00';
            const avatarEmojiEl = document.getElementById('avatar-emoji');
            if (avatarEmojiEl) avatarEmojiEl.textContent = initial;
            updateAllAvatarBtns(initial, color);

            showScreen('upload');
        } else {
            alert('아이디가 존재하지 않거나 비밀번호가 일치하지 않습니다.');
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

    const renderThumbnails = () => {
        // 기존 썸네일(미리보기, 플레이스홀더) 제거
        const existingThumbs = thumbnailStrip.querySelectorAll('.thumb-preview, .thumb-placeholder');
        existingThumbs.forEach(el => el.remove());

        // 업로드된 이미지 썸네일 새로 추가
        uploadedImages.forEach((dataUrl) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb-preview';
            thumb.style.width = '56px';
            thumb.style.height = '56px';
            thumb.style.borderRadius = '8px';
            thumb.style.backgroundImage = `url(${dataUrl})`;
            thumb.style.backgroundSize = 'cover';
            thumb.style.backgroundPosition = 'center';
            thumb.style.flexShrink = '0';
            thumb.style.cursor = 'pointer';
            
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
    };

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

    // 업로드 완료 처리
    const uploadBtn = document.querySelector('.upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', async () => {
            if (uploadedFiles.length === 0) {
                alert('사진을 먼저 업로드해주세요!');
                return;
            }
            const titleInput = document.querySelector('.field-input').value.trim();
            const descInput = document.getElementById('desc-area').value.trim();

            if (!titleInput) {
                alert('제목을 입력해주세요.');
                return;
            }

            const currentUser = loggedInUser || 'Guest';
            
            const formData = new FormData();
            formData.append('title', titleInput);
            formData.append('desc', descInput);
            formData.append('authorId', currentUser);
            uploadedFiles.forEach(file => formData.append('images', file));

            uploadBtn.textContent = 'Uploading...';
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
                    const storyStrip = feedBody ? feedBody.querySelector('.story-strip') : null;
                    if (storyStrip) {
                        storyStrip.insertAdjacentHTML('afterend', buildPostCardHTML(newPostId));
                        renderFeedPost(newPostId);
                    }

                    alert('업로드 완료! 피드와 프로필에 성공적으로 저장되었습니다.');

                    // 폼 초기화
                    uploadedImages = [];
                    uploadedFiles = [];
                    renderThumbnails();
                    document.querySelector('.field-input').value = '';
                    document.getElementById('desc-area').value = '';
                    document.getElementById('char-count').textContent = '0 / 240 characters';

                    // 메인 화면으로 돌아가기
                    showScreen('feed');
                } else {
                    alert('업로드에 실패했습니다.');
                }
            } catch(e) {
                console.error('업로드 실패', e);
            } finally {
                uploadBtn.textContent = '⬆ Upload Comic';
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
});

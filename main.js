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

    // ── 상태 ──────────────────────────────────────────
    let hearts = 108;
    const purchasedItems = new Set();   // 구매한 아이템 이름 목록

    // 선택된 스타일 (적용 전)
    let pendingStyle = { shape: 'circle', badge: 'star', effect: 'none' };
    // 실제 적용된 스타일
    let appliedStyle = { shape: 'circle', badge: 'star', effect: 'none' };

    const badgeEmojis  = { star: '⭐', fire: '🔥', shield: '🛡️', crown: '👑' };

    // ── 화면 전환 ──────────────────────────────────────
    const allScreens = ['feed-screen', 'upload-screen', 'shop-screen', 'profile-screen'];

    function showScreen(name) {
        allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
        const map = { feed: 'feed-screen', upload: 'upload-screen', shop: 'shop-screen', profile: 'profile-screen' };
        if (map[name]) document.getElementById(map[name]).classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.target === name);
        });

        if (name === 'profile') renderProfile();
    }

    // ── 하트 표시 업데이트 ─────────────────────────────
    function updateHeartDisplays() {
        document.getElementById('balance-display').textContent       = `${hearts} ❤️`;
        document.getElementById('shop-heart-display').textContent    = `${hearts} ❤️`;
        document.getElementById('profile-heart-display').textContent = `${hearts} ❤️`;
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

        // Shop More (프로필 → 상점)
        if (e.target.closest('#go-shop-from-profile')) showScreen('shop');

        // Logout
        if (e.target.closest('#logout-btn')) {
            allScreens.forEach(id => document.getElementById(id).classList.add('hidden'));
            loginModal.classList.remove('hidden');
            // 상태 초기화
            hearts = 108;
            purchasedItems.clear();
            pendingStyle  = { shape: 'circle', badge: 'star', effect: 'none' };
            appliedStyle  = { shape: 'circle', badge: 'star', effect: 'none' };
        }
    });

    // ── 로그인 ────────────────────────────────────────
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id  = document.getElementById('email').value;
        const pwd = document.getElementById('password').value;
        if (id === 'Kevin' && pwd === 'acccng') {
            loginModal.classList.add('hidden');
            loginForm.reset();
            showScreen('upload');
        } else {
            alert('Incorrect ID or password.');
        }
    });

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
});

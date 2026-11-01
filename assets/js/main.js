// assets/js/main.js
document.addEventListener('DOMContentLoaded', function() {
    // 移动端菜单切换（静态导航页；gist 渲染的导航由 gist-renderer.js 自己处理）
    initStaticMobileMenu();

    // 滚动时改变导航栏阴影
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (header && window.scrollY > 50) {
            header.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
        } else if (header) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
        }
    });

    // 平滑滚动（可选）
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// 静态头部导航的移动端菜单（button + aria-expanded）
function initStaticMobileMenu() {
    document.querySelectorAll('.mobile-menu-btn').forEach(function(btn) {
        // gist-renderer 生成的导航自带菜单逻辑，避免重复绑定
        if (btn.closest('#navbar-container') || btn.dataset.menuInit === '1') return;

        var nav = btn.parentElement ? btn.parentElement.querySelector('.nav-links') : null;
        if (!nav) return;

        btn.dataset.menuInit = '1';

        function closeMenu() {
            nav.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
            var icon = btn.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
        }

        btn.addEventListener('click', function() {
            var open = nav.classList.toggle('active');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            var icon = btn.querySelector('i');
            if (icon) icon.className = open ? 'fas fa-times' : 'fas fa-bars';
        });

        nav.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' && nav.classList.contains('active')) {
                closeMenu();
            }
        });
    });
}

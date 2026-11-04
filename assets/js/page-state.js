/* 全站页面状态：读取同源 data/pages.json（由页面管理保存时提交到仓库并部署），
   应用启用状态与布局模板。Gist raw 有 5 分钟 CDN 缓存且本机网络可能无法直连
   api.github.com，因此前台不依赖 Gist/API；同源文件随 Pages 部署一起更新。 */
(function () {
    'use strict';
    document.documentElement.classList.add('page-state-checking');

    var STATE_URL = '/data/pages.json';
    var CACHE_KEY = 'zcfi:pages-state:v2';
    var CACHE_MAX_AGE = 10 * 60 * 1000;
    var PAGE_NAMES = {
        home: '首页',
        blog: '博客',
        portfolio: '作品集',
        contact: '联系我',
        privacy: '隐私政策',
        terms: '使用条款',
        copyright: '版权声明',
        notfound: '404 页面'
    };

    function pageKey() {
        if (document.body && document.body.getAttribute('data-page-key')) {
            return document.body.getAttribute('data-page-key');
        }
        var path = location.pathname.replace(/\/index\.html$/i, '/');
        // GitHub Pages 同时支持 /copyright 和 /copyright.html；统一成无扩展名再匹配
        path = path.replace(/\.html$/i, '');
        if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
        if (path === '/' || path === '/index') return 'home';
        var map = {
            '/blog': 'blog',
            '/portfolio': 'portfolio',
            '/contact': 'contact',
            '/privacy': 'privacy',
            '/terms': 'terms',
            '/copyright': 'copyright',
            '/404': 'notfound'
        };
        return map[path] || '';
    }

    function readCache() {
        try {
            var raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
            if (!raw || !raw.data || !raw.time || Date.now() - raw.time > CACHE_MAX_AGE) return null;
            return raw.data;
        } catch (e) {
            return null;
        }
    }

    function writeCache(raw) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: raw }));
        } catch (e) {}
    }

    function finishCheck() {
        document.documentElement.classList.remove('page-state-checking');
        window.__pageStateReady = true;
    }

    function applyTemplate(template) {
        document.body.classList.remove('page-template-minimal', 'page-template-wide');
        if (template === 'minimal' || template === 'wide') {
            document.body.classList.add('page-template-' + template);
        }
    }

    function removeDisabled() {
        var overlay = document.getElementById('pageStateOverlay');
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.body.classList.remove('page-state-disabled');
    }

    function showDisabled(key) {
        if (document.getElementById('pageStateOverlay')) return;
        var name = PAGE_NAMES[key] || '页面';
        var overlay = document.createElement('div');
        overlay.id = 'pageStateOverlay';
        overlay.className = 'page-state-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-label', name + '维护中');
        overlay.innerHTML =
            '<div class="page-state-card">' +
                '<span class="page-state-badge">页面维护中</span>' +
                '<h1>' + name + '暂时无法访问</h1>' +
                '<p>这个页面正在调整或维护，请稍后再来。你也可以先返回首页，或通过联系页留言。</p>' +
                '<div class="page-state-actions">' +
                    '<a class="primary" href="/">返回首页</a>' +
                    '<a href="/contact.html">联系我</a>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        document.body.classList.add('page-state-disabled');
    }

    function apply(raw) {
        if (!raw || !raw.pages || typeof raw.pages !== 'object') { finishCheck(); return; }
        var key = pageKey();
        if (!key) { finishCheck(); return; }
        var cfg = raw.pages[key];
        if (!cfg || typeof cfg !== 'object') { finishCheck(); return; }
        applyTemplate(cfg.template);
        if (cfg.enabled === false) {
            showDisabled(key);
        } else {
            removeDisabled();
        }
        finishCheck();
    }

    function load() {
        if (!pageKey()) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

        var controller = null;
        var timer = null;
        try {
            controller = window.AbortController ? new AbortController() : null;
            if (controller) timer = setTimeout(function () { controller.abort(); }, 4500);
            fetch(STATE_URL + '?t=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function (raw) {
                writeCache(raw);
                apply(raw);
            }).catch(function () {
                // 同源文件异常时使用本会话最后一次成功结果；仍没有则保持原页面
                var cached = readCache();
                if (cached) apply(cached); else finishCheck();
            }).finally(function () {
                if (timer) clearTimeout(timer);
            });
        } catch (e) {
            if (timer) clearTimeout(timer);
            var cached2 = readCache();
            if (cached2) apply(cached2); else finishCheck();
        }
    }

    // 打开页面时应用；切回标签页时刷新一次
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) load();
    });

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) load();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();

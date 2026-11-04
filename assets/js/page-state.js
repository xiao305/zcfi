/* 全站页面状态：读取 Config Gist 的 pages.json，应用启用状态与布局模板。
   优先走 GitHub API（Gist raw 有 5 分钟 CDN 缓存，后台保存后不能及时生效）；
   API 失败时使用本会话最后一次成功结果；仍失败则 fail-open，不改变页面。 */
(function () {
    'use strict';

    var CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
    var API_URL = 'https://api.github.com/gists/' + CONFIG_GIST_ID;
    var CACHE_KEY = 'zcfi:pages-state:v1';
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
        if (path === '/' || path === '/index.html') return 'home';
        var map = {
            '/blog.html': 'blog',
            '/portfolio.html': 'portfolio',
            '/contact.html': 'contact',
            '/privacy.html': 'privacy',
            '/terms.html': 'terms',
            '/copyright.html': 'copyright',
            '/404.html': 'notfound'
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
        if (!raw || !raw.pages || typeof raw.pages !== 'object') return;
        var key = pageKey();
        if (!key) return;
        var cfg = raw.pages[key];
        if (!cfg || typeof cfg !== 'object') return;
        applyTemplate(cfg.template);
        if (cfg.enabled === false) {
            showDisabled(key);
        } else {
            removeDisabled();
        }
    }

    function load() {
        if (!pageKey()) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

        var controller = null;
        var timer = null;
        try {
            controller = window.AbortController ? new AbortController() : null;
            if (controller) timer = setTimeout(function () { controller.abort(); }, 5000);
            fetch(API_URL + '?t=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/vnd.github+json' },
                signal: controller ? controller.signal : undefined
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function (gist) {
                if (!gist.files || !gist.files['pages.json'] || !gist.files['pages.json'].content) {
                    throw new Error('pages.json missing');
                }
                var raw = JSON.parse(gist.files['pages.json'].content);
                writeCache(raw);
                apply(raw);
            }).catch(function () {
                // API 失败（限流/网络）时只用本会话最后一次成功结果；没有就保持原页面
                var cached = readCache();
                if (cached) apply(cached);
            }).finally(function () {
                if (timer) clearTimeout(timer);
            });
        } catch (e) {
            if (timer) clearTimeout(timer);
            var cached2 = readCache();
            if (cached2) apply(cached2);
        }
    }

    // 打开页面时应用；切回标签页时刷新一次，避免看到旧状态
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) load();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();

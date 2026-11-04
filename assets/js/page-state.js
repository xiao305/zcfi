/* 全站页面状态：读取 Config Gist 的 pages.json，应用启用状态与布局模板。
   失败时保持页面原样（fail-open），避免 Gist/网络问题导致站点不可用。 */
(function () {
    'use strict';

    var CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
    var RAW_URL = 'https://gist.githubusercontent.com/xiao305/' + CONFIG_GIST_ID + '/raw/pages.json';
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
    var TEMPLATES = { default: 1, minimal: 1, wide: 1 };

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

    function applyTemplate(template) {
        document.body.classList.remove('page-template-minimal', 'page-template-wide');
        if (template === 'minimal' || template === 'wide') {
            document.body.classList.add('page-template-' + template);
        }
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
        if (cfg.enabled === false) showDisabled(key);
    }

    function load() {
        if (!pageKey()) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        var controller = null;
        var timer = null;
        try {
            controller = window.AbortController ? new AbortController() : null;
            if (controller) timer = setTimeout(function () { controller.abort(); }, 4500);
            fetch(RAW_URL + '?t=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function (raw) {
                apply(raw);
            }).catch(function () {
                /* fail-open：读取失败不改变页面 */
            }).finally(function () {
                if (timer) clearTimeout(timer);
            });
        } catch (e) {
            if (timer) clearTimeout(timer);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();

/* 博客文章页权限：前端强制校验 Gist 的 pages.json。
   禁用时替换整个 .article-container（文章标题/正文/操作区都移除），
   只保留页眉和页脚，行为与合并前版权/隐私页的 showDisabledMessage 一致。 */
(function () {
    'use strict';
    document.documentElement.classList.add('article-state-checking');

    var CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
    var GIST_API = 'https://api.github.com/gists/' + CONFIG_GIST_ID;
    var GIST_RAW = 'https://gist.githubusercontent.com/xiao305/' + CONFIG_GIST_ID + '/raw/pages.json';
    var STATE_URL = '/data/pages.json';

    var m = location.pathname.match(/\/blogs\/([^/]+?)(?:\.html)?$/i);
    if (!m) return;
    var articleId = decodeURIComponent(m[1]);
    if (!articleId || articleId === 'template') return;

    function finishCheck() {
        document.documentElement.classList.remove('article-state-checking');
        window.__articleStateReady = true;
    }

    function escapeHtml(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function accessBadge(enabled) {
        return '<span class="article-access-badge ' + (enabled ? 'is-on' : 'is-off') + '">' +
            (enabled ? '展示中' : '维护中') + '</span>';
    }

    function unavailableMarkup(labelMode, title) {
        var name = labelMode === 'title' ? (title || '') : (labelMode === 'id' ? articleId : '');
        var detail = name ? name + '页面当前已被管理员禁用。' : '该文章页面当前已被管理员禁用。';
        return '<h1 class="article-title article-unavailable-title">页面不可用</h1>' +
            '<div class="error-message article-unavailable article-unavailable-legal">' +
                '<p><i class="fas fa-eye-slash"></i> 该文章暂时不可用</p>' +
                '<p class="article-unavailable-detail">' + escapeHtml(detail) + '</p>' +
                '<p class="article-unavailable-status">状态：已发布 ' + accessBadge(false) + '</p>' +
                '<a class="article-unavailable-link" href="../blog"><i class="fas fa-arrow-left"></i> 返回博客列表</a>' +
            '</div>';
    }

    function findStatus() {
        return document.querySelector('.article-meta .page-status');
    }

    function addAccessBadge(enabled) {
        var status = findStatus();
        if (!status) return;
        var old = document.querySelector('.article-access-badge');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var badge = document.createElement('span');
        badge.className = 'article-access-badge ' + (enabled ? 'is-on' : 'is-off');
        badge.textContent = enabled ? '展示中' : '维护中';
        status.parentNode.insertBefore(badge, status.nextSibling);
    }

    function showUnavailable(cfg) {
        var container = document.querySelector('.article-container');
        if (!container) container = document.querySelector('.article-content');
        if (!container) return;
        var titleEl = document.querySelector('.article-title');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var labelMode = cfg.labelMode || 'title';
        container.innerHTML = unavailableMarkup(labelMode, title);
        document.title = '页面不可用 | zcfi.cn';
        finishCheck();
    }

    function showConfigError() {
        var container = document.querySelector('.article-container');
        if (!container) return;
        container.innerHTML = '<h1 class="article-title article-unavailable-title">页面不可用</h1>' +
            '<div class="error-message article-unavailable article-unavailable-legal">' +
            '<p><i class="fas fa-exclamation-triangle"></i> 无法加载文章配置</p>' +
            '<p class="article-unavailable-detail">请检查网络后刷新页面。</p></div>';
        finishCheck();
    }

    function apply(raw) {
        var cfg = raw && raw.articles && raw.articles.blog && raw.articles.blog[articleId];
        // 没有配置时按公开处理；有配置时严格按 enabled 执行
        var enabled = !cfg || cfg.enabled !== false;
        addAccessBadge(enabled);
        if (!enabled) showUnavailable(cfg || {});
        finishCheck();
    }

    function parseGist(gist) {
        if (!gist || !gist.files || !gist.files['pages.json'] || !gist.files['pages.json'].content) {
            throw new Error('pages.json missing');
        }
        return JSON.parse(gist.files['pages.json'].content);
    }

    function loadConfig() {
        // 1) Gist API：写入后立即读取，最接近“同步 Gist 即刻生效”
        return fetch(GIST_API + '?t=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Accept': 'application/vnd.github+json' }
        }).then(function (res) {
            if (!res.ok) throw new Error('gist api ' + res.status);
            return res.json();
        }).then(parseGist).catch(function () {
            // 2) Gist raw 兜底
            return fetch(GIST_RAW + '?t=' + Date.now(), { cache: 'no-store' })
                .then(function (res) {
                    if (!res.ok) throw new Error('gist raw ' + res.status);
                    return res.json();
                });
        }).catch(function () {
            // 3) 同源部署文件兜底（仍然来自同一份 pages.json）
            return fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' })
                .then(function (res) {
                    if (!res.ok) throw new Error('state ' + res.status);
                    return res.json();
                });
        });
    }

    function start() {
        loadConfig().then(apply).catch(function (e) {
            console.warn('文章权限校验失败:', e);
            showConfigError();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();

/* 博客文章页权限：读取同源 data/pages.json 的 articles.blog.<id>；
   只替换文章正文区域，页眉/页脚/标题保持原样。 */
(function () {
    'use strict';

    var m = location.pathname.match(/\/blogs\/([^/]+)\.html$/i);
    if (!m) return;
    var articleId = decodeURIComponent(m[1]);
    if (!articleId || articleId === 'template') return;

    function messageFor(labelMode, title) {
        var name = labelMode === 'title' ? (title || '') : (labelMode === 'id' ? articleId : '');
        return name ? name + '暂时无法访问' : '暂时无法访问';
    }

    function markup(template, message) {
        if (template === 'article-card') {
            return '<div class="article-state-card"><span class="article-state-icon">!</span>' +
                '<span class="article-state-badge">文章维护中</span>' +
                '<h2>' + escapeHtml(message) + '</h2>' +
                '<p>这篇文章正在调整或维护，请稍后再来。</p>' +
                '<div class="article-state-actions"><a href="../blog.html">返回博客列表</a></div></div>';
        }
        if (template === 'article-minimal') {
            return '<div class="article-state-minimal"><h2>' + escapeHtml(message) + '</h2>' +
                '<p>内容暂时不可用，请稍后重试。</p>' +
                '<a href="../blog.html">返回博客列表 →</a></div>';
        }
        return '<div class="article-state-card"><span class="article-state-icon">!</span>' +
            '<h2>页面不可用</h2>' +
            '<p>该文章暂时不可用</p>' +
            '<p class="article-state-muted">' + escapeHtml(message) + '。</p>' +
            '<div class="article-state-actions"><a href="../blog.html">返回博客列表</a></div></div>';
    }

    function escapeHtml(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function apply(raw) {
        var cfg = raw && raw.articles && raw.articles.blog && raw.articles.blog[articleId];
        if (!cfg || cfg.enabled !== false) return;
        var content = document.querySelector('.article-content');
        if (!content) return;
        var titleEl = document.querySelector('.article-title');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var template = cfg.maintenanceTemplate || 'article-legal';
        var labelMode = cfg.labelMode || 'title';
        content.innerHTML = markup(template, messageFor(labelMode, title));
        content.classList.add('article-state-blocked');
    }

    function load() {
        fetch('/data/pages.json?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(apply)
            .catch(function () { /* fail-open：保持文章正常显示 */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();

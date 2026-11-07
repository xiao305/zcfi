/*!
 * article-enhance.js — 文章页阅读增强（纯静态）
 * 功能：阅读进度条、自动目录、阅读时长、上一篇/下一篇、相关文章、分享
 * 依赖：site-data.js
 */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function esc(s) {
        return window.SiteData.escapeHtml(s);
    }

    function init() {
        var content = document.querySelector('.article-content');
        if (!content) return;
        // 模板页的占位符内容不处理
        if ((content.textContent || '').indexOf('{{') !== -1) return;

        var titleEl = document.querySelector('.article-title') || document.querySelector('main h1');
        var articleBox = content.closest('.article-container, .article-card, article, .article') || content.parentElement;

        buildProgress();
        buildToc(content, articleBox);
        addReadingTime(content, titleEl);
        enhanceAdjacentAndRelated(content, articleBox, titleEl);
        buildShare(articleBox);
    }

    function buildProgress() {
        var bar = document.createElement('div');
        bar.className = 'article-progress';
        bar.innerHTML = '<span></span>';
        document.body.appendChild(bar);
        var fill = bar.firstChild;
        function update() {
            var doc = document.documentElement;
            var max = (doc.scrollHeight - window.innerHeight) || 1;
            var pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
            fill.style.width = pct + '%';
        }
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    function buildToc(content, articleBox) {
        var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3, h4'));
        if (headings.length < 2) return;

        var toc = document.createElement('details');
        toc.className = 'article-toc';
        toc.open = true;
        var items = headings.map(function (h, i) {
            var id = h.id || ('article-h-' + (i + 1));
            h.id = id;
            var level = h.tagName.toLowerCase();
            return '<li class="toc-' + level + '"><a href="#' + id + '">' + esc(h.textContent.trim()) + '</a></li>';
        }).join('');
        toc.innerHTML = '<summary><i class="fas fa-list" aria-hidden="true"></i> 文章目录</summary><ol>' + items + '</ol>';
        articleBox.insertBefore(toc, content);
    }

    function addReadingTime(content, titleEl) {
        var text = content.textContent || '';
        var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        var latin = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
        var minutes = Math.max(1, Math.ceil(cjk / 400 + latin / 220));

        var meta = document.querySelector('.article-meta');
        if (meta) {
            var item = document.createElement('div');
            item.className = 'article-meta-item article-reading-time';
            item.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i><span>阅读约 ' + minutes + ' 分钟</span>';
            meta.appendChild(item);
        } else if (titleEl) {
            var line = document.createElement('p');
            line.className = 'article-reading-line';
            line.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> 阅读约 ' + minutes + ' 分钟';
            titleEl.insertAdjacentElement('afterend', line);
        }
    }

    function currentPostId() {
        var m = window.location.pathname.match(/\/blogs\/([^\/.]+?)(?:\.html)?$/);
        if (!m) return '';
        var id = decodeURIComponent(m[1]);
        if (id === 'template' || id === 'post') return '';
        return id;
    }

    function enhanceAdjacentAndRelated(content, articleBox, titleEl) {
        var id = currentPostId();
        if (!id || !window.SiteData) return;

        window.SiteData.load().then(function (data) {
            var posts = window.SiteData.publishedPosts(data.blog)
                .slice()
                .sort(function (a, b) { return window.SiteData.postTimestamp(b) - window.SiteData.postTimestamp(a); });
            var index = -1;
            for (var i = 0; i < posts.length; i++) {
                if (posts[i].id === id) { index = i; break; }
            }
            if (index === -1) return;

            var current = posts[index];
            var newer = index > 0 ? posts[index - 1] : null;
            var older = index < posts.length - 1 ? posts[index + 1] : null;
            var currentTags = (current.tags || []).map(function (t) { return String(t).toLowerCase(); });

            var related = posts.filter(function (p, i) {
                if (i === index) return false;
                var tags = (p.tags || []).map(function (t) { return String(t).toLowerCase(); });
                return tags.some(function (t) { return currentTags.indexOf(t) !== -1; });
            }).slice(0, 3);

            var html = '';
            if (newer || older) {
                html += '<nav class="article-adjacent" aria-label="文章导航">';
                html += newer
                    ? '<a class="adjacent-item adjacent-prev" href="' + esc(window.SiteData.postHref(newer)) + '"><span class="adjacent-label"><i class="fas fa-arrow-left" aria-hidden="true"></i> 上一篇</span><span class="adjacent-title">' + esc(newer.title || '') + '</span></a>'
                    : '<span class="adjacent-item is-empty"></span>';
                html += older
                    ? '<a class="adjacent-item adjacent-next" href="' + esc(window.SiteData.postHref(older)) + '"><span class="adjacent-label">下一篇 <i class="fas fa-arrow-right" aria-hidden="true"></i></span><span class="adjacent-title">' + esc(older.title || '') + '</span></a>'
                    : '<span class="adjacent-item is-empty"></span>';
                html += '</nav>';
            }

            if (related.length) {
                html += '<section class="article-related"><h2 class="article-related-title"><i class="fas fa-tags" aria-hidden="true"></i> 相关文章</h2><ul>';
                related.forEach(function (p) {
                    html += '<li><a href="' + esc(window.SiteData.postHref(p)) + '">' + esc(p.title || '') + '</a><span>' + esc(p.date || p.lastUpdated || '') + '</span></li>';
                });
                html += '</ul></section>';
            }

            if (!html) return;
            var anchor = articleBox.querySelector('.article-actions');
            var holder = document.createElement('div');
            holder.className = 'article-enhance-extra';
            holder.innerHTML = html;
            if (anchor) anchor.insertAdjacentElement('beforebegin', holder);
            else articleBox.appendChild(holder);
        }).catch(function () { /* 数据失败静默 */ });
    }

    function buildShare(articleBox) {
        if (articleBox.querySelector('.article-share')) return;
        var url = window.location.href;
        var titleEl = document.querySelector('.article-title') || document.querySelector('main h1');
        var title = ((titleEl && titleEl.textContent) ? titleEl.textContent : document.title) || 'zcfi.cn';
        var box = document.createElement('div');
        box.className = 'article-share';
        box.innerHTML =
            '<span class="article-share-label">分享这篇文章</span>' +
            '<button type="button" class="article-share-btn" data-share="copy"><i class="fas fa-link" aria-hidden="true"></i> 复制链接</button>' +
            '<a class="article-share-btn" target="_blank" rel="noopener" href="https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title) + '"><i class="fab fa-weibo" aria-hidden="true"></i> 微博</a>' +
            '<a class="article-share-btn" target="_blank" rel="noopener" href="https://connect.qq.com/widget/shareqq/index.html?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title) + '"><i class="fas fa-comment" aria-hidden="true"></i> QQ</a>';
        var anchor = articleBox.querySelector('.article-actions');
        if (anchor) anchor.insertAdjacentElement('beforebegin', box);
        else articleBox.appendChild(box);

        var copyBtn = box.querySelector('[data-share="copy"]');
        copyBtn.addEventListener('click', function () {
            var done = function () {
                copyBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> 已复制';
                setTimeout(function () {
                    copyBtn.innerHTML = '<i class="fas fa-link" aria-hidden="true"></i> 复制链接';
                }, 1600);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(done).catch(function () { window.prompt('复制链接：', url); });
            } else {
                window.prompt('复制链接：', url);
            }
        });
    }

    ready(init);
})();

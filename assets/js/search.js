/*!
 * search.js — 全站搜索（纯前端）
 * 入口：页面任意元素加 data-site-search-open；输入框加 data-site-search-input；
 *       键盘 "/" 也可打开（输入框内不触发）。
 */
window.SiteSearch = (function () {
    'use strict';

    var PAGES = [
        { title: '首页', desc: '个人主页与最新内容', url: '/' },
        { title: '作品集', desc: '网页设计、开发项目与作品', url: '/portfolio.html' },
        { title: '博客', desc: '技术文章与学习记录', url: '/blog.html' },
        { title: '联系我', desc: '通过邮件或留言联系站主', url: '/contact.html' },
        { title: '隐私政策', desc: '站点隐私说明', url: '/privacy.html' },
        { title: '使用条款', desc: '站点使用条款', url: '/terms.html' },
        { title: '版权声明', desc: '内容版权说明', url: '/copyright.html' }
    ];
    var MAX_GROUP = 6;
    var overlay, input, body, lastFocus, dataPromise = null, searchData = null;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function stripHtml(html) {
        if (!html) return '';
        var div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || '';
    }

    function highlight(text, q) {
        var safe = esc(text || '');
        if (!q) return safe;
        try {
            var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
            return safe.replace(re, '<mark>$1</mark>');
        } catch (e) {
            return safe;
        }
    }

    function matches(haystack, q) {
        return String(haystack || '').toLowerCase().indexOf(q) !== -1;
    }

    function ensureDom() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'zs-overlay';
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="zs-dialog" role="dialog" aria-modal="true" aria-label="站内搜索">' +
                '<div class="zs-head">' +
                    '<i class="fas fa-search" aria-hidden="true"></i>' +
                    '<input class="zs-input" type="search" placeholder="搜索文章、作品或页面…" autocomplete="off" spellcheck="false" aria-label="站内搜索关键词">' +
                    '<button type="button" class="zs-close" aria-label="关闭搜索">' +
                        '<i class="fas fa-times" aria-hidden="true"></i>' +
                    '</button>' +
                '</div>' +
                '<div class="zs-body"><p class="zs-hint">输入关键词开始搜索，按 <kbd>Esc</kbd> 关闭</p></div>' +
                '<div class="zs-foot"><span>博客文章 · 作品集 · 页面</span><span class="zs-kbd"><kbd>/</kbd> 打开</span></div>' +
            '</div>';
        document.body.appendChild(overlay);
        input = overlay.querySelector('.zs-input');
        body = overlay.querySelector('.zs-body');

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        overlay.querySelector('.zs-close').addEventListener('click', close);
        // 点击搜索结果后关闭弹层（再跳转）
        body.addEventListener('click', function (e) {
            if (e.target.closest('.zs-item')) close();
        });
        input.addEventListener('input', debounce(function () { render(input.value); }, 120));
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var first = body.querySelector('a.zs-item');
                if (first) first.click();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !overlay.hidden) close();
        });
    }

    function debounce(fn, ms) {
        var t = null;
        return function () {
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(null, args); }, ms);
        };
    }

    function loadData() {
        if (searchData) return Promise.resolve(searchData);
        if (!dataPromise) {
            dataPromise = window.SiteData.load().then(function (d) {
                searchData = d;
                return d;
            }).catch(function () {
                searchData = { blog: [], portfolio: [] };
                return searchData;
            });
        }
        return dataPromise;
    }

    function open(prefill) {
        ensureDom();
        if (!overlay.hidden) {
            if (input) { input.focus(); input.select(); }
            return;
        }
        lastFocus = document.activeElement;
        // 从页面上的搜索框触发时，不能把焦点还给它，否则 close() 会再次触发 focusin 打开弹层
        if (lastFocus && lastFocus.matches && lastFocus.matches('[data-site-search-input]')) {
            lastFocus = null;
        }
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        input.value = prefill || '';
        input.focus();
        body.innerHTML = '<p class="zs-hint">正在加载数据…</p>';
        loadData().then(function () { render(input.value); });
    }

    function close() {
        if (!overlay || overlay.hidden) return;
        overlay.hidden = true;
        document.body.style.overflow = '';
        var restore = lastFocus;
        lastFocus = null;
        if (restore && typeof restore.focus === 'function' && !(restore.matches && restore.matches('[data-site-search-input]'))) {
            restore.focus();
        }
    }

    function render(q) {
        if (!body) return;
        q = String(q || '').trim().toLowerCase();
        if (!searchData) { body.innerHTML = '<p class="zs-hint">正在加载数据…</p>'; return; }

        var sections = [];

        // 页面
        var pages = PAGES.filter(function (p) {
            return !q || matches(p.title, q) || matches(p.desc, q);
        }).slice(0, MAX_GROUP);
        if (pages.length) {
            sections.push(section('页面', pages.map(function (p) {
                return item(p.title, p.desc, p.url, 'page');
            })));
        }

        // 博客
        if (q) {
            var posts = window.SiteData.publishedPosts(searchData.blog).filter(function (post) {
                var hay = [post.title, post.excerpt, stripHtml(post.content), (post.tags || []).join(' '), post.date].join(' ');
                return matches(hay, q);
            }).sort(function (a, b) { return window.SiteData.postTimestamp(b) - window.SiteData.postTimestamp(a); }).slice(0, MAX_GROUP);
            if (posts.length) {
                sections.push(section('博客文章', posts.map(function (post) {
                    return item(post.title || '未命名文章', post.excerpt || '', window.SiteData.postHref(post), 'post', post.date || post.lastUpdated || '');
                })));
            }
        }

        // 作品集
        if (q) {
            var projects = window.SiteData.publishedProjects(searchData.portfolio).filter(function (p) {
                var hay = [p.title, p.description, (p.tech || []).join(' ')].join(' ');
                return matches(hay, q);
            }).slice(0, MAX_GROUP);
            if (projects.length) {
                sections.push(section('作品集', projects.map(function (p) {
                    return item(p.title || '未命名项目', p.description || '', '/portfolio.html', 'project', (p.tech || []).join(' · '));
                })));
            }
        }

        if (!sections.length) {
            body.innerHTML = '<p class="zs-empty">没有找到与 “' + esc(q) + '” 相关的内容</p>';
            return;
        }
        body.innerHTML = sections.join('');
    }

    function section(title, itemsHtml) {
        return '<div class="zs-group"><p class="zs-group-title">' + esc(title) + '</p>' + itemsHtml.join('') + '</div>';
    }

    function item(title, desc, url, kind, meta) {
        return '<a class="zs-item" href="' + esc(url) + '">' +
            '<span class="zs-item-title">' + highlight(title, input ? input.value.trim() : '') + '</span>' +
            (desc ? '<span class="zs-item-desc">' + highlight(desc, input ? input.value.trim() : '') + '</span>' : '') +
            (meta ? '<span class="zs-item-meta">' + esc(meta) + '</span>' : '') +
            '<span class="zs-item-kind">' + (kind === 'post' ? '博客' : kind === 'project' ? '作品' : '页面') + '</span>' +
            '</a>';
    }

    function bindPages() {
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest('[data-site-search-open]');
            if (trigger) {
                e.preventDefault();
                open();
            }
        });
        document.addEventListener('focusin', function (e) {
            var target = e.target;
            if (!target || !target.matches || !target.matches('[data-site-search-input]')) return;
            if (overlay && !overlay.hidden) return; // 弹层已打开时不要重复打开
            open(target.value || '');
            if (input) input.value = target.value || '';
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            var el = document.activeElement;
            var tag = el && el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || (el && el.isContentEditable)) return;
            e.preventDefault();
            open();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        ensureDom();
        bindPages();
    });

    return { open: open, close: close, loadData: loadData };
})();

/*!
 * site-data.js — 站点数据加载（博客/作品集 Gist + 会话缓存）
 * 供全站搜索、博客列表、文章增强、作品集共用，避免每处重复请求。
 */
window.SiteData = (function () {
    'use strict';

    var GIST = {
        blog: 'https://gist.githubusercontent.com/xiao305/73cc78400c25eb9effed665e2c89843d/raw/blog.json',
        portfolio: 'https://gist.githubusercontent.com/xiao305/311b9a0a483aafc4314d17f577e859bb/raw/portfolio.json'
    };
    var CACHE_KEY = 'zcfi:site-data:v1';
    var TTL = 10 * 60 * 1000;
    var memory = null;
    var pending = null;

    function readCache() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || !obj.at || (Date.now() - obj.at) > TTL) return null;
            return obj.data;
        } catch (e) {
            return null;
        }
    }

    function writeCache(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
        } catch (e) { /* 隐私模式忽略 */ }
    }

    function fetchJson(url, force) {
        return fetch(url + (force ? '?t=' + Date.now() : ''), { cache: force ? 'no-cache' : 'default' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            });
    }

    function normalizeBlog(data) {
        return Array.isArray(data) ? data : ((data && data.blog) || []);
    }

    function normalizePortfolio(data) {
        return Array.isArray(data) ? data : ((data && data.projects) || []);
    }

    function load(force) {
        if (!force && memory) return Promise.resolve(memory);
        if (!force && !pending) {
            var cached = readCache();
            if (cached) {
                memory = cached;
                return Promise.resolve(cached);
            }
        }
        if (!force && pending) return pending;

        var result = { blog: [], portfolio: [], ok: { blog: false, portfolio: false } };
        pending = Promise.allSettled([
            fetchJson(GIST.blog, force).then(function (d) { result.blog = normalizeBlog(d); result.ok.blog = true; }),
            fetchJson(GIST.portfolio, force).then(function (d) { result.portfolio = normalizePortfolio(d); result.ok.portfolio = true; })
        ]).then(function () {
            memory = result;
            if (result.ok.blog || result.ok.portfolio) writeCache(result);
            pending = null;
            return result;
        }).catch(function () {
            pending = null;
            memory = result;
            return result;
        });
        return pending;
    }

    function publishedPosts(posts) {
        return (posts || []).filter(function (p) {
            return p && p.status === 'published';
        });
    }

    function publishedProjects(items) {
        return (items || []).filter(function (p) {
            return p && (p.status === 'published' || !p.status);
        });
    }

    function postHref(post) {
        if (!post) return '/blog';
        var custom = post.customUrl;
        if (custom && /^https?:\/\//i.test(custom)) return custom;
        if (custom && /^[a-z0-9._-]+\.html$/i.test(custom)) return '/blogs/' + custom;
        return '/blogs/' + encodeURIComponent(post.id || '');
    }

    function postTimestamp(post) {
        if (!post) return 0;
        var raw = post.updatedAt || post.lastUpdated || post.date;
        if (!raw) return 0;
        var ts = Date.parse(raw);
        return isNaN(ts) ? 0 : ts;
    }

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function richText(html) {
        var input = String(html == null ? '' : html);
        if (!input) return '';
        if (typeof DOMParser === 'undefined') return escapeHtml(input);
        var allowed = {
            A: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, STRIKE: 1, DEL: 1,
            INS: 1, CODE: 1, KBD: 1, SAMP: 1, VAR: 1, MARK: 1, SMALL: 1,
            SUP: 1, SUB: 1, SPAN: 1, BR: 1
        };
        var block = {
            P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, BLOCKQUOTE: 1,
            H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
            SECTION: 1, ARTICLE: 1, FIGCAPTION: 1, TABLE: 1, THEAD: 1,
            TBODY: 1, TR: 1, TD: 1, TH: 1
        };
        var drop = {
            SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1,
            META: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1,
            OPTION: 1, IMG: 1, VIDEO: 1, AUDIO: 1, SVG: 1, MATH: 1,
            TEMPLATE: 1, NOSCRIPT: 1
        };
        function safeHref(raw) {
            var u = String(raw == null ? '' : raw).trim();
            if (!u) return '';
            if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u) || u.charAt(0) === '/' || u.charAt(0) === '#') return u;
            return '';
        }
        function walk(node) {
            if (!node) return '';
            if (node.nodeType === 3) {
                return escapeHtml(node.nodeValue).replace(/\r?\n/g, '<br>');
            }
            if (node.nodeType !== 1) return '';
            var tag = node.tagName.toUpperCase();
            if (drop[tag]) return '';
            var children = '';
            for (var i = 0; i < node.childNodes.length; i++) children += walk(node.childNodes[i]);
            if (tag === 'BR') return '<br>';
            if (tag === 'A') {
                var href = safeHref(node.getAttribute('href'));
                return href ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + children + '</a>' : children;
            }
            if (allowed[tag]) return '<' + tag.toLowerCase() + '>' + children + '</' + tag.toLowerCase() + '>';
            if (block[tag]) return children + (children && !/<br>$/i.test(children) ? '<br>' : '');
            return children;
        }
        try {
            var doc = new DOMParser().parseFromString('<div>' + input + '</div>', 'text/html');
            var out = walk(doc.body.firstChild);
            return out.replace(/^(?:\s|<br\s*\/?>)+/i, '').replace(/(?:\s|<br\s*\/?>)+$/i, '');
        } catch (e) {
            return escapeHtml(input);
        }
    }

    return {
        load: load,
        publishedPosts: publishedPosts,
        publishedProjects: publishedProjects,
        postHref: postHref,
        postTimestamp: postTimestamp,
        escapeHtml: escapeHtml,
        richText: richText
    };
})();

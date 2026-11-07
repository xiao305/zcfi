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

    return {
        load: load,
        publishedPosts: publishedPosts,
        publishedProjects: publishedProjects,
        postHref: postHref,
        postTimestamp: postTimestamp,
        escapeHtml: escapeHtml
    };
})();

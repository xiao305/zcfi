/*!
 * portfolio-page.js — 作品集：技术栈筛选 / 排序 / 详情弹层
 * 依赖：site-data.js
 */
(function () {
    'use strict';

    var state = { projects: [], tech: '', sort: 'default' };
    var container, techSelect, sortSelect, countEl, overlay, lastFocus;

    function esc(s) { return window.SiteData.escapeHtml(s); }

    function safeUrl(url) {
        var u = String(url == null ? '' : url).trim();
        if (!u) return '';
        if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, 'https://');
        if (/^https?:\/\//i.test(u) || u.charAt(0) === '/') return u;
        return '';
    }

    function iconFor(project) {
        var tech = (project.tech || []).join(' ').toLowerCase();
        if (/react|vue|angular|web/.test(tech)) return 'fas fa-globe';
        if (/android|ios|mobile|flutter/.test(tech)) return 'fas fa-mobile-alt';
        if (/mysql|mongodb|postgres|database|sql/.test(tech)) return 'fas fa-database';
        if (/node|express|api|server/.test(tech)) return 'fas fa-server';
        if (/design|ui|ux|figma|sketch/.test(tech)) return 'fas fa-palette';
        return 'fas fa-laptop-code';
    }

    function readParams() {
        var params = new URLSearchParams(window.location.search);
        state.tech = params.get('tech') || '';
        state.sort = params.get('sort') || 'default';
        if (['default', 'updated', 'title', 'featured'].indexOf(state.sort) === -1) state.sort = 'default';
    }

    function writeParams() {
        var params = new URLSearchParams();
        if (state.tech) params.set('tech', state.tech);
        if (state.sort !== 'default') params.set('sort', state.sort);
        var qs = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    }

    function filtered() {
        var list = state.projects.filter(function (p) {
            if (!state.tech) return true;
            return (p.tech || []).some(function (t) {
                return String(t).toLowerCase() === state.tech.toLowerCase();
            });
        });
        if (state.sort === 'updated') {
            list.sort(function (a, b) { return (Date.parse(b.updatedAt || b.createdAt || '') || 0) - (Date.parse(a.updatedAt || a.createdAt || '') || 0); });
        } else if (state.sort === 'title') {
            list.sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'); });
        } else if (state.sort === 'featured') {
            list.sort(function (a, b) {
                var fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0;
                if (fa !== fb) return fb - fa;
                return (a.featuredOrder || 99) - (b.featuredOrder || 99);
            });
        }
        return list;
    }

    function render() {
        if (!container) return;
        var list = filtered();
        if (countEl) countEl.textContent = '共 ' + list.length + ' 个作品';
        if (!list.length) {
            container.innerHTML = '<div class="blog-empty">没有符合筛选条件的作品<div class="blog-empty-tags">试试切换技术栈或重置</div></div>';
            return;
        }
        container.innerHTML = '<div class="portfolio-grid">' + list.map(function (project) {
            var img = safeUrl(project.image);
            var media = img
                ? '<img src="' + esc(img) + '" alt="' + esc(project.title || '项目') + '" loading="lazy">'
                : '<i class="' + iconFor(project) + '"></i>';
            var tech = (project.tech || []).slice(0, 3).map(function (t) {
                return '<span class="tech-tag">' + esc(t) + '</span>';
            }).join('');
            if ((project.tech || []).length > 3) tech += '<span class="tech-tag">+' + (project.tech.length - 3) + '</span>';
            var demo = safeUrl(project.demoUrl);
            var repo = safeUrl(project.githubUrl);
            return '<div class="portfolio-item">' +
                '<div class="portfolio-img">' + media + '</div>' +
                '<div class="portfolio-content">' +
                    '<h3>' + esc(project.title || '未命名项目') + '</h3>' +
                    '<p>' + esc((project.description || '项目描述').slice(0, 120)) + '</p>' +
                    (tech ? '<div class="tech-stack">' + tech + '</div>' : '') +
                    (demo || repo ? '<div class="project-links">' +
                        (demo ? '<a href="' + esc(demo) + '" target="_blank" rel="noopener noreferrer" class="project-link"><i class="fas fa-external-link-alt"></i> 演示</a>' : '') +
                        (repo ? '<a href="' + esc(repo) + '" target="_blank" rel="noopener noreferrer" class="project-link"><i class="fab fa-github"></i> 代码</a>' : '') +
                        '</div>' : '') +
                    '<button type="button" class="portfolio-detail-btn" data-project-id="' + esc(project.id || '') + '">' +
                        '<i class="fas fa-info-circle" aria-hidden="true"></i> 查看详情</button>' +
                '</div>' +
            '</div>';
        }).join('') + '</div>';
    }

    function bind() {
        if (techSelect) techSelect.addEventListener('change', function () {
            state.tech = techSelect.value;
            writeParams();
            render();
        });
        if (sortSelect) sortSelect.addEventListener('change', function () {
            state.sort = sortSelect.value;
            writeParams();
            render();
        });
        if (container) container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-project-id]');
            if (btn) openDetail(btn.getAttribute('data-project-id'));
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay) closeDetail();
        });
    }

    function openDetail(id) {
        var project = state.projects.filter(function (p) { return p.id === id; })[0];
        if (!project) return;
        lastFocus = document.activeElement;

        overlay = document.createElement('div');
        overlay.className = 'pf-overlay';
        var img = safeUrl(project.image);
        var demo = safeUrl(project.demoUrl);
        var repo = safeUrl(project.githubUrl);
        var tech = (project.tech || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
        overlay.innerHTML =
            '<div class="pf-dialog" role="dialog" aria-modal="true" aria-label="' + esc(project.title || '项目详情') + '">' +
                '<button type="button" class="pf-close" aria-label="关闭"><i class="fas fa-times" aria-hidden="true"></i></button>' +
                '<div class="pf-media">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(project.title || '') + '">' : '<i class="' + iconFor(project) + '"></i>') + '</div>' +
                '<div class="pf-content">' +
                    '<h2 class="pf-title">' + esc(project.title || '未命名项目') + '</h2>' +
                    (tech ? '<div class="pf-tech">' + tech + '</div>' : '') +
                    '<p class="pf-desc">' + esc(project.description || '暂无项目描述') + '</p>' +
                    '<div class="pf-links">' +
                        (demo ? '<a href="' + esc(demo) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> 查看演示</a>' : '') +
                        (repo ? '<a class="secondary" href="' + esc(repo) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> 查看代码</a>' : '') +
                    '</div>' +
                    (project.updatedAt ? '<p class="pf-meta">最后更新：' + esc(String(project.updatedAt).slice(0, 10)) + '</p>' : '') +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeDetail();
        });
        overlay.querySelector('.pf-close').addEventListener('click', closeDetail);
        overlay.querySelector('.pf-close').focus();
    }

    function closeDetail() {
        if (!overlay) return;
        overlay.remove();
        overlay = null;
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function init() {
        container = document.getElementById('portfolio-container');
        techSelect = document.getElementById('portfolioTech');
        sortSelect = document.getElementById('portfolioSort');
        countEl = document.getElementById('portfolioCount');
        readParams();
        bind();

        window.SiteData.load().then(function (data) {
            state.projects = window.SiteData.publishedProjects(data.portfolio);
            var techs = [];
            state.projects.forEach(function (p) {
                (p.tech || []).forEach(function (t) {
                    if (techs.indexOf(t) === -1) techs.push(t);
                });
            });
            techs.sort(function (a, b) { return String(a).localeCompare(String(b), 'zh-CN'); });
            if (techSelect) {
                techs.forEach(function (t) {
                    var opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    techSelect.appendChild(opt);
                });
                if (state.tech && techs.indexOf(state.tech) !== -1) techSelect.value = state.tech;
            }
            if (sortSelect) sortSelect.value = state.sort;
            render();
        }).catch(function () {
            if (container) container.innerHTML = '<div class="error-message"><h3>❌ 加载失败</h3><p>请检查网络连接，或稍后重试。</p></div>';
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

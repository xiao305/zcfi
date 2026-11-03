/*!
 * task-center.js — 后台 GitHub 写操作任务中心
 * 解决：保存/上传/提交耗时长、并发二次提交冲突、状态不可见、成功反馈不及时。
 * 能力：全局串行队列（防并发冲突）、自动重试、409/422 冲突自动重新取 sha、
 *       实时状态与耗时、成功即时提示、失败可重试、历史记录、离开页面提醒。
 * 依赖：admin-core.js（token / toast / apiFetch）
 */
window.AdminTasks = (function () {
    'use strict';

    var REPO = { owner: 'xiao305', repo: 'zcfi', branch: 'main' };
    var HISTORY_KEY = 'zcfi:admin-tasks:v1';
    var PENDING_KEY = 'zcfi:admin-deploy-pending:v1';
    var WRITE_QUEUE_KEY = 'zcfi:admin-write-queue:v1';
    var CONFIG = { deployPollMs: 4000, deployVerifyMs: 4000, deployTimeoutMs: 5 * 60 * 1000 };
    var MAX_TASKS = 30;
    var tasks = [];       // 本轮会话的任务
    var queue = [];
    var deploying = [];   // 已提交、等待 GitHub Pages 构建/部署的任务
    var current = null;
    var seq = 0;
    var ui = {};
    var pageRoot = null;
    var pageUi = { ready: false };
    var suppressRender = false;
    var pendingRender = false;
    var lastHistoryTime = null;
    var tickTimer = null;
    var queueBlockedNotice = false;

    function now() { return Date.now(); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtDuration(ms) {
        if (!ms || ms < 0) return '—';
        if (ms < 1000) return Math.max(1, Math.round(ms)) + ' ms';
        if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
        return Math.floor(ms / 60000) + ' 分 ' + Math.round((ms % 60000) / 1000) + ' 秒';
    }

    function fmtClock(ts) {
        var d = new Date(ts);
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function getToken() {
        try { return sessionStorage.getItem('admin_token') || ''; } catch (e) { return ''; }
    }

    function apiFetch(url, options) {
        if (window.AdminCore && AdminCore.apiFetch) return AdminCore.apiFetch(url, options);
        var opts = options || {};
        opts.headers = Object.assign({
            'Authorization': 'token ' + getToken(),
            'Accept': 'application/vnd.github.v3+json'
        }, opts.headers || {});
        return fetch(url, opts);
    }

    function parseError(res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
            var msg = (data && data.message) ? data.message : ('HTTP ' + res.status);
            return new Error(msg + '（HTTP ' + res.status + '）');
        });
    }

    function isRetryableError(err) {
        if (!err) return false;
        if (err.name === 'AbortError') return true;
        if (err.name === 'TypeError') return true; // 网络失败
        var m = String(err.message || '');
        return /HTTP (5\d\d|429)/.test(m) || /network|failed to fetch|超时|timeout/i.test(m);
    }

    // ---------- 任务队列 ----------
    function enqueue(opts) {
        var task = {
            id: ++seq,
            title: opts.title || '保存',
            kind: opts.kind || 'write',
            detail: '排队中',
            status: 'queued',
            createdAt: now(),
            startedAt: 0,
            finishedAt: 0,
            attempts: 0,
            timeout: opts.timeout || 90000,
            retryable: opts.retryable !== false,
            run: opts.run,
            opts: opts,
            error: null
        };
        if (opts.persist) rememberWrite(task, opts.persist);
        tasks.push(task);
        if (tasks.length > MAX_TASKS) tasks = tasks.slice(-MAX_TASKS);
        queue.push(task);
        render();
        updateShell();
        ensureTicker();
        return new Promise(function (resolve, reject) {
            task._resolve = resolve;
            task._reject = reject;
            pump();
        });
    }

    function pump() {
        if (current) { render(); updateShell(); return; }
        if (!queue.length) { render(); updateShell(); return; }
        if (!deploying.length) queueBlockedNotice = false;
        // 部署期间不允许再提交仓库文件（否则会取消/取代正在进行的部署）
        // 新的文件任务排队等待；Gist 保存不影响部署，可以先执行
        if (deploying.length > 0) {
            var gistIdx = -1;
            for (var i = 0; i < queue.length; i++) {
                if (queue[i].kind === 'gist') { gistIdx = i; break; }
            }
            if (gistIdx === -1) {
                var blockedTask = queue[0];
                blockedTask.detail = '等待当前部署完成后再提交…';
                if (!blockedTask._queueNotified && blockedTask.opts && typeof blockedTask.opts.onQueued === 'function') {
                    blockedTask._queueNotified = true;
                    try { blockedTask.opts.onQueued(blockedTask); } catch (e) { console.warn('onQueued 回调失败:', e); }
                }
                if (!queueBlockedNotice) {
                    queueBlockedNotice = true;
                    toast('当前有部署正在进行，新提交已排队等待（部署完成后自动提交）');
                    openPanel(true);
                }
                render();
                updateShell();
                ensureTicker();
                return;
            }
            startTask(queue.splice(gistIdx, 1)[0]);
            return;
        }
        startTask(queue.shift());
    }

    function startTask(t) {
        current = t;
        t.status = 'running';
        t.startedAt = now();
        t.attempts = 0;
        t.detail = '正在连接 GitHub…';
        render();
        updateShell();
        ensureTicker();
        attempt(t);
    }

    function attempt(t) {
        t.attempts += 1;
        var controller = new AbortController();
        var timer = setTimeout(function () {
            try { controller.abort(); } catch (e) {}
        }, t.timeout);
        var ctx = {
            attempt: t.attempts,
            signal: controller.signal,
            onProgress: function (detail) {
                setTaskDetail(t, detail);
            }
        };
        Promise.resolve().then(function () {
            return t.run(ctx);
        }).then(function (result) {
            clearTimeout(timer);
            finishSuccess(t, result);
        }).catch(function (err) {
            clearTimeout(timer);
            if (t.retryable && t.attempts < 3 && isRetryableError(err)) {
                t.status = 'retrying';
                t.detail = '网络异常，' + (800 * t.attempts) + 'ms 后重试（第 ' + t.attempts + '/2 次）';
                render();
                updateShell();
                setTimeout(function () { attempt(t); }, 800 * t.attempts);
            } else {
                finishFailure(t, err);
            }
        });
    }

    function playSuccessAnimation(t, done) {
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!pageRoot || reduced) { done(); return; }
        var card = document.querySelector('.tc-task[data-task-id="' + t.id + '"]');
        if (!card) { done(); return; }
        suppressRender = true;
        card.classList.remove('is-running', 'is-deploying', 'is-queued', 'is-retrying');
        card.classList.add('is-success', 'is-animating');
        var badge = card.querySelector('.tc-task-badge');
        if (badge) badge.textContent = '已完成';
        var icon = card.querySelector('.tc-task-icon');
        if (icon) {
            icon.innerHTML = '<svg class="tc-check-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
        }
        var detail = card.querySelector('.tc-task-detail');
        if (detail) detail.textContent = t.detail || '已完成，已生效';
        setTimeout(function () {
            card.classList.add('is-exiting');
            setTimeout(function () {
                card.style.maxHeight = card.offsetHeight + 'px';
                void card.offsetHeight;
                card.classList.add('is-collapsing');
                setTimeout(function () {
                    if (card.parentNode) card.parentNode.removeChild(card);
                    suppressRender = false;
                    pendingRender = false;
                    done();
                }, 400);
            }, 250);
        }, 500);
    }

    function finishSuccess(t, result) {
        // 仓库写入：提交成功只是第 1 步，后续还要构建、部署、生效
        if (result && result.deploy) {
            forgetWrite(t);
            startDeployment(t, result);
            current = null;
            if (t._resolve) t._resolve(result);
            pump();
            return;
        }
        t.status = 'success';
        t.finishedAt = now();
        t.detail = (result && result.detail) ? result.detail : '成功';
        current = null;
        forgetWrite(t);
        var completeSuccess = function () {
            addHistory(t);
            render();
            updateShell();
            toast(t.title + '：成功（' + fmtDuration(t.finishedAt - t.startedAt) + '）', 'success');
            if (t._resolve) t._resolve(result || {});
            pump();
        };
        if (pageRoot) {
            playSuccessAnimation(t, completeSuccess);
        } else {
            completeSuccess();
        }
    }

    function finishFailure(t, err) {
        t.status = 'failed';
        t.finishedAt = now();
        t.error = err;
        t.detail = (err && err.message) ? err.message : '失败';
        current = null;
        forgetWrite(t);
        addHistory(t);
        render();
        updateShell();
        toast(t.title + '失败：' + t.detail, 'error');
        openPanel(true);
        if (t._reject) t._reject(err);
        pump();
    }

    function toast(msg, type) {
        if (window.AdminCore && AdminCore.toast) AdminCore.toast(msg, type);
    }

    function retry(taskId) {
        var t = null;
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) { t = tasks[i]; break; }
        }
        if (!t || !t.opts) return;
        enqueue(t.opts);
    }

    // ---------- 提交后的部署跟踪：提交 → 构建 → 部署 → 生效 ----------
    function fingerprint(url) {
        return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
            return {
                status: res.status,
                etag: res.headers.get('ETag') || '',
                lastModified: res.headers.get('Last-Modified') || '',
                length: res.headers.get('Content-Length') || ''
            };
        }).catch(function () { return null; });
    }

    function baselineFor(url) {
        if (!url) return Promise.resolve(null);
        return fingerprint(url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=pre-' + now());
    }

    function loadPending() {
        try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; }
    }

    function savePending() {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify(deploying.map(function (t) {
                return {
                    title: t.title, kind: t.kind, detail: t.detail,
                    startedAt: t.deploy.startedAt, deploy: t.deploy
                };
            })));
        } catch (e) {}
    }

    function loadWriteQueue() {
        try { return JSON.parse(localStorage.getItem(WRITE_QUEUE_KEY) || '[]'); } catch (e) { return []; }
    }

    function saveWriteQueue(list) {
        try { localStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function rememberWrite(t, desc) {
        t.pid = 'w' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        var list = loadWriteQueue();
        var item = { pid: t.pid };
        Object.keys(desc || {}).forEach(function (key) { item[key] = desc[key]; });
        list.push(item);
        saveWriteQueue(list);
    }

    function forgetWrite(t) {
        if (!t || !t.pid) return;
        var list = loadWriteQueue().filter(function (item) { return item.pid !== t.pid; });
        saveWriteQueue(list);
    }

    function restoreWriteQueue() {
        var list = loadWriteQueue();
        if (!list.length) return 0;
        saveWriteQueue([]); // 先清空，重新入队时会重新持久化
        list.forEach(function (item) {
            try {
                if (item.type === 'gist') {
                    gist({ gistId: item.gistId, filename: item.filename, data: item.data, title: item.title, description: item.description });
                } else if (item.type === 'saveFile') {
                    saveFile({ path: item.path, contentBase64: item.contentBase64, message: item.message, title: item.title, verifyUrl: item.verifyUrl, expected: item.expected });
                } else if (item.type === 'deleteFile') {
                    deleteFile({ path: item.path, message: item.message, title: item.title, verifyUrl: item.verifyUrl, expected: item.expected });
                }
            } catch (e) {
                console.warn('恢复未完成任务失败:', e);
            }
        });
        if (!pageRoot) setTimeout(function () { toast('已恢复 ' + list.length + ' 个未完成的任务'); }, 600);
        return list.length;
    }

    function startDeployment(t, info) {
        t.status = 'deploying';
        t.deploy = {
            commitSha: info.commitSha,
            verifyUrl: info.verifyUrl || '',
            baseline: info.baseline || null,
            expected: info.expected || 'update',
            path: info.path || '',
            startedAt: now()
        };
        t.detail = '已提交（步骤 1/3），等待 GitHub 构建部署…';
        deploying.push(t);
        savePending();
        render();
        updateShell();
        ensureTicker();
        watchDeploy(t);
    }

    function setDeployDetail(t, detail) {
        if (!t || t.status !== 'deploying') return;
        setTaskDetail(t, detail);
    }

    function jobsSummary(jobs) {
        var build = null, deploy = null;
        (jobs || []).forEach(function (j) {
            if (j.name === 'build') build = j;
            if (j.name === 'deploy') deploy = j;
        });
        if (deploy && deploy.status === 'in_progress') return '部署中（步骤 3/3）…';
        if (build && build.status === 'in_progress') return '构建中（步骤 2/3）…';
        if (build && build.status === 'completed' && deploy && deploy.status === 'queued') return '构建完成，等待部署（步骤 3/3）…';
        return '构建/部署中（步骤 2/3）…';
    }

    function watchDeploy(t) {
        var d = t.deploy;
        var jobsAt = 0;
        function schedule() {
            if (!deploying.some(function (x) { return x.id === t.id; })) return;
            if (now() - d.startedAt > CONFIG.deployTimeoutMs) {
                finalizeDeployment(t, 'unknown', '已提交，但 5 分钟内未检测到部署结果，请到 GitHub Actions 查看');
                return;
            }
            setTimeout(tick, CONFIG.deployPollMs);
        }
        function tick() {
            if (!deploying.some(function (x) { return x.id === t.id; })) return;
            var runsUrl = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo +
                '/actions/runs?branch=' + REPO.branch + '&per_page=15';
            apiFetch(runsUrl).then(function (res) {
                if (res.status === 401 || res.status === 403) {
                    finalizeDeployment(t, 'unknown', '已提交；Token 无法读取 Actions 部署状态（需要 repo 权限）');
                    return;
                }
                if (!res.ok) { schedule(); return; }
                return res.json().then(function (data) {
                    var runs = (data && data.workflow_runs) || [];
                    var run = null;
                    for (var i = 0; i < runs.length; i++) {
                        if (runs[i].head_sha === d.commitSha) { run = runs[i]; break; }
                    }
                    if (!run) {
                        setDeployDetail(t, '已提交，等待 GitHub Actions 任务出现（步骤 2/3）…');
                        schedule();
                        return;
                    }
                    if (run.status === 'queued') {
                        setDeployDetail(t, '构建任务排队中（步骤 2/3）…');
                        schedule();
                        return;
                    }
                    if (run.status === 'in_progress') {
                        if (now() - jobsAt > 2000) {
                            jobsAt = now();
                            var jobsUrl = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo +
                                '/actions/runs/' + run.id + '/jobs?per_page=20';
                            apiFetch(jobsUrl).then(function (jr) {
                                return jr.ok ? jr.json() : null;
                            }).then(function (jd) {
                                setDeployDetail(t, jobsSummary(jd && jd.jobs));
                                schedule();
                            }).catch(function () {
                                setDeployDetail(t, '构建/部署中（步骤 2/3）…');
                                schedule();
                            });
                        } else {
                            schedule();
                        }
                        return;
                    }
                    if (run.status === 'completed') {
                        if (run.conclusion === 'success') {
                            setDeployDetail(t, '部署完成，正在确认站点生效（步骤 3/3）…');
                            verifyDeployed(t).then(function (v) {
                                if (v.ok) {
                                    finalizeDeployment(t, 'success', '已生效（总耗时 ' + fmtDuration(now() - t.startedAt) + '）');
                                } else {
                                    finalizeDeployment(t, 'success', v.note || '已部署（站点缓存可能延迟）');
                                }
                            });
                        } else if (run.conclusion === 'cancelled') {
                            finalizeDeployment(t, 'superseded', '部署已被更新的提交取消，等待最新提交部署');
                        } else {
                            finalizeDeployment(t, 'failed', '部署失败：' + (run.conclusion || '未知原因'));
                        }
                        return;
                    }
                    schedule();
                });
            }).catch(function () { schedule(); });
        }
        tick();
    }

    function verifyDeployed(t) {
        var d = t.deploy;
        if (!d.verifyUrl) return Promise.resolve({ ok: true });
        var start = now();
        return new Promise(function (resolve) {
            (function check() {
                var sep = d.verifyUrl.indexOf('?') === -1 ? '?' : '&';
                var url = d.verifyUrl + sep + 'v=' + encodeURIComponent(d.commitSha) + '&t=' + now();
                fingerprint(url).then(function (fp) {
                    var changed = false;
                    if (d.expected === 'delete') {
                        changed = !!(fp && fp.status === 404);
                    } else if (!d.baseline) {
                        changed = !!(fp && fp.status === 200);
                    } else {
                        changed = !!(fp && fp.status === 200 && (d.baseline.status !== 200 ||
                            fp.etag !== d.baseline.etag || fp.lastModified !== d.baseline.lastModified ||
                            fp.length !== d.baseline.length));
                    }
                    if (changed) return resolve({ ok: true });
                    if (now() - start > 90000) {
                        return resolve({ ok: false, note: '已部署，但站点缓存可能还未刷新（约 10 分钟）' });
                    }
                    setTimeout(check, CONFIG.deployVerifyMs);
                });
            })();
        });
    }

    function finalizeDeployment(t, status, detail) {
        if (!t || t.status !== 'deploying') return;
        t.status = status;
        t.finishedAt = now();
        t.detail = detail;
        deploying = deploying.filter(function (x) { return x.id !== t.id; });
        savePending();
        var completeDeploy = function () {
            addHistory(t);
            render();
            updateShell();
            // 部署结束后，恢复等待中的文件任务
            pump();
            if (status === 'success') {
                toast(t.title + '：' + detail, 'success');
            } else if (status === 'failed') {
                toast(t.title + '：' + detail, 'error');
                openPanel(true);
            } else {
                toast(t.title + '：' + detail);
            }
        };
        if (status === 'success' && pageRoot) {
            playSuccessAnimation(t, completeDeploy);
        } else {
            completeDeploy();
        }
    }

    // 新提交会触发新的部署；旧部署被取代（最终只部署最新提交）
    function supersedeDeployments(commitSha) {
        deploying.slice().forEach(function (t) {
            if (t.deploy && t.deploy.commitSha !== commitSha) {
                finalizeDeployment(t, 'superseded', '已被更新的提交取代（新部署将包含之前的修改）');
            }
        });
    }

    function resumePending() {
        loadPending().forEach(function (p) {
            if (!p.deploy || !p.deploy.commitSha || now() - p.deploy.startedAt > 30 * 60 * 1000) return;
            var t = {
                id: ++seq,
                title: p.title || '部署任务',
                kind: p.kind || 'file',
                detail: p.detail || '已提交，等待构建部署…',
                status: 'deploying',
                createdAt: p.startedAt,
                startedAt: p.startedAt,
                finishedAt: 0,
                attempts: 1,
                retryable: false,
                run: null,
                opts: null,
                error: null,
                _resolve: null,
                _reject: null,
                deploy: p.deploy
            };
            tasks.push(t);
            deploying.push(t);
            render();
            updateShell();
            ensureTicker();
            watchDeploy(t);
        });
    }

    // ---------- 历史记录 ----------
    function loadHistory() {
        try {
            var raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function addHistory(t) {
        try {
            var h = loadHistory();
            h.unshift({
                title: t.title,
                status: t.status,
                detail: t.detail,
                duration: t.finishedAt - t.startedAt,
                time: t.finishedAt
            });
            localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
            lastHistoryTime = t.finishedAt;
        } catch (e) {}
    }

    function clearHistory() {
        try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
        render();
    }

    // ---------- UI ----------
    function ensureUi() {
        if (ui.fab || pageUi.ready) return;
        pageRoot = document.getElementById('task-center-page');
        if (pageRoot) {
            setupPage();
            return;
        }
        ui.fab = document.createElement('button');
        ui.fab.type = 'button';
        ui.fab.className = 'admin-task-fab';
        ui.fab.title = 'GitHub 任务中心';
        ui.fab.innerHTML = '<i class="fas fa-list" aria-hidden="true"></i><span class="admin-task-badge" hidden>0</span>';
        document.body.appendChild(ui.fab);

        ui.panel = document.createElement('div');
        ui.panel.className = 'admin-task-panel';
        ui.panel.hidden = true;
        ui.panel.innerHTML =
            '<div class="admin-task-head">' +
                '<div><strong><i class="fas fa-list" aria-hidden="true"></i> GitHub 任务中心</strong>' +
                '<p class="admin-task-sub">保存 / 提交 / 上传会在这里显示实时状态</p></div>' +
                '<button type="button" class="admin-task-close" aria-label="关闭任务中心"><i class="fas fa-times" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="admin-task-list"></div>' +
            '<div class="admin-task-history"><div class="admin-task-history-head"><span>最近记录</span>' +
                '<button type="button" class="admin-task-clear">清除</button></div><ul></ul></div>' +
            '<div class="admin-task-panel-foot"><a href="tasks.html">打开完整任务中心 <span aria-hidden="true">→</span></a></div>';
        document.body.appendChild(ui.panel);

        ui.list = ui.panel.querySelector('.admin-task-list');
        ui.history = ui.panel.querySelector('.admin-task-history ul');
        ui.sub = ui.panel.querySelector('.admin-task-sub');

        ui.fab.addEventListener('click', function () { openPanel(); });
        ui.panel.querySelector('.admin-task-close').addEventListener('click', function () { closePanel(); });
        ui.panel.querySelector('.admin-task-clear').addEventListener('click', clearHistory);
        ui.list.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-task-retry]');
            if (btn) retry(parseInt(btn.getAttribute('data-task-retry'), 10));
        });
        render();
    }

    function openPanel(force) {
        ensureUi();
        if (pageRoot) return;
        ui.panel.hidden = false;
        ui.fab.classList.add('is-open');
        render();
    }

    function closePanel() {
        if (!ui.panel) return;
        ui.panel.hidden = true;
        ui.fab.classList.remove('is-open');
    }

    function spinIcon() {
        return '<span class="admin-task-spin" aria-hidden="true"></span>';
    }

    function statusIcon(t) {
        if (t.status === 'running') return spinIcon();
        if (t.status === 'retrying') return spinIcon();
        if (t.status === 'deploying') return spinIcon();
        if (t.status === 'success') return '<i class="fas fa-check"></i>';
        if (t.status === 'failed') return '<i class="fas fa-times"></i>';
        if (t.status === 'superseded') return '<i class="fas fa-ban"></i>';
        if (t.status === 'unknown') return '<i class="fas fa-clock"></i>';
        return '<i class="fas fa-clock"></i>';
    }

    function statusText(t) {
        if (t.status === 'queued') return '排队中';
        if (t.status === 'running') return '进行中';
        if (t.status === 'retrying') return '重试中';
        if (t.status === 'deploying') return '部署中';
        if (t.status === 'success') return '已生效';
        if (t.status === 'failed') return '失败';
        if (t.status === 'superseded') return '已取代';
        if (t.status === 'unknown') return '未验证';
        return t.status;
    }

    function findTaskItem(id) {
        var el = ui.list ? ui.list.querySelector('.admin-task-item[data-task-id="' + id + '"]') : null;
        if (!el) el = document.querySelector('.tc-task[data-task-id="' + id + '"]');
        return el;
    }

    function updatePanelSub() {
        if (!ui.sub) return;
        if (current) {
            ui.sub.textContent = current.title + ' · ' + current.detail + '（' + fmtDuration(now() - current.startedAt) + '）';
        } else if (deploying.length) {
            var d0 = deploying[0];
            ui.sub.textContent = '部署中：' + d0.title + ' · ' + d0.detail + '（' + fmtDuration(now() - d0.deploy.startedAt) + '）';
        } else if (queue.length) {
            ui.sub.textContent = '有 ' + queue.length + ' 个任务排队中';
        } else {
            ui.sub.textContent = '保存 / 提交 / 上传会在这里显示实时状态';
        }
    }

    function taskMetaText(t) {
        var runMs = (t.status === 'deploying' && t.deploy)
            ? (now() - t.deploy.startedAt)
            : (t.startedAt ? ((t.finishedAt || now()) - t.startedAt) : 0);
        var metaPrefix = t.status === 'deploying' ? '部署耗时 ' : '耗时 ';
        return (t.startedAt ? (metaPrefix + fmtDuration(runMs)) : '等待中') +
            (t.status === 'queued' ? ' · 队列第 ' + (queue.indexOf(t) + 1) + ' 位' : '');
    }

    // 只更新已有 DOM 的耗时/详情，避免每 500ms 重建 spinner 导致动画一卡一卡
    function updateDurations() {
        var metas = document.querySelectorAll('.admin-task-meta[data-task-id], .tc-task-meta[data-task-id]');
        for (var i = 0; i < metas.length; i++) {
            var id = parseInt(metas[i].getAttribute('data-task-id'), 10);
            var t = null;
            for (var j = 0; j < tasks.length; j++) {
                if (tasks[j].id === id) { t = tasks[j]; break; }
            }
            if (!t) continue;
            metas[i].textContent = taskMetaText(t);
        }
        updatePanelSub();
        updateBadge();
        updatePageSummary();
    }

    function updateBadge() {
        var count = queue.length + (current ? 1 : 0) + deploying.length;
        if (!ui.fab) return;
        var badge = ui.fab.querySelector('.admin-task-badge');
        if (!badge) return;
        if (count > 0) {
            badge.hidden = false;
            badge.textContent = count;
        } else {
            badge.hidden = true;
        }
        ui.fab.classList.toggle('is-busy', count > 0);
    }

    function setTaskDetail(t, detail) {
        t.detail = detail;
        var it = findTaskItem(t.id);
        if (it) {
            var d = it.querySelector('.admin-task-detail, .tc-task-detail');
            if (d) d.textContent = detail;
            if (pageRoot) updatePageTaskSteps(t);
        } else {
            render();
        }
        updatePanelSub();
        updateShell();
    }

    function render() {
        ensureUi();
        if (suppressRender) {
            pendingRender = true;
            return;
        }
        if (pageRoot) {
            renderPage();
            updateShell();
            return;
        }
        updateBadge();

        // 面板列表（新任务在上）
        var visible = tasks.slice(-8).reverse();
        if (!visible.length) {
            ui.list.innerHTML = '<p class="admin-task-empty">暂无任务。保存、提交或上传图片时会显示状态。</p>';
        } else {
            ui.list.innerHTML = visible.map(function (t) {
                return '<div class="admin-task-item is-' + t.status + '" data-task-id="' + t.id + '">' +
                    '<span class="admin-task-icon">' + statusIcon(t) + '</span>' +
                    '<div class="admin-task-body">' +
                        '<div class="admin-task-title">' + esc(t.title) +
                            '<span class="admin-task-state-text">' + statusText(t) + '</span></div>' +
                        '<div class="admin-task-detail">' + esc(t.detail) + '</div>' +
                        '<div class="admin-task-meta" data-task-id="' + t.id + '">' + esc(taskMetaText(t)) + '</div>' +
                    '</div>' +
                    (t.status === 'failed' && t.opts ? '<button type="button" class="admin-task-retry" data-task-retry="' + t.id + '">重试</button>' : '') +
                '</div>';
            }).join('');
        }

        updatePanelSub();

        // 历史
        var h = loadHistory().slice(0, 6);
        var labels = { success: '已生效', failed: '失败', superseded: '已取代', unknown: '未验证' };
        ui.history.innerHTML = h.length ? h.map(function (x) {
            return '<li class="is-' + x.status + '"><span>' + esc(x.title) + '</span><em>' +
                (labels[x.status] || (x.status === 'success' ? '已生效' : '失败')) + ' · ' + fmtClock(x.time) + '</em></li>';
        }).join('') : '<li class="admin-task-empty-li">暂无历史记录</li>';
    }

    function updateShell() {
        var chip = document.getElementById('adminTaskState');
        if (!chip) return;
        var activeCount = queue.length + (current ? 1 : 0) + deploying.length;
        var last = tasks.length ? tasks[tasks.length - 1] : null;
        var kind = '';
        var cls = '';
        var icon = '';
        var text = '';
        if (current) {
            kind = 'current';
            cls = 'is-active';
            icon = spinIcon();
            text = current.title + '… ' + fmtDuration(now() - current.startedAt);
        } else if (deploying.length) {
            var d0 = deploying[0];
            kind = 'deploying';
            cls = 'is-active';
            icon = spinIcon();
            text = '部署中：' + d0.title + '… ' + fmtDuration(now() - d0.deploy.startedAt);
        } else if (last && last.status === 'success' && now() - last.finishedAt < 15000) {
            kind = 'success';
            cls = 'is-ok';
            icon = '<i class="fas fa-check" aria-hidden="true"></i>';
            text = '已生效 ' + fmtClock(last.finishedAt);
        } else if (last && last.status === 'failed' && now() - last.finishedAt < 30000) {
            kind = 'failed';
            cls = 'is-error';
            icon = '<i class="fas fa-times" aria-hidden="true"></i>';
            text = '任务失败';
        } else if (activeCount > 0) {
            kind = 'queued';
            cls = 'is-active';
            icon = '<i class="fas fa-clock" aria-hidden="true"></i>';
            text = '排队中（' + activeCount + '）';
        } else {
            chip.hidden = true;
            chip.innerHTML = '';
            chip.removeAttribute('data-chip-kind');
            return;
        }
        chip.hidden = false;
        chip.className = 'admin-task-state ' + cls;
        // 同一种状态下只更新文字，保留 spinner 元素，避免每 500ms 重置 CSS 动画
        if (chip.getAttribute('data-chip-kind') !== kind) {
            chip.setAttribute('data-chip-kind', kind);
            chip.innerHTML = icon + '<span class="admin-task-chip-text"></span>';
        }
        var span = chip.querySelector('.admin-task-chip-text');
        if (span) span.textContent = text;
    }

    function ensureTicker() {
        if (tickTimer) return;
        tickTimer = setInterval(function () {
            var active = !!current || queue.length > 0 || deploying.length > 0;
            updateDurations();
            updateShell();
            if (!active) {
                clearInterval(tickTimer);
                tickTimer = null;
            }
        }, 500);
    }

    // ---------- 任务中心整页 ----------
    var PAGE_STEPS = ['提交', '构建', '部署', '生效'];

    function pageStatusLabel(status) {
        var labels = {
            success: '已生效', failed: '失败', superseded: '已取代', unknown: '未验证',
            deploying: '部署中', running: '进行中', queued: '排队中', retrying: '重试中'
        };
        return labels[status] || status;
    }

    function pageStepIndex(t) {
        if (t.status === 'deploying') {
            var d = t.detail || '';
            if (d.indexOf('步骤 3/3') !== -1 || d.indexOf('部署中') !== -1) return 2;
            if (d.indexOf('步骤 2/3') !== -1 || d.indexOf('构建') !== -1) return 1;
            return 1;
        }
        return 0;
    }

    function pageStepsHtml(t) {
        var active = pageStepIndex(t);
        var doneAll = t.status === 'success';
        return '<div class="tc-steps" data-task-id="' + t.id + '">' + PAGE_STEPS.map(function (label, idx) {
            var cls = doneAll ? 'done' : (idx < active ? 'done' : (idx === active ? 'active' : 'pending'));
            return '<span class="tc-step ' + cls + '"><em>' + (idx + 1) + '</em>' + label + '</span>';
        }).join('') + '</div>';
    }

    function updatePageTaskSteps(t) {
        if (!pageRoot) return;
        var steps = document.querySelector('.tc-steps[data-task-id="' + t.id + '"]');
        if (!steps) return;
        var active = pageStepIndex(t);
        var children = steps.querySelectorAll('.tc-step');
        for (var i = 0; i < children.length; i++) {
            children[i].className = 'tc-step ' + (i < active ? 'done' : (i === active ? 'active' : 'pending'));
        }
    }

    function pageTaskCard(t) {
        var qpos = t.status === 'queued' ? ('队列第 ' + (queue.indexOf(t) + 1) + ' 位') : '';
        return '<article class="tc-task is-' + t.status + '" data-task-id="' + t.id + '">' +
            '<div class="tc-task-head">' +
                '<span class="tc-task-icon">' + statusIcon(t) + '</span>' +
                '<div class="tc-task-copy">' +
                    '<div class="tc-task-title">' + esc(t.title) +
                        '<span class="tc-task-badge">' + esc(pageStatusLabel(t.status)) + '</span></div>' +
                    '<p class="tc-task-detail">' + esc(t.detail) + '</p>' +
                '</div>' +
                '<span class="tc-task-meta" data-task-id="' + t.id + '">' + esc(taskMetaText(t)) + '</span>' +
            '</div>' +
            pageStepsHtml(t) +
            (qpos ? '<div class="tc-task-queue">' + qpos + '</div>' : '') +
            (t.status === 'failed' && t.opts ? '<button type="button" class="admin-task-retry" data-task-retry="' + t.id + '">重试</button>' : '') +
        '</article>';
    }

    function updatePageSummary() {
        if (!pageRoot) return;
        var activeCount = (current ? 1 : 0) + deploying.length;
        var h = loadHistory();
        var success = h.filter(function (x) { return x.status === 'success'; }).length;
        var failed = h.filter(function (x) { return x.status === 'failed'; }).length;
        var activeEl = document.getElementById('tcActiveCount');
        var queueEl = document.getElementById('tcQueuedCount');
        var successEl = document.getElementById('tcSuccessCount');
        var failEl = document.getElementById('tcFailedCount');
        if (activeEl) activeEl.textContent = activeCount;
        if (queueEl) queueEl.textContent = queue.length;
        if (successEl) successEl.textContent = success;
        if (failEl) failEl.textContent = failed;
        var hint = document.getElementById('tcActiveHint');
        if (hint) hint.textContent = (activeCount || queue.length) ? ('进行中 ' + activeCount + ' · 排队 ' + queue.length) : '当前空闲';
    }

    function renderPage() {
        if (!pageRoot || suppressRender) return;
        updatePageSummary();
        var list = document.getElementById('tcActiveList');
        var empty = document.getElementById('tcActiveEmpty');
        if (!list || !empty) return;
        var activeTasks = [];
        if (current) activeTasks.push(current);
        deploying.forEach(function (t) { activeTasks.push(t); });
        queue.forEach(function (t) { activeTasks.push(t); });
        if (!activeTasks.length) {
            list.innerHTML = '';
            empty.hidden = false;
        } else {
            empty.hidden = true;
            list.innerHTML = activeTasks.map(pageTaskCard).join('');
        }
        var historyEl = document.getElementById('tcHistory');
        if (historyEl) {
            var h = loadHistory().slice(0, 20);
            if (!h.length) {
                historyEl.innerHTML = '<div class="tc-history-empty">还没有记录。完成一次保存/提交后，这里会留下结果。</div>';
            } else {
                var highlightTime = lastHistoryTime;
                historyEl.innerHTML = h.map(function (x, idx) {
                    var rowClass = 'tc-history-row is-' + x.status;
                    if (idx === 0 && highlightTime && x.time === highlightTime && now() - highlightTime < 2000) rowClass += ' is-new';
                    return '<div class="' + rowClass + '">' +
                        '<span class="tc-history-time">' + fmtClock(x.time) + '</span>' +
                        '<span class="tc-history-title">' + esc(x.title) + '</span>' +
                        '<span class="tc-history-state">' + esc(pageStatusLabel(x.status)) + '</span>' +
                        '<span class="tc-history-duration">' + (x.duration ? fmtDuration(x.duration) : '—') + '</span>' +
                        '<span class="tc-history-detail">' + esc(x.detail || '') + '</span>' +
                    '</div>';
                }).join('');
            }
        }
    }

    function setupPage() {
        pageRoot = document.getElementById('task-center-page');
        pageUi.ready = true;
        var refresh = document.getElementById('tcRefresh');
        if (refresh) refresh.addEventListener('click', function () { renderPage(); updateShell(); toast('任务状态已刷新'); });
        var clear = document.getElementById('tcClear');
        if (clear) clear.addEventListener('click', clearHistory);
        var list = document.getElementById('tcActiveList');
        if (list) list.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-task-retry]');
            if (btn) retry(parseInt(btn.getAttribute('data-task-retry'), 10));
        });
        renderPage();
    }

    // ---------- 常用写操作封装 ----------
    function gist(opts) {
        return enqueue({
            kind: 'gist',
            title: opts.title || '保存数据',
            timeout: opts.timeout || 45000,
            persist: {
                type: 'gist',
                gistId: opts.gistId,
                filename: opts.filename,
                data: opts.data,
                title: opts.title,
                description: opts.description
            },
            run: async function (ctx) {
                ctx.onProgress('正在写入 Gist…');
                var files = {};
                files[opts.filename] = {
                    content: (typeof opts.data === 'string') ? opts.data : JSON.stringify(opts.data, null, 2)
                };
                var body = { files: files };
                if (opts.description) body.description = opts.description;
                var res = await apiFetch('https://api.github.com/gists/' + opts.gistId, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ctx.signal
                });
                if (!res.ok) throw await parseError(res);
                ctx.onProgress('已保存到 Gist（即时生效）');
                return { detail: '已保存到 Gist（即时生效）' };
            }
        });
    }

    function saveFile(opts) {
        return enqueue({
            kind: 'file',
            title: opts.title || ('提交文件：' + opts.path),
            timeout: opts.timeout || 120000,
            onQueued: opts.onQueued,
            persist: {
                type: 'saveFile',
                path: opts.path,
                contentBase64: opts.contentBase64,
                message: opts.message,
                title: opts.title,
                verifyUrl: opts.verifyUrl,
                expected: opts.expected
            },
            run: async function (ctx) {
                var api = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo + '/contents/' + opts.path;
                ctx.onProgress('检查远端文件状态…');
                var sha = null;
                var getRes = await apiFetch(api + '?ref=' + REPO.branch, { signal: ctx.signal });
                if (getRes.ok) {
                    var info = await getRes.json();
                    sha = info.sha;
                } else if (getRes.status !== 404) {
                    throw await parseError(getRes);
                }
                var body = {
                    message: opts.message || ('update ' + opts.path),
                    content: opts.contentBase64,
                    branch: REPO.branch
                };
                if (sha) body.sha = sha;
                var baseline = opts.verifyUrl ? await baselineFor(opts.verifyUrl) : null;
                ctx.onProgress(sha ? '更新文件…' : '提交新文件…');
                var res = await apiFetch(api, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ctx.signal
                });
                // 并发提交冲突：重新取 sha 后自动重试一次
                if (res.status === 409 || res.status === 422) {
                    ctx.onProgress('检测到并发提交，重新同步后重试…');
                    var again = await apiFetch(api + '?ref=' + REPO.branch, { signal: ctx.signal });
                    if (again.ok) {
                        var info2 = await again.json();
                        body.sha = info2.sha;
                        res = await apiFetch(api, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                            signal: ctx.signal
                        });
                    }
                }
                if (!res.ok) throw await parseError(res);
                var data = await res.json().catch(function () { return null; });
                var commitSha = data && data.commit && data.commit.sha;
                ctx.onProgress('已提交（步骤 1/3），正在构建部署…');
                if (!commitSha) {
                    return { detail: '已提交到仓库（未获取到 commit SHA，无法跟踪部署状态）' };
                }
                supersedeDeployments(commitSha);
                return {
                    deploy: true,
                    commitSha: commitSha,
                    verifyUrl: opts.verifyUrl || '',
                    baseline: baseline,
                    path: opts.path,
                    expected: opts.expected || 'update'
                };
            }
        });
    }

    function deleteFile(opts) {
        return enqueue({
            kind: 'file',
            title: opts.title || ('删除文件：' + opts.path),
            timeout: opts.timeout || 60000,
            onQueued: opts.onQueued,
            persist: {
                type: 'deleteFile',
                path: opts.path,
                message: opts.message,
                title: opts.title,
                verifyUrl: opts.verifyUrl,
                expected: opts.expected
            },
            run: async function (ctx) {
                var api = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo + '/contents/' + opts.path;
                var baseline = opts.verifyUrl ? await baselineFor(opts.verifyUrl) : null;
                ctx.onProgress('检查远端文件…');
                var getRes = await apiFetch(api + '?ref=' + REPO.branch, { signal: ctx.signal });
                if (getRes.status === 404) {
                    ctx.onProgress('文件不存在，已跳过');
                    return { detail: '文件不存在，无需删除' };
                }
                if (!getRes.ok) throw await parseError(getRes);
                var info = await getRes.json();
                ctx.onProgress('删除文件…');
                var res = await apiFetch(api, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: opts.message || ('delete ' + opts.path),
                        sha: info.sha,
                        branch: REPO.branch
                    }),
                    signal: ctx.signal
                });
                if (!res.ok) throw await parseError(res);
                var data = await res.json().catch(function () { return null; });
                var commitSha = data && data.commit && data.commit.sha;
                if (!commitSha) {
                    return { detail: '已删除（未获取到 commit SHA，无法跟踪部署状态）' };
                }
                supersedeDeployments(commitSha);
                return {
                    deploy: true,
                    commitSha: commitSha,
                    verifyUrl: opts.verifyUrl || '',
                    baseline: baseline,
                    path: opts.path,
                    expected: 'delete'
                };
            }
        });
    }

    function isBusy() {
        return !!current || queue.length > 0 || deploying.length > 0;
    }

    // 网络状态提示（弱网/断网时任务会自动重试）
    window.addEventListener('offline', function () {
        toast('网络已断开：任务会等待并自动重试，请勿关闭页面', 'error');
    });
    window.addEventListener('online', function () {
        toast('网络已恢复，继续处理任务', 'success');
    });

    document.addEventListener('DOMContentLoaded', function () {
        ensureUi();
        var chip = document.getElementById('adminTaskState');
        if (chip) chip.addEventListener('click', function () { openPanel(); });
        resumePending();
        restoreWriteQueue();
        updateShell();
        ensureTicker();
    });

    return {
        enqueue: enqueue,
        gist: gist,
        saveFile: saveFile,
        deleteFile: deleteFile,
        retry: retry,
        isBusy: isBusy,
        isDeploying: function () { return deploying.length > 0; },
        openPanel: openPanel,
        clearHistory: clearHistory,
        _config: CONFIG
    };
})();

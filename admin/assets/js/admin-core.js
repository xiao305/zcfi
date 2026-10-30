/*!
 * admin-core.js — zcfi.cn 后台公共内核
 * ------------------------------------------------------------------
 * 解决的核心问题：以前每个后台页面各写一套登录校验，切换板块必须
 * 退回登录页重新输入 Token；有的页面在 beforeunload 时清掉 Token，
 * 一刷新就掉线。现在统一为：
 *   1. 登录一次，sessionStorage 内会话在 4 个板块间共享（2 小时滑动过期）
 *   2. 每个模块页自动渲染统一顶栏：仪表盘 / 博客 / 作品集 / 留言 / 配置
 *   3. 一键「更换 Token」「退出登录」，并显示当前 Token 权限
 *   4. 未登录/过期访问任意模块会自动跳登录页，登录后原路返回
 *
 * 用法：
 *   在页面 <head> 引入（defer 保证在页面脚本前执行）：
 *     <script src="assets/js/admin-core.js" defer></script>
 *   在 <body> 上声明所属板块：
 *     <body class="admin-body" data-admin-module="blog">
 *   页面脚本中可直接使用：
 *     AdminCore.getToken() / AdminCore.apiFetch(url, options) / AdminCore.escapeHtml(s)
 */
(function (global) {
  'use strict';

  var KEYS = {
    token: 'admin_token',
    verified: 'admin_verified',
    loginTime: 'admin_login_time',
    permissions: 'admin_permissions',
    selectedModule: 'selected_module',
    pendingToken: 'pending_admin_token',
    pendingModule: 'pending_selected_module',
    pendingPermissions: 'token_permissions'
  };

  // 会话有效期（滑动）：每次打开板块页都会续期，避免编辑到一半被踢出
  var SESSION_MAX_AGE = 2 * 60 * 60 * 1000;

  var MODULES = [
    { id: 'dashboard', name: '仪表盘', icon: 'fas fa-th-large',   url: 'dashboard.html' },
    { id: 'blog',      name: '博客',   icon: 'fas fa-blog',       url: 'blog.html' },
    { id: 'portfolio', name: '作品集', icon: 'fas fa-briefcase',  url: 'portfolio.html' },
    { id: 'contact',   name: '留言',   icon: 'fas fa-comments',   url: 'contact.html' },
    { id: 'config',    name: '配置',   icon: 'fas fa-cog',        url: 'config.html' }
  ];

  function storage() {
    try { return global.sessionStorage; } catch (e) { return null; }
  }
  function sget(key) {
    var s = storage();
    try { return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function sset(key, value) {
    var s = storage();
    try { if (s) s.setItem(key, value); } catch (e) { /* 隐私模式等忽略 */ }
  }
  function sremove(key) {
    var s = storage();
    try { if (s) s.removeItem(key); } catch (e) { /* ignore */ }
  }

  function currentPage() {
    var path = global.location.pathname || '';
    var page = path.split('/').pop() || 'index.html';
    return page + (global.location.search || '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function safeUrl(value) {
    var url = String(value == null ? '' : value).trim();
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || /^(mailto|tel):/i.test(url)) return url;
    // 其它协议（javascript:、data: 等）一律拒绝；相对路径放行
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
    return url;
  }

  function getPermissions() {
    try { return JSON.parse(sget(KEYS.permissions) || '{}'); } catch (e) { return {}; }
  }

  function getLoginTime() {
    var value = parseInt(sget(KEYS.loginTime) || '0', 10);
    return isFinite(value) ? value : 0;
  }

  function isExpired() {
    var at = getLoginTime();
    // 兼容老会话：有 Token 但没有登录时间时视为有效，并补记时间
    if (!at) return !sget(KEYS.token);
    return (Date.now() - at) > SESSION_MAX_AGE;
  }

  function hasSession() {
    return !!(sget(KEYS.token) && sget(KEYS.verified) === 'true') && !isExpired();
  }

  function touch() {
    if (sget(KEYS.token)) sset(KEYS.loginTime, String(Date.now()));
  }

  function clearSession() {
    sremove(KEYS.token);
    sremove(KEYS.verified);
    sremove(KEYS.loginTime);
    sremove(KEYS.permissions);
    sremove(KEYS.pendingToken);
    sremove(KEYS.pendingModule);
    sremove(KEYS.pendingPermissions);
  }

  function redirectToLogin(reason) {
    var params = new URLSearchParams();
    params.set('returnTo', currentPage());
    if (reason === 'expired') params.set('expired', '1');
    global.location.replace('index.html?' + params.toString());
  }

  function requireAuth() {
    if (!sget(KEYS.token) || sget(KEYS.verified) !== 'true') {
      redirectToLogin('login');
      return false;
    }
    if (isExpired()) {
      clearSession();
      redirectToLogin('expired');
      return false;
    }
    touch();
    return true;
  }

  function login(token, permissions, module) {
    sset(KEYS.token, token);
    sset(KEYS.verified, 'true');
    sset(KEYS.loginTime, String(Date.now()));
    sset(KEYS.permissions, JSON.stringify(permissions || {}));
    if (module) sset(KEYS.selectedModule, module);
  }

  function logout(options) {
    var target = 'index.html?logout=1';
    if (options && options.expired) target = 'index.html?expired=1';
    clearSession();
    global.location.replace(target);
  }

  function changeToken() {
    clearSession();
    global.location.replace('index.html?relogin=1');
  }

  function maskToken(token) {
    if (!token) return '未登录';
    return token.length > 12 ? token.slice(0, 7) + '…' + token.slice(-4) : '••••••';
  }

  function moduleById(id) {
    for (var i = 0; i < MODULES.length; i++) {
      if (MODULES[i].id === id) return MODULES[i];
    }
    return null;
  }

  function renderShell(activeId) {
    if (!global.document || !global.document.body) return;
    if (global.document.getElementById('admin-shell')) return;

    var permissions = getPermissions();
    var gistOk = permissions.gist ? '✓' : '✗';
    var repoOk = permissions.repo ? '✓' : '✗';
    var tokenText = 'Token ' + maskToken(sget(KEYS.token));

    var links = MODULES.map(function (item) {
      var active = item.id === activeId ? ' active' : '';
      var current = item.id === activeId ? ' aria-current="page"' : '';
      return '<a class="admin-tab' + active + '" href="' + item.url + '"' + current + '>' +
        '<i class="' + item.icon + '" aria-hidden="true"></i><span>' + escapeHtml(item.name) + '</span></a>';
    }).join('');

    var shell = global.document.createElement('div');
    shell.id = 'admin-shell';
    shell.className = 'admin-shell';
    shell.innerHTML =
      '<div class="admin-shell-inner">' +
        '<a class="admin-shell-brand" href="dashboard.html">zcfi<span class="brand-dot">.</span>cn <em>后台</em></a>' +
        '<nav class="admin-shell-nav" aria-label="后台板块导航">' + links + '</nav>' +
        '<div class="admin-shell-user">' +
          '<span class="admin-token-chip" title="' + escapeAttr(tokenText) + '">' +
            escapeHtml(tokenText) +
            ' <span class="' + (permissions.gist ? 'ok' : 'missing') + '">gist ' + gistOk + '</span>' +
            ' <span class="' + (permissions.repo ? 'ok' : 'missing') + '">repo ' + repoOk + '</span>' +
          '</span>' +
          '<button type="button" class="admin-shell-btn" id="adminReloginBtn" title="清除当前 Token 并重新输入" aria-label="更换 Token">' +
            '<i class="fas fa-key" aria-hidden="true"></i><span>更换 Token</span></button>' +
          '<button type="button" class="admin-shell-btn admin-shell-btn-danger" id="adminLogoutBtn" title="退出登录" aria-label="退出登录">' +
            '<i class="fas fa-sign-out-alt" aria-hidden="true"></i><span>退出</span></button>' +
        '</div>' +
      '</div>';

    global.document.body.insertBefore(shell, global.document.body.firstChild);
    global.document.body.classList.add('has-admin-shell');

    var reloginBtn = global.document.getElementById('adminReloginBtn');
    if (reloginBtn) reloginBtn.addEventListener('click', function () { changeToken(); });

    var logoutBtn = global.document.getElementById('adminLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () { logout(); });
  }

  function toast(message, type) {
    if (!global.document || !global.document.body) return;
    var node = global.document.createElement('div');
    node.className = 'admin-toast admin-toast-' + (type || 'info');
    node.textContent = message;
    global.document.body.appendChild(node);
    setTimeout(function () {
      node.classList.add('admin-toast-hide');
      setTimeout(function () { node.remove(); }, 350);
    }, 2600);
  }

  /**
   * 带 Token 的 GitHub API 请求（直连 api.github.com，不经过任何 CORS 代理）
   * 401 时自动清理会话并跳回登录页。
   */
  function apiFetch(url, options) {
    var opts = options ? Object.assign({}, options) : {};
    var headers = Object.assign({ 'Accept': 'application/vnd.github.v3+json' }, opts.headers || {});
    var token = sget(KEYS.token);
    if (token) headers['Authorization'] = 'token ' + token;
    opts.headers = headers;
    return global.fetch(url, opts).then(function (response) {
      if (response.status === 401 && token) {
        clearSession();
        redirectToLogin('expired');
      }
      return response;
    });
  }

  function boot() {
    var body = global.document && global.document.body;
    if (!body) return;
    var moduleId = body.getAttribute('data-admin-module');
    if (!moduleId) return; // 登录页自己处理会话，不在这里自动跳转
    if (!requireAuth()) return;
    renderShell(moduleId);
  }

  var AdminCore = {
    KEYS: KEYS,
    MODULES: MODULES,
    SESSION_MAX_AGE: SESSION_MAX_AGE,
    getToken: function () { return sget(KEYS.token) || ''; },
    getPermissions: getPermissions,
    getLoginTime: getLoginTime,
    isExpired: isExpired,
    hasSession: hasSession,
    requireAuth: requireAuth,
    login: login,
    logout: logout,
    changeToken: changeToken,
    clearSession: clearSession,
    touch: touch,
    maskToken: maskToken,
    moduleById: moduleById,
    renderShell: renderShell,
    currentPage: currentPage,
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    safeUrl: safeUrl,
    apiFetch: apiFetch,
    toast: toast
  };

  global.AdminCore = AdminCore;

  // 模块页：脚本解析完（defer 阶段）立刻执行鉴权，早于页面自身的 DOMContentLoaded 逻辑
  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

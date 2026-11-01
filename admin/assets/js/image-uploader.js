/*!
 * image-uploader.js — 后台图片上传（GitHub Contents API，无服务器）
 * 功能：选择/拖拽图片 → 浏览器压缩 → 自定义文件名 → 上传前预览目标路径与 URL → 确认上传
 * 依赖：AdminCore（token、权限、toast）
 */
window.AdminImageUploader = (function () {
    'use strict';

    var REPO = { owner: 'xiao305', repo: 'zcfi', branch: 'main', folder: 'assets/img/uploads' };
    var SITE_ORIGIN = 'https://zcfi.cn';
    var MAX_BYTES = 900 * 1024; // Contents API 单文件建议 <1MB

    var root, fileInput, drop, previewWrap, previewImg, nameInput, sizeEl, pathEl, urlEl, tipEl, errEl, uploadBtn, cancelBtn;
    var state = { blob: null, ext: 'webp', width: 0, height: 0, sha: null, callback: null, busy: false, checkTimer: null };

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ensureDom() {
        if (root) return;
        root = document.createElement('div');
        root.className = 'upla-overlay';
        root.hidden = true;
        root.innerHTML =
            '<div class="upla-dialog" role="dialog" aria-modal="true" aria-label="上传图片">' +
                '<div class="upla-head"><h3><i class="fas fa-image" aria-hidden="true"></i> 上传图片</h3>' +
                    '<button type="button" class="upla-x" aria-label="关闭"><i class="fas fa-times" aria-hidden="true"></i></button></div>' +
                '<div class="upla-body">' +
                    '<label class="upla-drop">' +
                        '<input type="file" accept="image/*" hidden>' +
                        '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>' +
                        '<span>点击选择图片，或把图片拖到这里</span>' +
                        '<small>支持 JPG / PNG / WebP / GIF；自动压缩为 WebP（最长边 1600px），一般小于 300KB</small>' +
                    '</label>' +
                    '<div class="upla-preview" hidden><img alt="预览"></div>' +
                    '<div class="upla-row"><label class="upla-label">文件名</label>' +
                        '<input type="text" class="upla-name" placeholder="例如 project-cover" autocomplete="off">' +
                        '<span class="upla-size"></span></div>' +
                    '<div class="upla-path"><span>目标路径</span><code class="upla-path-text">—</code></div>' +
                    '<div class="upla-path"><span>预计 URL</span><code class="upla-url-text">—</code></div>' +
                    '<p class="upla-tip">上传后 GitHub Pages 构建约 1 分钟生效；同名文件会提示覆盖。</p>' +
                    '<p class="upla-error" hidden></p>' +
                '</div>' +
                '<div class="upla-foot">' +
                    '<button type="button" class="admin-btn btn-secondary upla-cancel">取消</button>' +
                    '<button type="button" class="admin-btn btn-primary upla-upload" disabled>确认上传</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(root);

        drop = root.querySelector('.upla-drop');
        fileInput = drop.querySelector('input[type=file]');
        previewWrap = root.querySelector('.upla-preview');
        previewImg = previewWrap.querySelector('img');
        nameInput = root.querySelector('.upla-name');
        sizeEl = root.querySelector('.upla-size');
        pathEl = root.querySelector('.upla-path-text');
        urlEl = root.querySelector('.upla-url-text');
        tipEl = root.querySelector('.upla-tip');
        errEl = root.querySelector('.upla-error');
        uploadBtn = root.querySelector('.upla-upload');
        cancelBtn = root.querySelector('.upla-cancel');

        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
        });
        ['dragenter', 'dragover'].forEach(function (evt) {
            drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
            drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (e) {
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && /^image\//.test(file.type)) handleFile(file);
        });
        nameInput.addEventListener('input', function () { updatePath(); scheduleExistCheck(); });
        nameInput.addEventListener('blur', function () {
            // 扩展名由压缩结果决定，避免出现 .jpg 文件名但内容是 webp 的情况
            nameInput.value = sanitizeName(nameInput.value) + '.' + state.ext;
            updatePath();
            scheduleExistCheck();
        });
        uploadBtn.addEventListener('click', upload);
        cancelBtn.addEventListener('click', close);
        root.querySelector('.upla-x').addEventListener('click', close);
        root.addEventListener('click', function (e) { if (e.target === root) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && root && !root.hidden) close();
        });
    }

    function open(opts) {
        ensureDom();
        opts = opts || {};
        state = { blob: null, ext: 'webp', width: 0, height: 0, sha: null, callback: opts.onUploaded || null, busy: false, checkTimer: null };
        fileInput.value = '';
        previewWrap.hidden = true;
        previewImg.removeAttribute('src');
        sizeEl.textContent = '';
        errEl.hidden = true;
        errEl.textContent = '';
        uploadBtn.disabled = true;
        uploadBtn.textContent = '确认上传';
        nameInput.value = sanitizeName(opts.defaultName || 'image') + '.webp';
        tipEl.textContent = '上传后 GitHub Pages 构建约 1 分钟生效；同名文件会提示覆盖。';
        var perms = (window.AdminCore && AdminCore.getPermissions) ? AdminCore.getPermissions() : {};
        if (!perms.repo) {
            tipEl.innerHTML = '<span style="color:#c82333;font-weight:600;">当前 Token 没有 repo/public_repo 写权限，上传会失败。</span> 建议先用具备该权限的 Token 登录。';
        }
        updatePath();
        root.hidden = false;
        document.body.style.overflow = 'hidden';
        nameInput.focus();
        nameInput.select();
    }

    function close() {
        if (!root) return;
        root.hidden = true;
        document.body.style.overflow = '';
        if (state.blobUrl) {
            URL.revokeObjectURL(state.blobUrl);
            state.blobUrl = null;
        }
    }

    function sanitizeName(name) {
        var base = String(name || 'image')
            .replace(/\.[a-z0-9]+$/i, '')
            .replace(/\s+/g, '-')
            .replace(/[^A-Za-z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-.]+|[-.]+$/g, '');
        return base || 'image';
    }

    function currentFile() {
        // 扩展名固定使用压缩结果（.webp 或 .jpg），文件名部分可自定义
        return sanitizeName(nameInput.value) + '.' + state.ext;
    }

    function updatePath() {
        var file = currentFile();
        var path = REPO.folder + '/' + file;
        pathEl.textContent = path;
        urlEl.textContent = SITE_ORIGIN + '/' + path;
        if (sizeEl.textContent) {
            sizeEl.textContent = sizeEl.textContent.replace(/\s*·\s*已存在$/, '');
        }
    }

    var checkSeq = 0;

    function scheduleExistCheck() {
        state.sha = null;
        state.checkedName = null;
        checkSeq += 1;
        clearTimeout(state.checkTimer);
        state.checkTimer = setTimeout(function () { checkExisting(checkSeq); }, 420);
    }

    function checkExisting(seq) {
        if (seq === undefined) { seq = ++checkSeq; }
        if (!state.blob || !window.AdminCore) return Promise.resolve();
        var file = currentFile();
        var path = REPO.folder + '/' + file;
        return AdminCore.apiFetch('https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo + '/contents/' + path + '?ref=' + REPO.branch)
            .then(function (res) {
                if (seq !== checkSeq) return; // 文件名已变，丢弃旧请求结果
                state.checkedName = file;
                if (res.ok) {
                    return res.json().then(function (data) {
                        if (seq !== checkSeq) return;
                        state.sha = data.sha;
                        var warning = ' · 已存在同名文件，上传将覆盖';
                        if (sizeEl.textContent.indexOf('已存在') === -1) sizeEl.textContent += warning;
                    });
                }
                state.sha = null;
            })
            .catch(function () {
                if (seq === checkSeq) state.sha = null;
            });
    }

    function handleFile(file) {
        if (!/^image\//.test(file.type)) { showError('请选择图片文件'); return; }
        if (file.size > 20 * 1024 * 1024) { showError('图片过大（>20MB），请先压缩'); return; }
        errEl.hidden = true;
        sizeEl.textContent = '正在处理…';
        nameInput.value = sanitizeName(file.name) + '.webp';
        compress(file).then(function (out) {
            if (!out) { showError('图片处理失败，请换一张试试'); return; }
            if (state.blob && state.blobUrl) URL.revokeObjectURL(state.blobUrl);
            state.blob = out.blob;
            state.ext = out.ext;
            state.width = out.width;
            state.height = out.height;
            state.blobUrl = URL.createObjectURL(out.blob);
            previewImg.src = state.blobUrl;
            previewWrap.hidden = false;
            nameInput.value = sanitizeName(file.name) + '.' + out.ext;
            sizeEl.textContent = out.width + '×' + out.height + ' · ' + formatSize(out.blob.size);
            uploadBtn.disabled = false;
            updatePath();
            scheduleExistCheck();
        }).catch(function () { showError('图片处理失败，请换一张试试'); });
    }

    function compress(file) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                var maxEdge = 1600;
                var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
                var w = Math.max(1, Math.round(img.width * scale));
                var h = Math.max(1, Math.round(img.height * scale));
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                function tryBlob(type, quality, cb) {
                    canvas.toBlob(function (blob) { cb(blob); }, type, quality);
                }
                var qualities = [0.82, 0.7, 0.6];
                var idx = 0;
                (function attempt() {
                    tryBlob('image/webp', qualities[idx], function (blob) {
                        if (blob && blob.type === 'image/webp') {
                            if (blob.size > MAX_BYTES && idx < qualities.length - 1) { idx++; attempt(); return; }
                            resolve({ blob: blob, ext: 'webp', width: w, height: h });
                        } else {
                            tryBlob('image/jpeg', 0.85, function (jpeg) {
                                resolve({ blob: jpeg, ext: 'jpg', width: w, height: h });
                            });
                        }
                    });
                })();
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    function showError(msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
    }

    function upload() {
        if (state.busy) return;
        if (!state.blob) { showError('请先选择图片'); return; }
        if (!window.AdminCore) { showError('后台内核未加载'); return; }
        if (state.blob.size > 1.2 * 1024 * 1024) { showError('压缩后仍超过 1.2MB，请换一张更小的图片'); return; }
        var filename = currentFile();
        var path = REPO.folder + '/' + filename;
        state.busy = true;
        uploadBtn.disabled = true;
        uploadBtn.textContent = '上传中…';
        errEl.hidden = true;

        function doUpload() {
            var reader = new FileReader();
            reader.onload = function () {
                var base64 = String(reader.result).split(',')[1] || '';
                var body = {
                    message: 'upload image: ' + filename + ' (admin)',
                    content: base64,
                    branch: REPO.branch
                };
                if (state.sha) body.sha = state.sha;
                AdminCore.apiFetch('https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo + '/contents/' + path, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }).then(function (res) {
                    if (res.ok) return res.json();
                    return res.json().catch(function () { return {}; }).then(function (data) {
                        throw new Error(data.message || ('上传失败 HTTP ' + res.status));
                    });
                }).then(function () {
                    var url = SITE_ORIGIN + '/' + path;
                    state.busy = false;
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = '确认上传';
                    close();
                    if (typeof state.callback === 'function') state.callback(url, path);
                    if (window.AdminCore && AdminCore.toast) {
                        AdminCore.toast('图片已上传：' + filename + '（约 1 分钟后全站可用）', 'success');
                    }
                }).catch(function (err) {
                    state.busy = false;
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = '确认上传';
                    showError(err && err.message ? err.message : '上传失败，请检查 Token 权限或网络');
                });
            };
            reader.readAsDataURL(state.blob);
        }

        // 文件名可能刚改过：先确认一次 sha（用于覆盖同名文件），再上传
        if (state.checkedName === filename) {
            doUpload();
        } else {
            var seq = ++checkSeq;
            checkExisting(seq).then(doUpload, doUpload);
        }
    }

    // 在 textarea 光标处插入文本（供博客正文插入图片）
    function insertAtCursor(textarea, text) {
        if (!textarea) return;
        var start = textarea.selectionStart || 0;
        var end = textarea.selectionEnd || 0;
        var value = textarea.value || '';
        textarea.value = value.slice(0, start) + text + value.slice(end);
        var pos = start + text.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return { open: open, close: close, insertAtCursor: insertAtCursor };
})();

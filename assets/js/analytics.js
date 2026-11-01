/*!
 * analytics.js — 访问统计接入点（可选，纯前端）
 *
 * 说明（重要）：
 *   本站托管在 GitHub Pages，没有自建服务器，因此统计只能接入第三方
 *   隐私友好型服务。当前配置为空时脚本不加载任何东西、不产生任何请求。
 *
 * 支持两种方式（二选一，填好下面配置即可）：
 *
 * 1) GoatCounter（推荐，免费、无 Cookie、可公开看板）
 *    - 到 https://www.goatcounter.com/ 注册，得到站点代码，例如 zcfi
 *    - provider: 'goatcounter', site: 'zcfi'
 *    - 统计脚本：https://gc.zgo.at/count.js
 *
 * 2) Cloudflare Web Analytics（需 Cloudflare 账号）
 *    - 在 Cloudflare 控制台创建 Web Analytics，拿到 token
 *    - provider: 'cloudflare', token: 'xxxxxxxx'
 *    - 统计脚本：https://static.cloudflareinsights.com/beacon.min.js
 */
(function () {
    'use strict';

    var CONFIG = {
        provider: '',   // 'goatcounter' | 'cloudflare' | ''（留空 = 不启用）
        site: '',       // GoatCounter 站点代码
        token: ''       // Cloudflare Web Analytics token
    };

    if (!CONFIG.provider) return;

    if (CONFIG.provider === 'goatcounter' && CONFIG.site) {
        var gc = document.createElement('script');
        gc.async = true;
        gc.src = 'https://gc.zgo.at/count.js';
        gc.setAttribute('data-goatcounter', 'https://' + CONFIG.site + '.goatcounter.com/count');
        document.head.appendChild(gc);
        return;
    }

    if (CONFIG.provider === 'cloudflare' && CONFIG.token) {
        var cf = document.createElement('script');
        cf.defer = true;
        cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
        cf.setAttribute('data-cf-beacon', JSON.stringify({ token: CONFIG.token }));
        document.head.appendChild(cf);
    }
})();

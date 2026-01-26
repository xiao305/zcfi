# zcfi
zcfi.cn/
├── favicon/                     # 网站图标资源
│   ├── favicon.svg
│   ├── favicon-96x96.png
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── site.webmanifest
│
├── assets/
│   ├── css/
│   │   ├── style.css            # 前台主样式
│   │   └── components.css       # 公共组件样式（现在可能只包含一些基础样式）
│   │
│   ├── js/
│   │   ├── main.js              # 前台基础交互
│   │   ├── gist-renderer.js     # ✅ 新的：从Gist加载配置并渲染导航栏/页脚
│   │   └── config-loader.js     # ❌ 旧的：已弃用，被gist-renderer.js取代
│   │
│   └── components/              # ❌ 旧组件目录（已弃用）
│       ├── navbar.html          # ❌ 旧导航栏组件
│       └── footer.html          # ❌ 旧页脚组件
│
├── admin/                       # 后台管理系统（保持不变）
│   ├── index.html               # 后台登录入口
│   ├── config.html              # 网站配置管理
│   ├── portfolio.html           # 作品集管理
│   ├── blog.html                # 博客管理
│   ├── contact.html             # 留言管理
│   └── assets/
│       └── css/
│           └── admin-common.css # 后台公共样式
│
├── index.html                   # ✅ 首页（已更新，使用gist-renderer.js）
├── portfolio.html               # ✅ 作品集页（需要更新，使用gist-renderer.js）
├── blog.html                    # ✅ 博客页（需要更新，使用gist-renderer.js）
├── contact.html                 # ✅ 联系页（需要更新，使用gist-renderer.js）
├── privacy.html                 # ✅ 隐私政策页（需要更新，使用gist-renderer.js）
├── terms.html                   # ✅ 使用条款页（需要更新，使用gist-renderer.js）
└── copyright.html               # ✅ 版权声明页（需要更新，使用gist-renderer.js）

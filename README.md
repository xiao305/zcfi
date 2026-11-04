# zcfi.cn 个人网站

纯静态个人网站，托管在 **GitHub Pages**（自定义域名 `zcfi.cn`），内容通过 **GitHub Gist + GitHub API** 管理，**没有自建服务器**。

- 线上地址：<https://zcfi.cn>
- 后台入口：<https://zcfi.cn/admin/>
- 仓库：<https://github.com/xiao305/zcfi>

---

## 架构

```
浏览器 ── 静态页面/CSS/JS/字体/图标 ──> GitHub Pages（zcfi.cn）
   │
   ├─ 导航/页脚/博客/作品/法律文本 ──> gist.githubusercontent.com（JSON）
   └─ /admin/ 输入 GitHub Token ──> api.github.com（读 Gist / 写 Gist、提交仓库文件）
```

- **内容数据**：3 个 Gist
  - 站点配置：`983bb7371ddb439a2fcbfb4885e34d14`（config.json / pages.json）
  - 博客：`73cc78400c25eb9effed665e2c89843d`（blog.json）
  - 作品集：`311b9a0a483aafc4314d17f577e859bb`（portfolio.json）
- **后台**：纯前端 + GitHub Personal Access Token（需 `gist`，生成文章页/上传图片另需 `repo` 或 `public_repo`）。Token 只保存在当前标签页的 `sessionStorage`，不会提交到仓库。

---

## 目录结构

```
.
├── index.html                 # 首页（hero + 精选作品 + 最新博客 + 站内搜索框）
├── portfolio.html             # 作品集（技术栈筛选/排序/详情弹层）
├── blog.html                  # 博客列表（搜索/标签/排序/加载更多）
├── contact.html               # 联系页（表单 + 邮件兜底）
├── privacy.html               # 隐私政策
├── terms.html                 # 使用条款
├── copyright.html             # 版权声明
├── 404.html                   # 自定义 404（搜索 + 最近文章 + 快捷入口）
├── robots.txt                 # 爬虫规则（后台/模板不收录）
├── sitemap.xml                # 站点地图
├── CNAME                      # GitHub Pages 自定义域名
│
├── assets/
│   ├── css/
│   │   ├── style.css          # 前台主样式
│   │   ├── components.css     # 基础组件样式
│   │   ├── features.css       # 站内搜索/博客工具栏/作品集/文章增强/404 样式
│   │   ├── icons.css          # Font Awesome 图标子集样式
│   │   ├── page-state.css     # 页面维护提示/布局模板样式
│   │   └── fonts.css          # 自托管字体子集声明
│   ├── fonts/
│   │   ├── fa-solid.woff2 / fa-brands.woff2          # 图标子集
│   │   ├── poppins-400/500/600/700.woff2             # 拉丁字体子集
│   │   └── notosanssc-400/500/700.woff2              # 中文子集
│   ├── js/
│   │   ├── main.js            # 基础交互（移动端菜单、滚动阴影、平滑滚动）
│   │   ├── gist-renderer.js   # 读取配置 Gist，渲染导航/页脚
│   │   ├── site-data.js       # 博客/作品数据加载 + 会话缓存
│   │   ├── search.js          # 全站搜索弹层（导航/首页/404/键盘 /）
│   │   ├── article-enhance.js # 文章页：TOC/进度/阅读时长/上下篇/相关文章/分享
│   │   ├── portfolio-page.js  # 作品集筛选/排序/详情
│   │   └── analytics.js       # 访问统计接入点（默认关闭）
│   ├── components/            # ⚠️ 旧组件（已废弃，保留未用）
│   └── img/uploads/           # 后台图片上传目录（按需创建）
│
├── blogs/
│   ├── post1.html / post2.html # 已生成的文章页
│   ├── template.html           # 生成文章页使用的模板
│   └── post.html               # ⚠️ 历史占位文件（未清理）
│
├── admin/                      # 后台（纯前端）
│   ├── index.html              # 登录页（Token → 仪表盘）
│   ├── dashboard.html          # 仪表盘（统计/最近更新/快捷操作/会话/数据源）
│   ├── tasks.html              # 任务中心（进行中/排队/完整历史）
│   ├── pages.html              # 页面管理（全站页面状态/模板，写 pages.json）
│   ├── blog.html               # 博客管理（含生成文章页）
│   ├── portfolio.html          # 作品集管理（含图片上传）
│   ├── contact.html            # 留言管理
│   ├── config.html             # 站点配置
│   └── assets/
│       ├── css/                # admin-common / admin-shell / image-uploader / task-center
│       └── js/                 # admin-core（统一会话+顶栏）/ image-uploader / task-center
│
├── data/pages.json             # 全站页面状态/模板（页面管理保存时提交，随 Pages 部署）
│
└── xy/                         # 独立子站（媒体浏览工具），与主站分开维护
```

> `xy/` 是挂在该域名下的独立子站，主站优化/改版不会修改它。

---

## 主要功能

**前台**
- 响应式布局、移动端导航、自定义 404
- 首页/作品集/博客数据来自 Gist，客户端渲染
- 博客：关键词搜索、标签筛选、排序、加载更多（筛选状态写入 URL）
- 全站搜索：导航 🔍 / 首页搜索框 / 404 搜索框 / 键盘 `/`
- 文章页：自动目录、阅读进度、阅读时长、上一篇/下一篇、相关文章、分享
- 作品集：技术栈筛选、排序、详情弹层
- 字体与图标全部自托管（无 Google Fonts / cdnjs 外链）

**后台**
- 统一登录会话（2 小时滑动过期），一次登录可在仪表盘/博客/作品集/留言/配置间切换
- 仪表盘：博客/作品/留言/会话统计、最近更新、数据源状态
- **任务中心（独立页面）**：顶栏与仪表盘同级，汇总进行中/排队任务、四步进度与最近 20 条历史；各页右下角仍保留悬浮任务面板。
- **页面管理（独立页面）**：与任务中心同级，统一控制首页/博客/作品集/联系/法律页/404 的公开状态、公开模板（标准/阅读/宽屏/紧凑/卡片）和维护模板（经典/法律声明风/极简/渐变/公告），支持模板预览；保存时同时写 Config Gist 的 `pages.json`（后台读取/备份）和仓库同源 `data/pages.json`（前台读取），部署完成后生效。
- **编辑文章也会重建页面**：直接编辑文章完整内容/标题/日期/摘要等页面字段时，除保存 Gist 外会重新提交 `blogs/{id}.html`；摘要不直接展示在文章正文，仅在未填 SEO 描述时作为页面 meta description 的兜底。
- **仪表盘任务卡**：首页仪表盘新增任务中心概览，实时显示进行中/排队/部署中数量与最近任务，可直接跳转任务中心。
- 博客：编辑文章、生成独立文章页、模板管理
- 作品集：编辑项目、首页展示排序、图片上传（浏览器压缩、自定义文件名、上传前 URL 预估）
- 配置：站点信息、导航、页脚、法律文本
- 留言：查看/标记状态（数据模型待完善）
- **GitHub 任务中心**：所有保存/提交/上传统一进入串行队列（避免并发冲突），右下角面板实时显示状态、耗时与失败原因，支持一键重试与历史记录。
- **部署跟踪**：仓库文件提交后不会直接算"成功"，而是继续显示 `已提交（1/3）→ 构建（2/3）→ 部署（3/3）→ 已生效`；确认站点实际更新后才显示"已生效"。
- **部署期间再提交**：新的仓库写入会**排队等待当前部署完成**后再提交，不会中断/取代正在进行的部署（Gist 保存不受影响，可即时执行）；只有部署被外部提交取消时才显示"已取代"。
- **排队不卡页面**：进入排队时原来的"正在保存"弹窗会自动关闭，任务转到后台继续，右下角任务中心自动弹出显示排队原因与进度；完成后再刷新列表/提示结果。
- **Gist 与部署互不阻塞**：Gist 保存立即执行（不受页面部署排队影响），页面文件才按部署队列排队。
- **后台完成不打扰**：排队/后台完成的保存不再弹"保存成功"模态，只用任务中心和短暂提示；"已加入队列"提示会自动关闭。
- **任务队列跨页恢复**：写操作会持久化到 localStorage，切换到任务中心页面或刷新后会自动恢复并继续；不再弹浏览器的“离开页面”确认。
- **完成动效**：任务完成时卡片会播放对勾绘制/折叠归档动画，并写入最近记录（支持系统“减少动态效果”设置）。
- **无改动不重建**：高级配置没有实际变化时直接提示"没有修改"，不会重新生成文章页或提交。
- **重建规则**：修改标题/正文/日期/作者/标签/SEO 会重新生成页面（这些字段在模板里）；仅修改"页面启用"等不参与页面的字段时，只更新 Gist，不重新生成。
- **模板预加载**：文章模板优先通过 GitHub Contents API（带 Token）获取并缓存，raw 地址作为兜底、8 秒超时；模板内容异常（缺页眉/页脚）时停止生成，避免生成错误页面。
- 顶栏会显示"保存中 / 部署中 / 已生效 / 失败"状态；任务会跨页恢复，不再拦截离开页面。

---

## 本地开发

由于页面会请求 GitHub API / Gist，**不能直接双击 `file://` 打开**，需要起一个本地静态服务器（仅开发用，不是线上服务器）：

```bash
python -m http.server 8000
```

然后访问：

- 前台：<http://localhost:8000/>
- 后台：<http://localhost:8000/admin/>

后台登录需要 GitHub Token（仅本地调试时使用，注意不要泄露）。

---

## 内容更新流程

1. 打开 <https://zcfi.cn/admin/>，输入 GitHub Token 登录；
2. 在对应板块编辑内容并保存 → 内容写入对应 Gist；
3. 博客文章可勾选"生成独立页面"→ 提交生成 `blogs/{id}.html`；
4. 仓库文件（文章页/模板/图片）提交后，GitHub Actions 会执行"pages build and deployment"（构建 + 部署，约 1–2 分钟）；后台任务中心会显示当前步骤，**部署完成并确认站点更新后才提示"已生效"**；
5. 部署期间再次保存仓库文件：新任务会**排队等待当前部署完成**后再提交（避免中断正在进行的部署）；部署被外部提交取消时才会显示"已取代"；GitHub Pages 本身有约 10 分钟缓存，看不到更新可用 `Ctrl+F5` 强刷。

> 图片上传：后台 → 作品集编辑 → 项目图片 →「上传图片」；文件会提交到 `assets/img/uploads/`，支持自定义文件名与上传前 URL 预估。

---

## 资源说明

- **图标子集**：`assets/css/icons.css` + `assets/fonts/fa-*.woff2`，只包含站点实际用到的图标（约 111 个规则），新增图标类时需重新生成子集。
- **字体子集**：`assets/css/fonts.css` + `assets/fonts/*.woff2`，按站点当前字符集生成；新增生僻字会自动回退系统字体。
- 生成脚本使用 [fonttools](https://github.com/fonttools/fonttools) 与 Google Fonts 子集接口，未包含在本仓库（如需持续新增内容后可考虑加入 `tools/`）。

---

## 部署

- 推送到 `main` 分支即可，GitHub Pages 自动构建发布（约 1 分钟）。
- `CNAME` 指向 `zcfi.cn`；HTTPS 由 GitHub Pages 提供。
- 后台页面已加 `meta robots noindex`，并在 `robots.txt` 中禁止抓取 `/admin/`。

---

## 安全说明

- 后台 Token 仅存于 `sessionStorage`（关闭标签页失效），不会写入仓库；
- 后台请求直连 `api.github.com`，不经过任何第三方代理；
- 图片上传只通过当前 Token 写入本仓库，可在 GitHub 上随时撤销/更换 Token。

---

## 相关链接

- 隐私政策：<https://zcfi.cn/privacy.html>
- 使用条款：<https://zcfi.cn/terms.html>
- 版权声明：<https://zcfi.cn/copyright.html>
- 许可证：[LICENSE.md](LICENSE.md)

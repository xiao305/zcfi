// Gist配置渲染库
class GistRenderer {
    constructor() {
        this.CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
        this.CONFIG_URL = `https://gist.githubusercontent.com/xiao305/${this.CONFIG_GIST_ID}/raw/config.json`;
        this.configData = null;
    }

    // 加载配置
    async loadConfig() {
        if (this.configData) return this.configData;
        
        try {
            const timestamp = Date.now();
            const response = await fetch(`${this.CONFIG_URL}?t=${timestamp}`);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.configData = await response.json();
            console.log('Gist配置加载成功');
            return this.configData;
        } catch (error) {
            console.error('加载Gist配置失败:', error);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            site: {
                name: 'zcfi.cn',
                description: '个人网站和作品展示平台'
            },
            navigation: {
                items: [
                    { name: '首页', url: './', order: 1 },
                    { name: '作品集', url: 'portfolio.html', order: 2 },
                    { name: '博客', url: 'blog.html', order: 3 },
                    { name: '联系我', url: 'contact.html', order: 4 }
                ]
            },
            footer: {
                description: '个人网站和作品展示平台',
                quickLinks: [
                    { name: '首页', url: './' },
                    { name: '作品集', url: 'portfolio.html' },
                    { name: '博客', url: 'blog.html' },
                    { name: '联系我', url: 'contact.html' }
                ],
                legalLinks: [
                    { name: '隐私政策', url: 'privacy.html' },
                    { name: '使用条款', url: 'terms.html' },
                    { name: '版权声明', url: 'copyright.html' }
                ],
                social: {
                    github: 'https://github.com',
                    weibo: 'https://weibo.com'
                },
                copyright: `© ${new Date().getFullYear()} zcfi.cn 版权所有`
            }
        };
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    normalizeUrl(url) {
        if (!url) return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
            return url;
        }
        return url;
    }

    // 渲染导航栏
    async renderNavbar(containerId = 'navbar-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('导航栏容器不存在:', containerId);
            return;
        }

        const config = await this.loadConfig();
        const site = config.site || {};
        const navigation = config.navigation || {};

        // 生成导航栏HTML
        const logoHtml = site.name ? 
            `${this.escapeHtml(site.name)}<span>.</span>cn` : 
            'zcfi<span>.</span>cn';

        // 获取当前页面路径
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';

        // 生成导航链接
        let navLinksHtml = '';
        if (navigation.items && Array.isArray(navigation.items)) {
            const sortedItems = [...navigation.items].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            navLinksHtml = sortedItems
                .filter(item => item && item.name && item.url)
                .map(item => {
                    // 判断是否是当前页面
                    let isActive = false;
                    const itemUrl = this.normalizeUrl(item.url);
                    
                    if (itemUrl === './' || itemUrl === 'index.html') {
                        isActive = currentPage === 'index.html' || currentPage === '';
                    } else {
                        const itemPage = itemUrl.split('/').pop();
                        isActive = currentPage === itemPage || currentPage.includes(itemPage?.replace('.html', '') || '');
                    }
                    
                    const activeClass = isActive ? 'active' : '';
                    return `
                        <li>
                            <a href="${itemUrl}" class="nav-link ${activeClass}">
                                ${this.escapeHtml(item.name)}
                            </a>
                        </li>
                    `;
                }).join('');
        }

        // 完整的导航栏HTML
        const navbarHtml = `
            <header>
                <div class="container">
                    <nav class="navbar">
                        <a href="./" class="logo">${logoHtml}</a>
                        <ul class="nav-links">
                            ${navLinksHtml}
                        </ul>
                        <div class="mobile-menu-btn">
                            <i class="fas fa-bars"></i>
                        </div>
                    </nav>
                </div>
            </header>
        `;

        container.innerHTML = navbarHtml;
        
        // 初始化移动端菜单
        this.initMobileMenu(container);
        
        console.log('导航栏渲染完成');
    }

    // 渲染页脚
    async renderFooter(containerId = 'footer-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('页脚容器不存在:', containerId);
            return;
        }

        const config = await this.loadConfig();
        const site = config.site || {};
        const footer = config.footer || {};

        // 生成页脚HTML
        const logoHtml = site.name ? 
            `${this.escapeHtml(site.name)}<span>.</span>cn` : 
            'zcfi<span>.</span>cn';

        // 快速链接
        let quickLinksHtml = '';
        if (footer.quickLinks && Array.isArray(footer.quickLinks)) {
            quickLinksHtml = footer.quickLinks
                .filter(link => link && link.name && link.url)
                .map(link => `
                    <li><a href="${this.normalizeUrl(link.url)}">${this.escapeHtml(link.name)}</a></li>
                `).join('');
        }

        // 法律声明链接
        let legalLinksHtml = '';
        if (footer.legalLinks && Array.isArray(footer.legalLinks)) {
            legalLinksHtml = footer.legalLinks
                .filter(link => link && link.name && link.url)
                .map(link => `
                    <li><a href="${this.normalizeUrl(link.url)}">${this.escapeHtml(link.name)}</a></li>
                `).join('');
        }

        // 合规声明链接
        let complianceLinksHtml = '';
        if (footer.legalLinks && Array.isArray(footer.legalLinks)) {
            complianceLinksHtml = footer.legalLinks
                .filter(link => link && link.name && link.url)
                .map(link => `
                    <a href="${this.normalizeUrl(link.url)}">${this.escapeHtml(link.name)}</a>
                `).join('');
        }

        // 社交媒体链接
        let socialLinksHtml = '';
        const social = footer.social || {};
        
        if (social.github && social.github.trim()) {
            socialLinksHtml += `<a href="${this.normalizeUrl(social.github)}" target="_blank" title="GitHub"><i class="fab fa-github"></i></a>`;
        }
        if (social.weibo && social.weibo.trim()) {
            socialLinksHtml += `<a href="${this.normalizeUrl(social.weibo)}" target="_blank" title="微博"><i class="fab fa-weibo"></i></a>`;
        }
        if (social.zhihu && social.zhihu.trim()) {
            socialLinksHtml += `<a href="${this.normalizeUrl(social.zhihu)}" target="_blank" title="知乎"><i class="fab fa-zhihu"></i></a>`;
        }
        if (social.linkedin && social.linkedin.trim()) {
            socialLinksHtml += `<a href="${this.normalizeUrl(social.linkedin)}" target="_blank" title="LinkedIn"><i class="fab fa-linkedin"></i></a>`;
        }

        // 完整的页脚HTML
        const footerHtml = `
            <footer>
                <div class="container">
                    <div class="footer-content">
                        <div class="footer-about">
                            <a href="./" class="footer-logo">${logoHtml}</a>
                            <p>${this.escapeHtml(footer.description || '个人网站和作品展示平台')}</p>
                            <div class="social-links">
                                ${socialLinksHtml}
                            </div>
                        </div>
                        <div class="footer-links">
                            <h3 class="footer-heading">快速链接</h3>
                            <ul>
                                ${quickLinksHtml}
                            </ul>
                        </div>
                        <div class="footer-links">
                            <h3 class="footer-heading">法律声明</h3>
                            <ul>
                                ${legalLinksHtml}
                            </ul>
                        </div>
                    </div>
                    <div class="compliance">
                        <p>${this.escapeHtml(footer.copyright || `© ${new Date().getFullYear()} zcfi.cn 版权所有`)}</p>
                        <div class="compliance-links">
                            ${complianceLinksHtml}
                        </div>
                    </div>
                </div>
            </footer>
        `;

        container.innerHTML = footerHtml;
        console.log('页脚渲染完成');
    }

    // 初始化移动端菜单
    initMobileMenu(container) {
        const mobileBtn = container.querySelector('.mobile-menu-btn');
        const navLinks = container.querySelector('.nav-links');
        
        if (!mobileBtn || !navLinks) return;
        
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });

        // 点击链接关闭菜单
        navLinks.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                navLinks.classList.remove('active');
                const icon = mobileBtn.querySelector('i');
                icon.className = 'fas fa-bars';
            }
        });
    }

    // 渲染所有
    async renderAll() {
        await Promise.all([
            this.renderNavbar(),
            this.renderFooter()
        ]);
        console.log('导航栏和页脚渲染完成');
    }
}

// 创建全局实例
window.gistRenderer = new GistRenderer();

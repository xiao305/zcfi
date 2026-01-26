// 网站配置加载器 - 完整版（包含所有更新函数）

class SiteConfigLoader {
    constructor() {
        this.CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
        this.CONFIG_RAW_URL = `https://gist.githubusercontent.com/xiao305/${this.CONFIG_GIST_ID}/raw/config.json`;
        this.configData = null;
        this.isLoaded = false;
    }

    async loadConfig() {
        try {
            if (this.isLoaded && this.configData) {
                return this.configData;
            }

            const timestamp = new Date().getTime();
            const response = await fetch(`${this.CONFIG_RAW_URL}?t=${timestamp}`);
            
            if (!response.ok) {
                console.warn('无法加载网站配置，使用默认配置');
                this.configData = this.getDefaultConfig();
            } else {
                this.configData = await response.json();
            }
            
            this.isLoaded = true;
            return this.configData;
            
        } catch (error) {
            console.error('加载网站配置失败:', error);
            this.configData = this.getDefaultConfig();
            this.isLoaded = true;
            return this.configData;
        }
    }

    getDefaultConfig() {
        return {
            site: {
                name: 'zcfi.cn',
                description: '个人网站和作品展示平台',
                keywords: '个人网站,技术博客,作品展示',
                adminEmail: 'admin@zcfi.cn',
                lastUpdated: new Date().toISOString()
            },
            privacy: {
                title: '隐私政策',
                content: `<h3>1. 信息收集</h3>
<p>本站为个人非商业网站，不主动收集用户任何个人信息。</p>
<h3>2. 数据安全</h3>
<p>所有通过表单提交的数据将通过 HTTPS 加密传输。</p>
<h3>3. 联系我们</h3>
<p>如有任何隐私相关疑问，请通过联系页面与我沟通。</p>`,
                enabled: true,
                lastUpdated: new Date().toISOString()
            },
            terms: {
                title: '使用条款',
                content: `<h3>1. 接受条款</h3>
<p>通过访问和使用本网站，您同意遵守以下使用条款。</p>
<h3>2. 网站内容</h3>
<p>本网站所有内容均为原创或已获得合法授权，受版权法保护。</p>
<h3>3. 免责声明</h3>
<p>本网站按"现状"提供，不提供任何形式的保证。</p>`,
                enabled: true,
                lastUpdated: new Date().toISOString()
            },
            copyright: {
                title: '版权声明',
                content: `<h3>1. 版权归属</h3>
<p>本网站的所有原创内容均归网站所有者所有。</p>
<h3>2. 使用许可</h3>
<p>允许个人用户出于学习、研究目的下载、保存和参考本网站内容。</p>
<h3>3. 禁止行为</h3>
<p>未经授权，严禁复制、转载或重新发布本网站内容。</p>`,
                enabled: true,
                lastUpdated: new Date().toISOString()
            },
            navigation: {
                items: [
                    { name: '首页', url: './', order: 1 },
                    { name: '作品集', url: 'portfolio.html', order: 2 },
                    { name: '博客', url: 'blog.html', order: 3 },
                    { name: '联系我', url: 'contact.html', order: 4 }
                ],
                lastUpdated: new Date().toISOString()
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
                    weibo: 'https://weibo.com',
                    zhihu: 'https://zhihu.com',
                    linkedin: 'https://linkedin.com'
                },
                copyright: '© 2026 zcfi.cn 版权所有',
                lastUpdated: new Date().toISOString()
            }
        };
    }

    // 更新页面元数据
    updatePageMetadata() {
        if (!this.configData || !this.configData.site) return;
        
        const site = this.configData.site;
        
        // 更新页面标题
        const currentTitle = document.title;
        if (currentTitle.includes('|')) {
            const pageName = currentTitle.split('|')[0].trim();
            document.title = `${pageName} | ${site.name}`;
        } else if (currentTitle.includes(' - ')) {
            const pageName = currentTitle.split(' - ')[0].trim();
            document.title = `${pageName} | ${site.name}`;
        } else {
            document.title = `${currentTitle} | ${site.name}`;
        }
        
        // 更新meta描述
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = site.description;
        
        // 更新meta关键词
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.name = 'keywords';
            document.head.appendChild(metaKeywords);
        }
        metaKeywords.content = site.keywords;
    }

    // 更新社交链接
    updateSocialLinks() {
        if (!this.configData || !this.configData.footer || !this.configData.footer.social) return;
        
        const socialLinks = this.configData.footer.social;
        const socialContainers = document.querySelectorAll('.social-links');
        
        if (!socialContainers.length) return;
        
        socialContainers.forEach(socialContainer => {
            socialContainer.innerHTML = '';
            
            const platforms = [
                { key: 'github', icon: 'fab fa-github', label: 'GitHub', color: '#333' },
                { key: 'weibo', icon: 'fab fa-weibo', label: '微博', color: '#e6162d' },
                { key: 'zhihu', icon: 'fab fa-zhihu', label: '知乎', color: '#0084ff' },
                { key: 'linkedin', icon: 'fab fa-linkedin', label: 'LinkedIn', color: '#0077b5' }
            ];
            
            platforms.forEach(platform => {
                if (socialLinks[platform.key] && socialLinks[platform.key] !== 'https://example.com') {
                    const link = document.createElement('a');
                    link.href = socialLinks[platform.key];
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = platform.label;
                    
                    const icon = document.createElement('i');
                    icon.className = platform.icon;
                    
                    link.appendChild(icon);
                    socialContainer.appendChild(link);
                }
            });
        });
    }

    // 更新网站名称（新添加）
    updateSiteName() {
        if (!this.configData || !this.configData.site || !this.configData.site.name) return;
        
        const siteName = this.configData.site.name;
        
        // 更新logo中的网站名称
        const logoElements = document.querySelectorAll('.logo, .footer-logo');
        logoElements.forEach(element => {
            const span = element.querySelector('span');
            if (span) {
                element.innerHTML = `${siteName}<span>.</span>cn`;
            }
        });
        
        // 更新版权信息
        const copyrightElements = document.querySelectorAll('#copyrightText');
        copyrightElements.forEach(element => {
            element.textContent = `© 2026 ${siteName} 版权所有`;
        });
    }

    // 更新网站描述（新添加）
    updateSiteDescription() {
        if (!this.configData || !this.configData.site || !this.configData.site.description) return;
        
        const siteDescription = this.configData.site.description;
        const descElements = document.querySelectorAll('#siteDescriptionFooter');
        
        descElements.forEach(element => {
            element.textContent = siteDescription;
        });
    }

    // 更新导航栏（新添加）
    updateNavigation() {
        if (!this.configData || !this.configData.navigation || !this.configData.navigation.items) return;
        
        const navigation = this.configData.navigation.items;
        
        // 更新主导航
        const mainNavLinks = document.getElementById('mainNavLinks');
        if (mainNavLinks) {
            const sortedNav = [...navigation].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            mainNavLinks.innerHTML = sortedNav.map(item => `
                <li><a href="${item.url}" class="nav-link">${item.name}</a></li>
            `).join('');
        }
        
        // 更新页脚快速链接
        const footerQuickLinks = document.getElementById('footerQuickLinks');
        if (footerQuickLinks) {
            const sortedFooterNav = [...navigation].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            footerQuickLinks.innerHTML = sortedFooterNav.map(item => `
                <li><a href="${item.url}">${item.name}</a></li>
            `).join('');
        }
    }

    // 更新页脚内容（新添加）
    updateFooterContent() {
        if (!this.configData || !this.configData.footer) return;
        
        const footer = this.configData.footer;
        
        // 更新页脚描述
        const footerDescElement = document.getElementById('siteDescriptionFooter');
        if (footerDescElement && footer.description) {
            footerDescElement.textContent = footer.description;
        }
        
        // 更新版权信息
        const copyrightElement = document.getElementById('copyrightText');
        if (copyrightElement && footer.copyright) {
            copyrightElement.textContent = footer.copyright;
        }
        
        // 更新快速链接
        const quickLinksElement = document.getElementById('footerQuickLinks');
        if (quickLinksElement && footer.quickLinks) {
            quickLinksElement.innerHTML = footer.quickLinks.map(link => 
                `<li><a href="${link.url}">${link.name}</a></li>`
            ).join('');
        }
        
        // 更新法律声明链接
        const legalLinksElement = document.getElementById('footerLegalLinks');
        if (legalLinksElement && footer.legalLinks) {
            legalLinksElement.innerHTML = footer.legalLinks.map(link => 
                `<li><a href="${link.url}">${link.name}</a></li>`
            ).join('');
        }
        
        // 更新合规声明链接
        const complianceLinksElement = document.getElementById('complianceLinks');
        if (complianceLinksElement && footer.legalLinks) {
            complianceLinksElement.innerHTML = footer.legalLinks.map(link => 
                `<a href="${link.url}">${link.name}</a>`
            ).join('');
        }
    }

    // 获取特定页面内容
    getPageContent(pageType) {
        if (!this.configData || !this.configData[pageType]) {
            return null;
        }
        return this.configData[pageType];
    }

    // 检查页面是否启用
    isPageEnabled(pageType) {
        if (!this.configData || !this.configData[pageType]) {
            return false;
        }
        return this.configData[pageType].enabled !== false;
    }

    // 获取管理员邮箱
    getAdminEmail() {
        return this.configData?.site?.adminEmail || 'admin@zcfi.cn';
    }
}

// 创建全局实例
window.siteConfig = new SiteConfigLoader();

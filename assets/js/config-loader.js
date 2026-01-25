// assets/js/config-loader.js
// 网站配置加载器 - 用于前端页面

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
            social: {
                github: 'https://github.com',
                weibo: 'https://weibo.com',
                zhihu: 'https://zhihu.com',
                linkedin: 'https://linkedin.com',
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
        if (!this.configData || !this.configData.social) return;
        
        const socialLinks = this.configData.social;
        const socialContainers = document.querySelectorAll('.social-links');
        
        if (!socialContainers.length) return;
        
        socialContainers.forEach(socialContainer => {
            // 清空现有内容
            socialContainer.innerHTML = '';
            
            // 社交平台配置
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
                    link.style.color = platform.color;
                    
                    const icon = document.createElement('i');
                    icon.className = platform.icon;
                    
                    link.appendChild(icon);
                    socialContainer.appendChild(link);
                }
            });
        });
    }

    // 更新网站名称
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

    // 更新网站描述
    updateSiteDescription() {
        if (!this.configData || !this.configData.site || !this.configData.site.description) return;
        
        const siteDescription = this.configData.site.description;
        const descElements = document.querySelectorAll('#siteDescriptionFooter');
        
        descElements.forEach(element => {
            element.textContent = siteDescription;
        });
    }

    // 获取管理员邮箱
    getAdminEmail() {
        return this.configData?.site?.adminEmail || 'admin@zcfi.cn';
    }
}

// 创建全局实例
window.siteConfig = new SiteConfigLoader();

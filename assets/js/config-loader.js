// assets/js/config-loader.js
// 网站配置加载器 - 精简版

class SiteConfigLoader {
    constructor() {
        this.CONFIG_GIST_ID = '983bb7371ddb439a2fcbfb4885e34d14';
        this.configData = null;
        this.isLoaded = false;
    }

    async loadConfig() {
        if (this.isLoaded && this.configData) {
            return this.configData;
        }

        try {
            const timestamp = Date.now();
            const response = await fetch(
                `https://gist.githubusercontent.com/xiao305/${this.CONFIG_GIST_ID}/raw/config.json?t=${timestamp}`
            );
            
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
                adminEmail: 'admin@zcfi.cn'
            },
            footer: {
                description: '个人网站和作品展示平台',
                copyright: `© ${new Date().getFullYear()} zcfi.cn 版权所有`
            }
        };
    }
}

// 创建全局实例
window.siteConfig = new SiteConfigLoader();

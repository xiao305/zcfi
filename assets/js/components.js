// 前端公共组件加载器 - 已修复路径问题

class SiteComponents {
    constructor() {
        this.components = {};
        this.basePath = this.detectBasePath();
    }

    // 检测基础路径（处理前台/后台路径差异）
    detectBasePath() {
        const path = window.location.pathname;
        // 如果是在 admin 目录下
        if (path.includes('/admin/')) {
            return '../';
        }
        // 前台页面
        return './';
    }

    // 加载组件
    async loadComponent(componentName) {
        try {
            const response = await fetch(`${this.basePath}assets/components/${componentName}.html`);
            if (!response.ok) {
                throw new Error(`组件 ${componentName} 加载失败`);
            }
            return await response.text();
        } catch (error) {
            console.error('加载组件失败:', error);
            return `<div class="component-error">${componentName} 组件加载失败: ${error.message}</div>`;
        }
    }

    // 渲染组件到指定容器
    async renderComponent(componentName, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`容器 ${containerId} 不存在`);
            return;
        }

        // 显示加载状态
        container.innerHTML = '<div class="component-loading">加载中...</div>';
        
        // 加载组件
        const html = await this.loadComponent(componentName);
        container.innerHTML = html;
        
        // 标记组件已加载
        container.classList.add('component-loaded');
    }

    // 加载所有公共组件
    async loadAllComponents() {
        const components = ['navbar', 'footer'];
        
        // 并行加载所有组件
        const loadPromises = components.map(component => {
            const containerId = `${component}-container`;
            if (document.getElementById(containerId)) {
                return this.renderComponent(component, containerId);
            }
            return Promise.resolve();
        });
        
        await Promise.all(loadPromises);
        
        // 确保配置加载器可用
        await this.ensureConfigLoader();
    }

    // 确保配置加载器可用
    async ensureConfigLoader() {
        if (typeof window.siteConfig === 'undefined') {
            const script = document.createElement('script');
            script.src = `${this.basePath}assets/js/config-loader.js`;
            script.async = true;
            
            return new Promise((resolve) => {
                script.onload = resolve;
                script.onerror = () => {
                    console.warn('配置加载器加载失败，将继续使用默认配置');
                    resolve();
                };
                document.head.appendChild(script);
            });
        }
        return Promise.resolve();
    }
}

// 创建全局实例
window.siteComponents = new SiteComponents();

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 加载所有组件
        await window.siteComponents.loadAllComponents();
        
        // 如果配置加载器可用，加载并应用配置
        if (window.siteConfig && typeof window.siteConfig.loadConfig === 'function') {
            try {
                const config = await window.siteConfig.loadConfig();
                
                // 更新页面元数据
                if (window.siteConfig.updatePageMetadata) {
                    window.siteConfig.updatePageMetadata();
                }
                
                // 更新网站信息（这些函数将在config-loader.js中添加）
                if (window.siteConfig.updateSiteName) {
                    window.siteConfig.updateSiteName();
                }
                if (window.siteConfig.updateSiteDescription) {
                    window.siteConfig.updateSiteDescription();
                }
                if (window.siteConfig.updateSocialLinks) {
                    window.siteConfig.updateSocialLinks();
                }
                if (window.siteConfig.updateNavigation) {
                    window.siteConfig.updateNavigation();
                }
                if (window.siteConfig.updateFooterContent) {
                    window.siteConfig.updateFooterContent();
                }
            } catch (configError) {
                console.error('配置应用失败:', configError);
            }
        }
    } catch (error) {
        console.error('组件加载失败:', error);
    }
});

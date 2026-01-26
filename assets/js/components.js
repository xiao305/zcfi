// assets/js/components.js
// 前端公共组件加载器

class SiteComponents {
    constructor() {
        this.components = {};
    }

    // 加载组件
    async loadComponent(componentName) {
        try {
            const response = await fetch(`assets/components/${componentName}.html`);
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
        
        // 确保配置已加载
        if (typeof window.siteConfig === 'undefined') {
            const script = document.createElement('script');
            script.src = '../assets/js/config-loader.js';
            script.onload = function() {
                // 组件内部的脚本会在DOM加载完成后执行
            };
            document.head.appendChild(script);
        }
    }

    // 加载所有公共组件
    async loadAllComponents() {
        const components = ['navbar', 'footer'];
        
        for (const component of components) {
            const containerId = `${component}-container`;
            if (document.getElementById(containerId)) {
                await this.renderComponent(component, containerId);
            }
        }
    }
}

// 创建全局实例
window.siteComponents = new SiteComponents();

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 确保配置加载器可用
    if (typeof window.siteConfig === 'undefined') {
        await loadConfigLoader();
    }
    
    // 加载所有组件
    await window.siteComponents.loadAllComponents();
    
    // 加载并应用网站配置
    if (window.siteConfig) {
        const config = await window.siteConfig.loadConfig();
        
        // 更新页面元数据
        window.siteConfig.updatePageMetadata();
        
        // 更新网站信息
        window.siteConfig.updateSiteName();
        window.siteConfig.updateSiteDescription();
        window.siteConfig.updateSocialLinks();
    }
});

// 加载配置加载器
async function loadConfigLoader() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '../assets/js/config-loader.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

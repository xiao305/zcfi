// 前端公共组件加载器 - 支持组件自治

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
                throw new Error(`组件 ${componentName} 加载失败: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error('加载组件失败:', error);
            // 返回包含错误信息的HTML
            return `
                <div class="component-error" style="color: #dc3545; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; margin: 10px;">
                    <strong>${componentName} 组件加载失败</strong>: ${error.message}
                </div>
            `;
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
        container.innerHTML = '<div class="component-loading" style="text-align: center; padding: 30px; color: #666;">加载中...</div>';
        
        try {
            // 加载组件HTML
            const html = await this.loadComponent(componentName);
            container.innerHTML = html;
            
            // 标记组件已加载
            container.classList.add('component-loaded');
            
            console.log(`组件 ${componentName} 加载完成`);
            
        } catch (error) {
            console.error(`渲染组件 ${componentName} 失败:`, error);
            container.innerHTML = `
                <div class="component-error" style="color: #dc3545; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; margin: 10px;">
                    <strong>${componentName} 组件渲染失败</strong>: ${error.message}
                </div>
            `;
        }
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
        console.log('所有公共组件加载完成');
    }
}

// 创建全局实例
window.siteComponents = new SiteComponents();

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('页面开始初始化...');
        
        // 加载所有公共组件（导航栏和页脚）
        await window.siteComponents.loadAllComponents();
        
        console.log('页面初始化完成');
    } catch (error) {
        console.error('页面初始化失败:', error);
    }
});

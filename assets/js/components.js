// assets/js/components.js
// 前端公共组件加载器 - 完全无硬代码

class SiteComponents {
    constructor() {
        this.basePath = this.detectBasePath();
    }

    // 检测基础路径
    detectBasePath() {
        const path = window.location.pathname;
        return path.includes('/admin/') ? '../' : './';
    }

    // 加载组件HTML
    async loadComponent(componentName) {
        try {
            const response = await fetch(
                `${this.basePath}assets/components/${componentName}.html?t=${Date.now()}`
            );
            
            if (!response.ok) {
                throw new Error(`组件 ${componentName} 加载失败: ${response.status}`);
            }
            
            return await response.text();
        } catch (error) {
            console.error('加载组件失败:', error);
            return `
                <div class="component-error">
                    <strong>${componentName} 组件加载失败</strong>: ${error.message}
                </div>
            `;
        }
    }

    // 执行脚本的辅助函数
    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(script => {
            if (script.src) {
                // 外部脚本
                const newScript = document.createElement('script');
                newScript.src = script.src;
                document.head.appendChild(newScript);
                script.remove();
            } else {
                // 内联脚本
                try {
                    // 创建新的script元素并执行
                    const newScript = document.createElement('script');
                    newScript.textContent = script.textContent;
                    document.body.appendChild(newScript);
                    newScript.remove();
                } catch (e) {
                    console.error('执行脚本错误:', e);
                }
            }
        });
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
        
        try {
            // 加载组件HTML
            const html = await this.loadComponent(componentName);
            container.innerHTML = html;
            container.classList.add('component-loaded');
            
            console.log(`组件 ${componentName} 加载完成`);
            
            // 🚀 关键：执行组件内的脚本
            this.executeScripts(container);
            
        } catch (error) {
            console.error(`渲染组件 ${componentName} 失败:`, error);
            container.innerHTML = `
                <div class="component-error">
                    <strong>${componentName} 组件渲染失败</strong><br>
                    错误: ${error.message}
                </div>
            `;
        }
    }

    // 加载所有公共组件
    async loadAllComponents() {
        const components = [
            { name: 'navbar', container: 'navbar-container' },
            { name: 'footer', container: 'footer-container' }
        ];
        
        // 并行加载所有组件
        const loadPromises = components.map(({ name, container }) => {
            if (document.getElementById(container)) {
                return this.renderComponent(name, container);
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

// assets/js/components.js
// 前端公共组件加载器

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

    // 使用iframe加载组件的辅助函数
    async loadComponentWithIframe(componentName) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.border = 'none';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.position = 'absolute';
            iframe.style.visibility = 'hidden';
            
            iframe.src = `${this.basePath}assets/components/${componentName}.html?t=${Date.now()}`;
            
            iframe.onload = () => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const componentHTML = iframeDoc.body.innerHTML;
                    resolve(componentHTML);
                } catch (error) {
                    reject(error);
                } finally {
                    // 清理iframe
                    setTimeout(() => {
                        if (iframe.parentNode) {
                            iframe.parentNode.removeChild(iframe);
                        }
                    }, 100);
                }
            };
            
            iframe.onerror = (error) => {
                reject(new Error(`加载组件 ${componentName} 失败: ${error}`));
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            };
            
            document.body.appendChild(iframe);
            
            // 设置超时
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                    reject(new Error(`加载组件 ${componentName} 超时`));
                }
            }, 5000);
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
            console.log(`开始加载组件: ${componentName}`);
            
            // 尝试多种加载方式
            let html = '';
            let success = false;
            
            // 方式1: 尝试使用iframe加载
            try {
                html = await this.loadComponentWithIframe(componentName);
                success = true;
                console.log(`组件 ${componentName} iframe加载成功`);
            } catch (iframeError) {
                console.warn(`iframe方式加载 ${componentName} 失败:`, iframeError);
                
                // 方式2: 回退到普通fetch
                try {
                    html = await this.loadComponent(componentName);
                    success = true;
                    console.log(`组件 ${componentName} fetch加载成功`);
                } catch (fetchError) {
                    console.error(`fetch方式加载 ${componentName} 失败:`, fetchError);
                    throw fetchError;
                }
            }
            
            if (success && html) {
                // 插入HTML到容器
                container.innerHTML = html;
                container.classList.add('component-loaded');
                
                console.log(`组件 ${componentName} 渲染完成`);
                
                // 尝试执行组件中的脚本
                this.tryExecuteComponentScripts(componentName, container);
            }
            
        } catch (error) {
            console.error(`渲染组件 ${componentName} 失败:`, error);
            container.innerHTML = `
                <div class="component-error">
                    <strong>${componentName} 组件加载失败</strong><br>
                    错误: ${error.message}
                </div>
            `;
        }
    }

    // 尝试执行组件脚本
    tryExecuteComponentScripts(componentName, container) {
        const scripts = container.querySelectorAll('script');
        
        if (scripts.length > 0) {
            console.log(`找到 ${scripts.length} 个脚本标签在 ${componentName} 中`);
            
            scripts.forEach((script, index) => {
                try {
                    if (script.src) {
                        // 外部脚本
                        const newScript = document.createElement('script');
                        newScript.src = script.src;
                        newScript.async = false;
                        document.head.appendChild(newScript);
                        console.log(`加载外部脚本: ${script.src}`);
                    } else if (script.textContent.trim()) {
                        // 内联脚本 - 使用eval但包裹在try-catch中
                        try {
                            // 使用Function构造函数创建新的作用域
                            const executeScript = new Function(script.textContent);
                            executeScript();
                            console.log(`执行内联脚本 ${index + 1} 成功`);
                        } catch (evalError) {
                            console.error(`执行内联脚本 ${index + 1} 失败:`, evalError);
                        }
                    }
                } catch (error) {
                    console.error(`处理脚本 ${index + 1} 失败:`, error);
                }
            });
        } else {
            console.log(`组件 ${componentName} 中没有脚本标签`);
        }
        
        // 延迟检查组件是否初始化
        setTimeout(() => {
            this.checkComponentInitialization(componentName, container);
        }, 300);
    }

    // 检查组件是否成功初始化
    checkComponentInitialization(componentName, container) {
        // 检查导航栏
        if (componentName === 'navbar') {
            const logo = container.querySelector('.logo');
            const navLinks = container.querySelector('.nav-links');
            
            if (!logo || logo.innerHTML.trim() === '') {
                console.warn('导航栏Logo未初始化，尝试手动初始化');
                this.manualInitNavbar(container);
            }
            
            if (!navLinks || navLinks.innerHTML.trim() === '') {
                console.warn('导航栏链接未初始化');
            }
        }
        
        // 检查页脚
        if (componentName === 'footer') {
            const footerLogo = container.querySelector('.footer-logo');
            const quickLinks = container.querySelector('#footerQuickLinks');
            
            if (!footerLogo || footerLogo.innerHTML.trim() === '') {
                console.warn('页脚Logo未初始化');
            }
            
            if (!quickLinks || quickLinks.innerHTML.trim() === '') {
                console.warn('页脚链接未初始化，尝试手动初始化');
                this.manualInitFooter(container);
            }
        }
    }

    // 手动初始化导航栏（后备方案）
    manualInitNavbar(container) {
        console.log('尝试手动初始化导航栏...');
        
        // 简单设置默认内容
        const logo = container.querySelector('.logo');
        if (logo) {
            logo.innerHTML = 'zcfi<span>.</span>cn';
            logo.href = './';
        }
        
        const navLinks = container.querySelector('.nav-links');
        if (navLinks) {
            navLinks.innerHTML = `
                <li><a href="./" class="nav-link">首页</a></li>
                <li><a href="portfolio.html" class="nav-link">作品集</a></li>
                <li><a href="blog.html" class="nav-link">博客</a></li>
                <li><a href="contact.html" class="nav-link">联系我</a></li>
            `;
        }
        
        // 初始化移动端菜单
        this.initMobileMenu(container);
    }

    // 手动初始化页脚（后备方案）
    manualInitFooter(container) {
        console.log('尝试手动初始化页脚...');
        
        const footerLogo = container.querySelector('.footer-logo');
        if (footerLogo) {
            footerLogo.innerHTML = 'zcfi<span>.</span>cn';
            footerLogo.href = './';
        }
        
        const quickLinks = container.querySelector('#footerQuickLinks');
        if (quickLinks) {
            quickLinks.innerHTML = `
                <li><a href="./">首页</a></li>
                <li><a href="portfolio.html">作品集</a></li>
                <li><a href="blog.html">博客</a></li>
                <li><a href="contact.html">联系我</a></li>
            `;
        }
        
        const legalLinks = container.querySelector('#footerLegalLinks');
        if (legalLinks) {
            legalLinks.innerHTML = `
                <li><a href="privacy.html">隐私政策</a></li>
                <li><a href="terms.html">使用条款</a></li>
                <li><a href="copyright.html">版权声明</a></li>
            `;
        }
    }

    // 初始化移动端菜单
    initMobileMenu(container) {
        const mobileBtn = container.querySelector('.mobile-menu-btn');
        const navLinks = container.querySelector('.nav-links');
        
        if (mobileBtn && navLinks) {
            mobileBtn.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                const icon = mobileBtn.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars');
                    icon.classList.toggle('fa-times');
                }
            });
        }
    }

    // 加载所有公共组件
    async loadAllComponents() {
        const components = [
            { name: 'navbar', container: 'navbar-container' },
            { name: 'footer', container: 'footer-container' }
        ];
        
        // 串行加载，避免冲突
        for (const { name, container } of components) {
            if (document.getElementById(container)) {
                await this.renderComponent(name, container);
                // 添加延迟，确保组件完全加载
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
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

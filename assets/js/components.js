// 修改 renderComponent 方法
async renderComponent(componentName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // 加载组件HTML
        const html = await this.loadComponent(componentName);
        container.innerHTML = html;
        container.classList.add('component-loaded');
        
        console.log(`组件 ${componentName} 加载完成`);
        
        // ✅ 关键修复：执行组件内的脚本
        this.executeScripts(container);
        
    } catch (error) {
        console.error(`渲染组件 ${componentName} 失败:`, error);
        container.innerHTML = `
            <div class="component-error">
                <strong>${componentName} 组件渲染失败</strong>: ${error.message}
            </div>
        `;
    }
}

// ✅ 新增方法：执行容器内的所有脚本
executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        
        // 复制script属性
        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        }
        
        // 复制其他属性
        Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        
        // 替换旧的script
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

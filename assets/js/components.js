// 在 renderComponent 方法中
async renderComponent(componentName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // 直接使用 iframe 加载组件
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${this.basePath}assets/components/${componentName}.html`;
        
        iframe.onload = () => {
            // 获取 iframe 中的内容
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const componentHTML = iframeDoc.body.innerHTML;
            
            // 插入到容器
            container.innerHTML = componentHTML;
            container.classList.add('component-loaded');
            
            console.log(`组件 ${componentName} 加载完成`);
            
            // 移除 iframe
            document.body.removeChild(iframe);
        };
        
        document.body.appendChild(iframe);
        
    } catch (error) {
        console.error(`渲染组件 ${componentName} 失败:`, error);
    }
}

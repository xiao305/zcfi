// assets/js/components.js
// 简化版本，只加载gist-renderer.js并调用
document.addEventListener('DOMContentLoaded', async function() {
    console.log('开始渲染导航栏和页脚...');
    
    // 确保gist-renderer.js已加载
    if (!window.gistRenderer) {
        console.error('gist-renderer.js未加载');
        return;
    }
    
    try {
        await window.gistRenderer.renderAll();
    } catch (error) {
        console.error('渲染失败:', error);
    }
});

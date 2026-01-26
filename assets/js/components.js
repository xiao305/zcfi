// assets/js/components.js
// 只负责加载组件，不执行任何逻辑

document.addEventListener('DOMContentLoaded', async function() {
    console.log('开始加载公共组件...');
    
    // 加载导航栏
    try {
        const navbarResponse = await fetch('./assets/components/navbar.html?t=' + Date.now());
        const navbarHTML = await navbarResponse.text();
        const navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
            navbarContainer.innerHTML = navbarHTML;
            console.log('导航栏加载完成');
        }
    } catch (error) {
        console.error('加载导航栏失败:', error);
    }
    
    // 加载页脚
    try {
        const footerResponse = await fetch('./assets/components/footer.html?t=' + Date.now());
        const footerHTML = await footerResponse.text();
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = footerHTML;
            console.log('页脚加载完成');
        }
    } catch (error) {
        console.error('加载页脚失败:', error);
    }
    
    console.log('所有公共组件加载完成');
});

// js/main.js

// 导航高亮 & 滚动效果
document.addEventListener('DOMContentLoaded', function() {
  // 导航高亮
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

  // 滚动时导航栏变小
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 表单提交（预留后台接口）
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = {
        name: form.name.value,
        email: form.email.value,
        message: form.message.value
      };

      // TODO: 替换为你的阿里云 FC API
      try {
        const response = await fetch('https://your-api.cn-hangzhou.fc.aliyuncs.com/...', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          alert('✅ 消息发送成功！我会尽快回复你。');
          form.reset();
        } else {
          throw new Error('发送失败');
        }
      } catch (error) {
        alert('❌ 网络错误，请稍后再试。');
        console.error(error);
      }
    });
  }
});
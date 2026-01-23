// js/main.js

// 示例：调用阿里云 FC 后台（未来替换为你的实际 API）
async function submitContactForm(data) {
  try {
    // TODO: 替换为你的阿里云 FC API 地址
    const response = await fetch('https://your-api-id.cn-hangzhou.fc.aliyuncs.com/2023-03-30/proxy/YOUR_SERVICE/YOUR_FUNCTION/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如果需要认证，可加 Authorization
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      alert('消息发送成功！我会尽快回复你。');
      document.getElementById('contactForm').reset();
    } else {
      alert('发送失败，请稍后再试。');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('网络错误，请检查连接。');
  }
}

// 表单提交处理
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = {
        name: form.name.value,
        email: form.email.value,
        message: form.message.value
      };
      submitContactForm(formData);
    });
  }

  // 高亮当前页面导航
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav a');
  nav Yorkers.forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });
});

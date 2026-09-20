document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('.btn-container');
  
  if (button) {
    button.addEventListener('click', () => {
      // ✅ Opens your backend OAuth route safely in a new browser tab
      chrome.tabs.create({ url: "http://127.0.0.1:8000/api/auth/google/login" });
    });
  }
});
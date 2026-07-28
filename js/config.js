// config.js
// 共用常數、DOM 元素參照、工具函式。
// ⚠️ 這支必須最先載入（在其他 js 檔案之前），其他檔案都依賴這裡宣告的變數。

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyKk3pHaXniCbPuKcQNJBSlKQO16lcva3MGmY8C9JoTbcf9zZ0ULRl2o-s1tsW3kVtO/exec';

const clinicalInput = document.getElementById('clinicalInput');
const problemOutput = document.getElementById('problemOutput');
const replyOutput = document.getElementById('replyOutput');
const categoryTabs = document.getElementById('categoryTabs');
const micBtn = document.getElementById('micBtn');
const longAudioBtn = document.getElementById('longAudioBtn');
const pcCameraBtn = document.getElementById('pcCameraBtn');
const pcGalleryBtn = document.getElementById('pcGalleryBtn');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingMask = document.getElementById('loadingMask');
const categoryBadge = document.getElementById('categoryBadge');
const toast = document.getElementById('toast');

// 🎯 從 localStorage 讀取通行憑證
const getUserToken = () => localStorage.getItem('yuan_auth_token') || '';

window.autoResize = function(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

function showToast(msg) {
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', 3000);
}

window.copyContent = function(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el.value) return showToast('⚠️ 內容為空');
    el.select();
    document.execCommand('copy');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ 已複製';
    showToast('✅ 成功複製到剪貼簿');
    window.getSelection().removeAllRanges();
    setTimeout(() => btn.innerHTML = originalText, 2000);
};

// auth-guard.js
// ⚠️ 這支必須用「一般 <script src="...">」引入，不可加 defer/async，
// 且要放在 <head> 最前面，確保在畫面渲染前就完成登入檢查與跳轉。

const GAS_LOGIN_URL = 'https://script.google.com/macros/s/AKfycbyKk3pHaXniCbPuKcQNJBSlKQO16lcva3MGmY8C9JoTbcf9zZ0ULRl2o-s1tsW3kVtO/exec';
const EXPIRY_MS = 6 * 60 * 60 * 1000; // ⏳ 6 小時倒數計時

const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
const urlName = urlParams.get('name');

if (urlToken) {
    // 1. 從登入頁跳轉過來時：寫入 localStorage (所有分頁共享)，並記錄當下時間戳
    localStorage.setItem('yuan_auth_token', urlToken);
    localStorage.setItem('yuan_auth_time', Date.now().toString());
    if (urlName) localStorage.setItem('yuan_auth_name', decodeURIComponent(urlName));

    // 2. 精準刪除敏感認證參數，保留 roomId 供手機連線
    urlParams.delete('token');
    urlParams.delete('name');

    let newUrl = window.location.pathname;
    let queryString = urlParams.toString();
    if (queryString) {
        newUrl += '?' + queryString;
    }
    window.history.replaceState({}, document.title, newUrl);

} else {
    // 3. 一般載入網頁時：檢查是否已登入，以及是否超過 6 小時
    const savedToken = localStorage.getItem('yuan_auth_token');
    const savedTime = localStorage.getItem('yuan_auth_time');
    const now = Date.now();

    if (!savedToken || !savedTime || (now - parseInt(savedTime) > EXPIRY_MS)) {
        localStorage.removeItem('yuan_auth_token');
        localStorage.removeItem('yuan_auth_time');
        localStorage.removeItem('yuan_auth_name');
        window.location.replace(GAS_LOGIN_URL);
    }
}

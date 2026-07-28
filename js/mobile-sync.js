// mobile-sync.js
// 📱 手機語音遙控器配對邏輯（呼叫共用工具版）

const DISCONNECT_TIMEOUT_MS = 60000; 

let syncInterval = null;
let lastActiveTime = Date.now();
let isPhoneConnected = false;
let currentRoomId = null;

const mobileUrlParams = new URLSearchParams(window.location.search);
const urlRoomId = mobileUrlParams.get('roomId');

// 🟢 情境一：如果是手機掃 QR Code 進來的畫面
if (urlRoomId) {
    document.body.innerHTML = `
        <div class="mobile-remote">
            <h1 style="font-size: 1.5rem; margin-bottom: 5px;">📱 萬能遙控器</h1>
            <div style="background: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 0.95rem; margin-bottom: 15px; border: 1px solid #bbf7d0;">
                🟢 成功與電腦端配對中
            </div>

            <!-- 美觀的四按鈕方陣 -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; width: 100%; margin-bottom: 15px;">
                <button id="remoteLongAudioBtn" style="padding: 12px 4px; background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">⏺️ 長錄音</button>
                <button id="remoteMicBtn" style="padding: 12px 4px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">🎙️ 短錄音</button>
                <button id="remoteCameraBtn" style="padding: 12px 4px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">📷 拍照</button>
                <button id="remoteGalleryBtn" style="padding: 12px 4px; background: #6366f1; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">🖼️ 相簿</button>

                <input type="file" id="remoteCameraInput" accept="image/*" capture="environment" style="display: none;">
                <input type="file" id="remoteGalleryInput" accept="image/*" style="display: none;">
            </div>

            <!-- 還原美觀的文字框比例 (height: 200px) -->
            <textarea id="remoteInput" style="width: 100%; height: 200px; font-size: 1.2rem; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; resize: none;" placeholder="點擊上方按鈕開始錄音或拍照..." autocomplete="off"></textarea>

            <button onclick="sendToPc()" id="remoteSendBtn" style="width: 100%; padding: 15px; margin-top: 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 1.2rem; font-weight: bold;">🚀 將文字傳送到電腦</button>
            <button onclick="disconnectFromPhone()" style="width: 100%; padding: 12px; margin-top: 15px; background: #fee2e2; color: #b91c1c; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold;">❌ 結束配對</button>
            <p id="remoteStatus" style="margin-top: 15px; color: #059669; font-weight: bold; display: none;">✅ 已傳送到電腦！</p>
        </div>
    `;

    fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: '__CONNECTED__' }) });

    let pcLastActiveTime = Date.now();
    let isPageHidden = false;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') isPageHidden = true;
        else {
            isPageHidden = false;
            pcLastActiveTime = Date.now();
            fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId + '_ALIVE', payload: 'HEARTBEAT' }) }).catch(e => {});
        }
    });

    let phoneHeartbeat = setInterval(() => {
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId + '_ALIVE', payload: 'HEARTBEAT' }) }).catch(e => {});
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: urlRoomId + '_CMD' }) })
            .then(res => res.json())
            .then(data => { if (data.text === '__DISCONNECT__') triggerPhoneDisconnectUI(); }).catch(e => {});
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: urlRoomId + '_PC_ALIVE' }) })
            .then(res => res.json())
            .then(data => { if (data.text === 'PC_HEARTBEAT') pcLastActiveTime = Date.now(); }).catch(e => {});

        if (!isPageHidden && Date.now() - pcLastActiveTime > DISCONNECT_TIMEOUT_MS) triggerPhoneDisconnectUI();
    }, 3000);

    function triggerPhoneDisconnectUI() {
        clearInterval(phoneHeartbeat);
        document.body.innerHTML = `
            <div class="mobile-remote" style="justify-content: center;">
                <h1 style="font-size: 2rem; margin-bottom: 10px;">🔌 已斷線</h1>
                <p style="color: #64748b; font-size: 1.2rem;">配對已中斷，您可以關閉此視窗。</p>
            </div>
        `;
    }

    // 🎯 直接綁定 DOM 與共用小工具 (極度清爽)
    const remoteInput = document.getElementById('remoteInput');
    const remoteCameraBtn = document.getElementById('remoteCameraBtn');
    const remoteGalleryBtn = document.getElementById('remoteGalleryBtn');
    const remoteCameraInput = document.getElementById('remoteCameraInput');
    const remoteGalleryInput = document.getElementById('remoteGalleryInput');
    const remoteMicBtn = document.getElementById('remoteMicBtn');
    const remoteLongAudioBtn = document.getElementById('remoteLongAudioBtn');

    remoteCameraBtn.addEventListener('click', () => remoteCameraInput.click());
    remoteGalleryBtn.addEventListener('click', () => remoteGalleryInput.click());

    // 呼叫影像小工具 (傳入 true 代表是手機端遙控，會自動切換 UI 表現方式)
    remoteCameraInput.addEventListener('change', e => { SharedImageUtil.process(e.target.files[0], remoteInput, remoteCameraBtn, true); remoteCameraInput.value = ''; });
    remoteGalleryInput.addEventListener('change', e => { SharedImageUtil.process(e.target.files[0], remoteInput, remoteGalleryBtn, true); remoteGalleryInput.value = ''; });

    // 呼叫語音小工具
    remoteMicBtn.addEventListener('click', () => SharedShortAudio.toggle(remoteMicBtn, remoteInput));
    remoteLongAudioBtn.addEventListener('click', () => SharedLongAudio.toggle(remoteLongAudioBtn, remoteInput, true));

    window.sendToPc = function() {
        const text = remoteInput.value.trim();
        if (!text) return alert('⚠️ 內容為空');
        const btn = document.getElementById('remoteSendBtn');
        btn.innerText = '傳送中...';
        
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: text }) })
        .then(() => {
            remoteInput.value = ''; 
            btn.innerText = '🚀 將文字傳送到電腦';
            const status = document.getElementById('remoteStatus');
            status.style.display = 'block';
            setTimeout(() => status.style.display = 'none', 3000);
        });
    };

    window.disconnectFromPhone = function() {
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: '__DISCONNECT__' }) })
        .then(() => triggerPhoneDisconnectUI());
    };
} 
// 💻 情境二：如果是電腦端，負責產生 QR Code 配對
else {
    document.getElementById('mobileSyncBtn').addEventListener('click', () => {
        if (isPhoneConnected) {
            stopSync();
            return;
        }

        currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        lastActiveTime = Date.now();
        
        // ⚠️ 記得把這裡的網址改成您最新的 GitHub 網址
        const githubPageBaseUrl = 'https://yphai.github.io/YPhAI/';
        const syncUrl = `${githubPageBaseUrl}?roomId=${currentRoomId}&token=${getUserToken()}`;
        
        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(syncUrl)}`;
        document.getElementById('qrModal').style.display = 'flex';
        
        syncInterval = setInterval(() => {
            fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: currentRoomId }) })
            .then(res => res.json())
            .then(data => {
                if (data.text) {
                    if (data.text === '__CONNECTED__') {
                        document.getElementById('qrModal').style.display = 'none'; 
                        isPhoneConnected = true;
                        lastActiveTime = Date.now();
                        
                        const syncBtn = document.getElementById('mobileSyncBtn');
                        syncBtn.innerHTML = '🟢 手機已配對(按此斷開)';
                        syncBtn.style.background = '#dcfce7';
                        syncBtn.style.color = '#15803d';
                        syncBtn.style.borderColor = '#bbf7d0';
                        
                        showToast('📱 手機配對成功！');
                    } 
                    else if (data.text === '__DISCONNECT__') {
                        showToast('📱 手機已主動斷開');
                        stopSync(true); 
                    }
                    else {
                        lastActiveTime = Date.now(); 
                        const inputEl = document.getElementById('clinicalInput');
                        inputEl.value = (inputEl.value ? inputEl.value + '\n' : '') + data.text;
                        autoResize(inputEl);
                        showToast('📥 已接收手機傳送的內容');
                    }
                }
            }).catch(e => {});

            if (isPhoneConnected) {
                fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: currentRoomId + '_PC_ALIVE', payload: 'PC_HEARTBEAT' }) }).catch(e => {});
                fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: currentRoomId + '_ALIVE' }) })
                .then(res => res.json())
                .then(data => { if (data.text === 'HEARTBEAT') lastActiveTime = Date.now(); }).catch(e => {});

                if (Date.now() - lastActiveTime > DISCONNECT_TIMEOUT_MS) {
                    showToast('⚠️ 偵測到手機離線');
                    stopSync(true); 
                }
            }
        }, 2000);
    });

    window.stopSync = function(isRemote = false) {
        document.getElementById('qrModal').style.display = 'none';
        if (syncInterval) clearInterval(syncInterval); 
        isPhoneConnected = false;
        
        if (!isRemote && currentRoomId) {
            fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: currentRoomId + '_CMD', payload: '__DISCONNECT__' }) });
        }
        
        const syncBtn = document.getElementById('mobileSyncBtn');
        syncBtn.innerHTML = '📱 手機配對';
        syncBtn.style.background = '#fef3c7';
        syncBtn.style.color = '#b45309';
        syncBtn.style.borderColor = '#fde68a';
        
        if (!isRemote) showToast('🔌 已結束手機配對');
    };
}

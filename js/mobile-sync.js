// mobile-sync.js
// 📱 手機語音遙控器配對邏輯（PC 端產生 QR code / 手機端掃碼進入遙控頁面）
//
// ✅ 本次修正重點：
// 1. 斷線逾時從 7000ms 延長為 25000ms，避免手機切去拍照時被誤判離線
// 2. 新增 Page Visibility API：分頁被切到背景時暫停斷線判斷，回到前景立刻補心跳
// 3. 補上手機遙控頁「拍照 / 相簿」選完照片後的實際辨識邏輯（原本漏掉 change 監聽）

const DISCONNECT_TIMEOUT_MS = 25000; // ⏳ 斷線容忍時間（原本 7000，已延長）

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

            <div style="display: flex; gap: 6px; width: 100%; margin-bottom: 15px;">
                <button id="remoteCameraBtn" style="flex: 1; padding: 12px 4px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.85rem;">📷 拍照</button>
                <button id="remoteGalleryBtn" style="flex: 1; padding: 12px 4px; background: #6366f1; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.85rem;">🖼️ 相簿</button>
                <button id="remoteMicBtn" style="flex: 1; padding: 12px 4px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 8px; font-weight: bold; font-size: 0.85rem;">🎙️ 語音</button>

                <input type="file" id="remoteCameraInput" accept="image/*" capture="environment" style="display: none;">
                <input type="file" id="remoteGalleryInput" accept="image/*" style="display: none;">
            </div>

            <textarea id="remoteInput" style="width: 100%; height: 200px; font-size: 1.2rem; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none;" placeholder="點擊語音講話，或點擊拍照辨識..." autocomplete="off"></textarea>

            <button onclick="sendToPc()" id="remoteSendBtn" style="width: 100%; padding: 15px; margin-top: 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 1.2rem; font-weight: bold;">🚀 將文字傳送到電腦</button>

            <button onclick="disconnectFromPhone()" style="width: 100%; padding: 12px; margin-top: 15px; background: #fee2e2; color: #b91c1c; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold;">❌ 結束配對</button>

            <p id="remoteStatus" style="margin-top: 15px; color: #059669; font-weight: bold; display: none;">✅ 已傳送到電腦！</p>
        </div>
    `;

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: '__CONNECTED__' })
    });

    let pcLastActiveTime = Date.now();

    // ✅ 修正 2：分頁背景/前景切換偵測
    let isPageHidden = false;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            isPageHidden = true;
        } else {
            isPageHidden = false;
            // 回到前景時，立刻補發一次心跳並重設時間戳，避免背景累積的空窗被誤判離線
            pcLastActiveTime = Date.now();
            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId + '_ALIVE', payload: 'HEARTBEAT' })
            }).catch(e => {});
        }
    });

    let phoneHeartbeat = setInterval(() => {
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId + '_ALIVE', payload: 'HEARTBEAT' })
        }).catch(e => {});

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: urlRoomId + '_CMD' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.text === '__DISCONNECT__') triggerPhoneDisconnectUI();
        }).catch(e => {});

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: urlRoomId + '_PC_ALIVE' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.text === 'PC_HEARTBEAT') pcLastActiveTime = Date.now();
        }).catch(e => {});

        // ✅ 修正 1：延長逾時 + 背景分頁時不判斷離線
        if (!isPageHidden && Date.now() - pcLastActiveTime > DISCONNECT_TIMEOUT_MS) {
            triggerPhoneDisconnectUI();
        }
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

    const remoteCameraBtn = document.getElementById('remoteCameraBtn');
    const remoteGalleryBtn = document.getElementById('remoteGalleryBtn');
    const remoteMicBtn = document.getElementById('remoteMicBtn');
    const remoteCameraInput = document.getElementById('remoteCameraInput');
    const remoteGalleryInput = document.getElementById('remoteGalleryInput');
    const remoteInput = document.getElementById('remoteInput');

    remoteCameraBtn.addEventListener('click', () => { remoteCameraInput.click(); });
    remoteGalleryBtn.addEventListener('click', () => { remoteGalleryInput.click(); });

    // ✅ 修正 3：補上手機端拍照/相簿選完照片後的實際辨識邏輯
    function handleRemoteImageFile(file) {
        if (!file) return;
        remoteCameraBtn.disabled = true;
        remoteGalleryBtn.disabled = true;
        const originalCameraText = remoteCameraBtn.innerText;
        const originalGalleryText = remoteGalleryBtn.innerText;
        remoteCameraBtn.innerText = '⏳';
        remoteGalleryBtn.innerText = '⏳';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const base64String = canvas.toDataURL('image/jpeg', 0.8);

                fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'processImage', token: getUserToken(), payload: base64String })
                })
                .then(response => response.text())
                .then(result => {
                    let finalText = result;
                    try {
                        const data = JSON.parse(result);
                        if (data.error) throw new Error(data.error);
                        finalText = data.text || result;
                    } catch (error) {}

                    remoteInput.value = (remoteInput.value ? remoteInput.value + '\n\n' : '') + '[系統辨識結果]：\n' + finalText;
                })
                .catch(error => { alert('❌ 辨識失敗，請重試'); })
                .finally(() => {
                    remoteCameraBtn.disabled = false;
                    remoteGalleryBtn.disabled = false;
                    remoteCameraBtn.innerText = originalCameraText;
                    remoteGalleryBtn.innerText = originalGalleryText;
                    remoteCameraInput.value = '';
                    remoteGalleryInput.value = '';
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    remoteCameraInput.addEventListener('change', function(e) { handleRemoteImageFile(e.target.files[0]); });
    remoteGalleryInput.addEventListener('change', function(e) { handleRemoteImageFile(e.target.files[0]); });

    const MobileSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let remoteRecognition = null;
    let isRemoteRecording = false;
    let remoteCurrentText = "";

    if (MobileSpeechRecognition) {
        remoteRecognition = new MobileSpeechRecognition();
        remoteRecognition.continuous = true;
        remoteRecognition.interimResults = true;
        remoteRecognition.lang = 'zh-TW';

        remoteRecognition.onstart = () => {
            isRemoteRecording = true;
            remoteCurrentText = remoteInput.value;
            if (remoteCurrentText && !remoteCurrentText.endsWith('\n')) remoteCurrentText += '\n';
            remoteMicBtn.style.background = '#fee2e2';
            remoteMicBtn.style.color = '#b91c1c';
            remoteMicBtn.innerHTML = '🛑 錄音中';
        };

        remoteRecognition.onresult = (e) => {
            let final = '', interim = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) final += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            remoteInput.value = remoteCurrentText + final + interim;
            if (final) remoteCurrentText += final;
        };

        remoteRecognition.onerror = () => { stopRemoteRec(); };
        remoteRecognition.onend = () => { if (isRemoteRecording) stopRemoteRec(); };
    }

    function stopRemoteRec() {
        if (!isRemoteRecording) return;
        isRemoteRecording = false;
        if (remoteRecognition) remoteRecognition.stop();
        remoteMicBtn.style.background = '#ecfdf5';
        remoteMicBtn.style.color = '#059669';
        remoteMicBtn.innerHTML = '🎙️ 語音';
    }

    remoteMicBtn.addEventListener('click', () => {
        if (!remoteRecognition) return alert('❌ 手機不支援語音辨識');
        if (isRemoteRecording) { stopRemoteRec(); }
        else { try { remoteRecognition.start(); } catch (err) { stopRemoteRec(); } }
    });

    window.sendToPc = function() {
        const text = remoteInput.value.trim();
        if (!text) return;
        const btn = document.getElementById('remoteSendBtn');
        btn.innerText = '傳送中...';

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: text })
        }).then(() => {
            remoteInput.value = '';
            btn.innerText = '🚀 將文字傳送到電腦';
            const status = document.getElementById('remoteStatus');
            status.style.display = 'block';
            setTimeout(() => status.style.display = 'none', 3000);
        });
    };

    window.disconnectFromPhone = function() {
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: '__DISCONNECT__' })
        }).then(() => { triggerPhoneDisconnectUI(); });
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

        const githubPageBaseUrl = 'https://yphai.github.io/YPhAI/';
        const syncUrl = `${githubPageBaseUrl}?roomId=${currentRoomId}&token=${getUserToken()}`;

        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(syncUrl)}`;
        document.getElementById('qrModal').style.display = 'flex';

        syncInterval = setInterval(() => {
            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: currentRoomId })
            })
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
                fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: currentRoomId + '_PC_ALIVE', payload: 'PC_HEARTBEAT' })
                }).catch(e => {});

                fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'syncGet', token: getUserToken(), roomId: currentRoomId + '_ALIVE' })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.text === 'HEARTBEAT') lastActiveTime = Date.now();
                }).catch(e => {});

                // ✅ 修正 1：延長逾時（原本 7000）
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
            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: currentRoomId + '_CMD', payload: '__DISCONNECT__' })
            });
        }

        const syncBtn = document.getElementById('mobileSyncBtn');
        syncBtn.innerHTML = '📱 手機配對';
        syncBtn.style.background = '#fef3c7';
        syncBtn.style.color = '#b45309';
        syncBtn.style.borderColor = '#fde68a';

        if (!isRemote) showToast('🔌 已結束手機配對');
    };
}

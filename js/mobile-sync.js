// js/mobile-sync.js
// 📱 手機語音遙控器配對邏輯（PC 端產生 QR code / 手機端掃碼進入遙控頁面）

const DISCONNECT_TIMEOUT_MS = 25000; // ⏳ 斷線容忍時間

let syncInterval = null;
let lastActiveTime = Date.now();
let isPhoneConnected = false;
let currentRoomId = null;

const mobileUrlParams = new URLSearchParams(window.location.search);
const urlRoomId = mobileUrlParams.get('roomId');

// 🟢 情境一：如果是手機掃 QR Code 進來的畫面
if (urlRoomId) {
    document.body.innerHTML = `
        <div class="mobile-remote" style="padding: 15px; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; background: #f0f4f8;">
            <h1 style="font-size: 1.3rem; margin: 0 0 5px 0; color: #0f172a;">📱 萬能語音遙控器</h1>
            <div style="background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-bottom: 10px; border: 1px solid #bbf7d0; display: inline-block; align-self: center;">
                🟢 成功與電腦端配對中
            </div>

            <!-- 四大功能按鈕區：長錄音、短錄音、拍照、相簿 -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; width: 100%; margin-bottom: 10px;">
                <button id="remoteLongAudioBtn" style="padding: 10px 4px; background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; border-radius: 8px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">⏺️ 長錄音</button>
                <button id="remoteMicBtn" style="padding: 10px 4px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 8px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">🎙️ 短錄音</button>
                <button id="remoteCameraBtn" style="padding: 10px 4px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">📷 拍照</button>
                <button id="remoteGalleryBtn" style="padding: 10px 4px; background: #6366f1; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">🖼️ 相簿</button>

                <input type="file" id="remoteCameraInput" accept="image/*" capture="environment" style="display: none;">
                <input type="file" id="remoteGalleryInput" accept="image/*" style="display: none;">
            </div>

            <textarea id="remoteInput" style="width: 100%; flex: 1; min-height: 150px; font-size: 1rem; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; resize: none; background: #fff;" placeholder="點擊上方按鈕開始錄音或拍照，內容將顯示於此..." autocomplete="off"></textarea>

            <button onclick="sendToPc()" id="remoteSendBtn" style="width: 100%; padding: 12px; margin-top: 10px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer;">🚀 將文字傳送到電腦</button>

            <button onclick="disconnectFromPhone()" style="width: 100%; padding: 10px; margin-top: 8px; background: #fee2e2; color: #b91c1c; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: bold; cursor: pointer;">❌ 結束配對</button>

            <p id="remoteStatus" style="margin-top: 8px; color: #059669; font-weight: bold; display: none; font-size: 0.9rem;">✅ 已傳送到電腦！</p>
        </div>
    `;

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncSend', token: getUserToken(), roomId: urlRoomId, payload: '__CONNECTED__' })
    });

    let pcLastActiveTime = Date.now();
    let isPageHidden = false;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            isPageHidden = true;
        } else {
            isPageHidden = false;
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

        if (!isPageHidden && Date.now() - pcLastActiveTime > DISCONNECT_TIMEOUT_MS) {
            triggerPhoneDisconnectUI();
        }
    }, 3000);

    function triggerPhoneDisconnectUI() {
        clearInterval(phoneHeartbeat);
        document.body.innerHTML = `
            <div class="mobile-remote" style="justify-content: center; align-items: center; height: 100vh; display: flex; flex-direction: column;">
                <h1 style="font-size: 1.8rem; margin-bottom: 10px;">🔌 已斷線</h1>
                <p style="color: #64748b; font-size: 1.1rem;">配對已中斷，您可以關閉此視窗。</p>
            </div>
        `;
    }

    const remoteInput = document.getElementById('remoteInput');
    const remoteCameraBtn = document.getElementById('remoteCameraBtn');
    const remoteGalleryBtn = document.getElementById('remoteGalleryBtn');
    const remoteCameraInput = document.getElementById('remoteCameraInput');
    const remoteGalleryInput = document.getElementById('remoteGalleryInput');
    const remoteMicBtn = document.getElementById('remoteMicBtn');
    const remoteLongAudioBtn = document.getElementById('remoteLongAudioBtn');

    // ------------------------------------------
    // 1. 手機端圖片 / 拍照處理 (呼叫與網頁版相同的 processImage)
    // ------------------------------------------
    remoteCameraBtn.addEventListener('click', () => { remoteCameraInput.click(); });
    remoteGalleryBtn.addEventListener('click', () => { remoteGalleryInput.click(); });

    function handleRemoteImageFile(file) {
        if (!file) return;
        remoteCameraBtn.disabled = true;
        remoteGalleryBtn.disabled = true;
        const originalCameraText = remoteCameraBtn.innerText;
        const originalGalleryText = remoteGalleryBtn.innerText;
        remoteCameraBtn.innerText = '⏳ 辨識中';
        remoteGalleryBtn.innerText = '⏳ 辨識中';

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

    // ------------------------------------------
    // 2. 手機端短錄音引擎 (採用防重複字重組法，與 speech-short.js 同步)
    // ------------------------------------------
    const MobileSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let remoteRecognition = null;
    let isRemoteRecording = false;
    let isRemoteLongRecording = false;
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
            remoteMicBtn.style.borderColor = '#fca5a5';
            remoteMicBtn.innerHTML = '⏹️ 停止短錄';
        };

        remoteRecognition.onresult = (e) => {
            // 🎯 核心修正：採用全文本重組法，徹底消滅手機端重複字句
            let sessionTranscript = '';
            for (let i = 0; i < e.results.length; ++i) {
                sessionTranscript += e.results[i][0].transcript;
            }
            remoteInput.value = remoteCurrentText + sessionTranscript;
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
        remoteMicBtn.style.borderColor = '#a7f3d0';
        remoteMicBtn.innerHTML = '🎙️ 短錄音';
    }

    remoteMicBtn.addEventListener('click', () => {
        if (isRemoteLongRecording) stopRemoteLongRecAndUpload();
        if (!remoteRecognition) return alert('❌ 手機瀏覽器不支援語音辨識');
        if (isRemoteRecording) { stopRemoteRec(); } 
        else { try { remoteRecognition.start(); } catch(err) { stopRemoteRec(); } }
    });

    // ------------------------------------------
    // 3. 手機端長錄音引擎 (呼叫與網頁版相同的 processWebAudio / Whisper)
    // ------------------------------------------
    let remoteMediaRecorder;
    let remoteAudioChunks = [];
    let remoteStream = null;

    remoteLongAudioBtn.addEventListener('click', async () => {
        if (isRemoteRecording) stopRemoteRec();

        if (!isRemoteLongRecording) {
            try {
                if (remoteStream) {
                    remoteStream.getTracks().forEach(t => t.stop());
                }
                remoteStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                
                let options = {};
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus' };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4' };
                }

                remoteMediaRecorder = new MediaRecorder(remoteStream, options);
                remoteAudioChunks = [];

                remoteMediaRecorder.ondataavailable = e => {
                    if (e.data && e.data.size > 0) remoteAudioChunks.push(e.data);
                };

                remoteMediaRecorder.onstop = () => {
                    const actualMimeType = remoteMediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(remoteAudioChunks, { type: actualMimeType });
                    processRemoteLongAudioUpload(audioBlob, actualMimeType);
                    if (remoteStream) {
                        remoteStream.getTracks().forEach(t => t.stop());
                    }
                };

                remoteMediaRecorder.start(500);
                isRemoteLongRecording = true;
                remoteLongAudioBtn.innerHTML = '⏹️ 停止並上傳';
                remoteLongAudioBtn.style.background = '#fee2e2';
                remoteLongAudioBtn.style.color = '#b91c1c';
                remoteLongAudioBtn.style.borderColor = '#fca5a5';
            } catch (err) {
                alert('❌ 無法存取手機麥克風權限');
            }
        } else {
            stopRemoteLongRecAndUpload();
        }
    });

    function stopRemoteLongRecAndUpload() {
        if (!isRemoteLongRecording) return;
        isRemoteLongRecording = false;
        if (remoteMediaRecorder && remoteMediaRecorder.state !== 'inactive') {
            remoteMediaRecorder.stop();
        }
        remoteLongAudioBtn.innerHTML = '⏳ 處理中...';
    }

    function processRemoteLongAudioUpload(blob, mimeType) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            const kbSize = Math.round(base64Audio.length / 1024);
            
            if (kbSize < 10) {
                alert(`⚠️ 錄音異常 (僅 ${kbSize}KB)，未偵測到有效聲音`);
                remoteLongAudioBtn.innerHTML = '⏺️ 長錄音';
                remoteLongAudioBtn.style.background = '#fdf2f8';
                remoteLongAudioBtn.style.color = '#db2777';
                remoteLongAudioBtn.style.borderColor = '#fbcfe8';
                return;
            }

            remoteLongAudioBtn.innerHTML = '⏳ Whisper 辨識中...';

            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'processWebAudio',
                    token: getUserToken(),
                    payload: base64Audio,
                    mimeType: mimeType
                })
            })
            .then(res => res.text())
            .then(result => {
                let finalText = result;
                try {
                    const data = JSON.parse(result);
                    if (data.error) throw new Error(data.error);
                    finalText = data.text || result;
                } catch (e) {}

                remoteInput.value = (remoteInput.value ? remoteInput.value + '\n\n' : '') + '[長段語音轉錄]：\n' + finalText;
            })
            .catch(err => {
                alert('❌ 長段語音辨識上傳失敗');
            })
            .finally(() => {
                remoteLongAudioBtn.innerHTML = '⏺️ 長錄音';
                remoteLongAudioBtn.style.background = '#fdf2f8';
                remoteLongAudioBtn.style.color = '#db2777';
                remoteLongAudioBtn.style.borderColor = '#fbcfe8';
            });
        };
    }

    window.sendToPc = function() {
        const text = remoteInput.value.trim();
        if (!text) return alert('⚠️ 內容為空');
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

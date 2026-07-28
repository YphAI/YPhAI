// audio-long.js
// ⏺️ 長段錄音共用工具 (Groq Whisper API) - 具備超時保護與大小防呆

window.SharedLongAudio = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    currentStream: null,
    currentBtn: null,
    currentInput: null,
    isRemote: false,
    timerInterval: null,
    secondsElapsed: 0,

    toggle: async function(btnEl, inputEl, isRemote = false) {
        if (window.SharedShortAudio && window.SharedShortAudio.isRecording) {
            window.SharedShortAudio.stop();
            if (typeof showToast === 'function') showToast('🔄 已自動停止短句錄音');
        }

        if (!this.isRecording) {
            this.currentBtn = btnEl;
            this.currentInput = inputEl;
            this.isRemote = isRemote;

            try {
                if (this.currentStream) {
                    this.currentStream.getTracks().forEach(track => track.stop());
                }
                
                this.currentStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } 
                });

                let options = {};
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
                else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };

                this.mediaRecorder = new MediaRecorder(this.currentStream, options);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = e => {
                    if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    clearInterval(this.timerInterval);
                    const actualMimeType = this.mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });
                    this.upload(audioBlob, actualMimeType);
                    if (this.currentStream) this.currentStream.getTracks().forEach(track => track.stop());
                };

                this.mediaRecorder.start(500);
                this.isRecording = true;
                this.secondsElapsed = 0;

                // ⏳ 啟動錄音計時器，超過 3 分鐘 (180秒) 自動停止，防止檔案過大
                this.timerInterval = setInterval(() => {
                    this.secondsElapsed++;
                    const min = Math.floor(this.secondsElapsed / 60);
                    const sec = this.secondsElapsed % 60;
                    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
                    
                    this.currentBtn.innerHTML = `⏹️ 停止 (${timeStr})`;
                    
                    if (this.secondsElapsed >= 180) { // 3分鐘極限
                        if (typeof showToast === 'function') showToast('⚠️ 達到單次錄音 3 分鐘上限，自動上傳');
                        this.stopAndUpload();
                    }
                }, 1000);

                this.currentBtn.classList.add('recording');
                this.currentBtn.style.background = '#fee2e2';
                this.currentBtn.style.color = '#b91c1c';
                this.currentBtn.style.borderColor = '#fca5a5';
                if (!isRemote && typeof showToast === 'function') showToast('⏺️ 開始長段收音 (限時 3 分鐘)...');

            } catch (err) {
                alert('❌ 無法存取麥克風，請確認權限');
            }
        } else {
            this.stopAndUpload();
        }
    },

    stopAndUpload: function() {
        if (!this.isRecording) return;
        this.isRecording = false;
        clearInterval(this.timerInterval);
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.currentBtn.innerHTML = '⏳ 處理中...';
        this.currentBtn.classList.remove('recording');
    },

    upload: function(blob, mimeType) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            const kbSize = Math.round(base64Audio.length / 1024);

            if (kbSize < 10) {
                alert(`⚠️ 錄音異常 (僅 ${kbSize}KB)，疑似未收到音，請重試！`);
                this.resetBtn();
                return;
            }

            // 🛡️ 檔案大小防呆：如果超過 5MB (約 5000KB)，拒絕上傳以保護 API 額度
            if (kbSize > 5000) {
                alert(`⚠️ 錄音檔案過大 (${Math.round(kbSize/1024)}MB)，請分段錄音後再送出！`);
                this.resetBtn();
                return;
            }

            if (!this.isRemote) {
                loadingMask.style.display = 'flex';
                loadingMask.innerHTML = `🎧 上傳中 (${kbSize}KB)...`;
            } else {
                this.currentBtn.innerHTML = '⏳ Whisper...';
            }

            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'processWebAudio', token: getUserToken(), payload: base64Audio, mimeType: mimeType })
            })
            .then(res => res.text())
            .then(result => {
                let finalText = result;
                try {
                    const data = JSON.parse(result);
                    if (data.error) throw new Error(data.error);
                    finalText = data.text || result;
                } catch (e) {}

                this.currentInput.value = (this.currentInput.value ? this.currentInput.value + '\n\n' : '') + '[長段語音轉錄]：\n' + finalText;
                
                if (!this.isRemote) {
                    if (typeof autoResize === 'function') autoResize(this.currentInput);
                    if (typeof showToast === 'function') showToast('✅ 語音辨識完成，自動送出分析...');
                    
                    const analyzeBtn = document.getElementById('analyzeBtn');
                    if (analyzeBtn && !analyzeBtn.disabled) analyzeBtn.click();
                } else {
                    if (typeof window.sendToPc === 'function') {
                        window.sendToPc(true); 
                    }
                }
            })
            .catch(err => alert('❌ 語音上傳失敗'))
            .finally(() => {
                if (!this.isRemote) loadingMask.style.display = 'none';
                this.resetBtn();
            });
        };
    },

    resetBtn: function() {
        if (this.currentBtn) {
            this.currentBtn.innerHTML = '⏺️ 長錄音';
            this.currentBtn.style.background = '#fdf2f8';
            this.currentBtn.style.color = '#db2777';
            this.currentBtn.style.borderColor = '#fbcfe8';
            this.currentBtn.disabled = false;
        }
    }
};

if (typeof longAudioBtn !== 'undefined') {
    longAudioBtn.addEventListener('click', () => SharedLongAudio.toggle(longAudioBtn, clinicalInput, false));
}

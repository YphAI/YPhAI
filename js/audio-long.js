// audio-long.js
// ⏺️ 長段錄音共用工具 (Groq Whisper API)

window.SharedLongAudio = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    currentStream: null,
    currentBtn: null,
    currentInput: null,
    isRemote: false,

    toggle: async function(btnEl, inputEl, isRemote = false) {
        // 防呆切換：如果短錄音開著，自動幫它關閉
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
                this.currentStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });

                let options = {};
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
                else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };

                this.mediaRecorder = new MediaRecorder(this.currentStream, options);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = e => {
                    if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    const actualMimeType = this.mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });
                    this.upload(audioBlob, actualMimeType);
                    if (this.currentStream) this.currentStream.getTracks().forEach(track => track.stop());
                };

                this.mediaRecorder.start(500);
                this.isRecording = true;

                this.currentBtn.innerHTML = '⏹️ 停止並上傳';
                this.currentBtn.classList.add('recording');
                this.currentBtn.style.background = '#fee2e2';
                this.currentBtn.style.color = '#b91c1c';
                this.currentBtn.style.borderColor = '#fca5a5';
                if (!isRemote && typeof showToast === 'function') showToast('⏺️ 開始長段收音...');

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

            if (!this.isRemote) {
                loadingMask.style.display = 'flex';
                loadingMask.innerHTML = `🎧 上傳中 (檔案大小: ${kbSize}KB)...`;
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
                if (!this.isRemote && typeof autoResize === 'function') {
                    autoResize(this.currentInput);
                    if (typeof showToast === 'function') showToast('✅ 語音辨識完成！');
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

// PC 端綁定
if (typeof longAudioBtn !== 'undefined') {
    longAudioBtn.addEventListener('click', () => SharedLongAudio.toggle(longAudioBtn, clinicalInput, false));
}

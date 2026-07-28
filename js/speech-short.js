// speech-short.js
// 🎙️ 短句即時共用工具 (Web Speech API)

const MobileSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

window.SharedShortAudio = {
    recognition: null,
    isRecording: false,
    currentInput: null,
    currentBtn: null,
    originalText: '',

    init: function() {
        if (!MobileSpeechRecognition) return false;
        this.recognition = new MobileSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-TW';

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.originalText = this.currentInput.value;
            if (this.originalText && !this.originalText.endsWith('\n')) this.originalText += '\n';

            this.currentBtn.classList.add('recording');
            this.currentBtn.style.background = '#fee2e2';
            this.currentBtn.style.color = '#b91c1c';
            this.currentBtn.style.borderColor = '#fca5a5';
            this.currentBtn.innerHTML = '⏹️ 停止短錄';
        };

        this.recognition.onresult = (e) => {
            let sessionTranscript = '';
            for (let i = 0; i < e.results.length; ++i) {
                sessionTranscript += e.results[i][0].transcript;
            }
            this.currentInput.value = this.originalText + sessionTranscript;
            if (this.currentInput.id === 'clinicalInput' && typeof autoResize === 'function') autoResize(this.currentInput);
        };

        this.recognition.onerror = () => { this.stop(); };
        this.recognition.onend = () => { if (this.isRecording) this.stop(); };
        return true;
    },

    toggle: function(btnEl, inputEl) {
        // 防呆切換：如果長錄音開著，自動幫它結算
        if (window.SharedLongAudio && window.SharedLongAudio.isRecording) {
            window.SharedLongAudio.stopAndUpload();
            if (typeof showToast === 'function') showToast('🔄 已自動結算長段錄音');
        }

        if (this.isRecording) {
            this.stop();
        } else {
            if (!this.recognition && !this.init()) {
                alert('❌ 瀏覽器不支援語音辨識');
                return;
            }
            this.currentBtn = btnEl;
            this.currentInput = inputEl;
            this.currentBtn.innerHTML = '⏳ 啟動中...';
            try { this.recognition.start(); } catch(err) { this.stop(); }
        }
    },

    stop: function() {
        if (!this.isRecording) return;
        this.isRecording = false;
        if (this.recognition) this.recognition.stop();
        if (this.currentBtn) {
            this.currentBtn.classList.remove('recording');
            this.currentBtn.style.background = '#ecfdf5';
            this.currentBtn.style.color = '#059669';
            this.currentBtn.style.borderColor = '#a7f3d0';
            this.currentBtn.innerHTML = '🎙️ 短句即時';
        }
    }
};

// PC 端綁定
if (typeof micBtn !== 'undefined') {
    micBtn.addEventListener('click', () => SharedShortAudio.toggle(micBtn, clinicalInput));
}

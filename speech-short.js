// speech-short.js
// 🎙️ 引擎 A：短句即時 (Web Speech API)

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

let isShortRecording = false;
let currentText = "";

function stopShortRec() {
    if (!isShortRecording) return;
    isShortRecording = false;
    if (recognition) recognition.stop();
    micBtn.classList.remove('recording');
    micBtn.innerHTML = '🎙️ 短句即時';
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW';

    recognition.onstart = () => {
        isShortRecording = true;
        currentText = clinicalInput.value;
        if (currentText && !currentText.endsWith('\n')) currentText += '\n';

        micBtn.classList.add('recording');
        micBtn.innerHTML = '⏹️ 停止即時辨識';
    };

    recognition.onresult = (e) => {
        let sessionTranscript = '';
        for (let i = 0; i < e.results.length; ++i) {
            sessionTranscript += e.results[i][0].transcript;
        }
        clinicalInput.value = currentText + sessionTranscript;
        autoResize(clinicalInput);
    };

    recognition.onerror = (e) => { stopShortRec(); };
    recognition.onend = () => { if (isShortRecording) stopShortRec(); };
}

micBtn.addEventListener('click', () => {
    if (!recognition) return showToast('❌ 瀏覽器不支援語音，請用 Chrome/Edge');

    // 💡 智慧切換：若長段錄音正在進行，自動結算切換！
    if (typeof isLongRecording !== 'undefined' && isLongRecording) {
        stopLongRecAndUpload();
        showToast('🔄 已自動結算長段錄音，切換至短句模式');
    }

    if (isShortRecording) {
        stopShortRec();
    } else {
        micBtn.innerHTML = '⏳ 啟動中...';
        try { recognition.start(); }
        catch (err) { stopShortRec(); }
    }
});

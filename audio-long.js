// audio-long.js
// ⏺️ 引擎 B：長段錄音 (Groq Whisper API - 防丟包偵測版)
// ⚠️ 注意：原始版本曾有兩個同名 processLongAudioUpload，第二個會覆蓋第一個，
// 導致「錄音小於 10KB 就提醒重錄」的防呆機制失效。這裡只保留正確的版本。

let isLongRecording = false;
let mediaRecorder;
let audioChunks = [];
let currentStream = null;

function stopLongRecAndUpload() {
    if (!isLongRecording) return;
    isLongRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    longAudioBtn.innerHTML = '⏳ 處理中...';
    longAudioBtn.classList.remove('recording');
    longAudioBtn.disabled = true;
}

longAudioBtn.addEventListener('click', async () => {
    if (typeof isShortRecording !== 'undefined' && isShortRecording) {
        stopShortRec();
    }

    if (!isLongRecording) {
        try {
            // 確保釋放舊的麥克風佔用
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }

            // 強制要求瀏覽器開啟降噪與最高取樣率，確保硬體確實啟動
            currentStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true }
            });

            // 尋找當下瀏覽器最安全的錄音格式
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' }; // Safari 專用
            }

            mediaRecorder = new MediaRecorder(currentStream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: actualMimeType });
                processLongAudioUpload(audioBlob, actualMimeType);

                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop());
                }
            };

            // 🎯 每 500 毫秒強制輸出一次音檔碎片，防止瀏覽器最後一刻丟包
            mediaRecorder.start(500);
            isLongRecording = true;

            longAudioBtn.innerHTML = '⏹️ 停止並上傳';
            longAudioBtn.classList.add('recording');
            showToast('⏺️ 開始長段收音 (請講至少3~5秒)...');

        } catch (err) {
            showToast('❌ 無法存取麥克風，請確認瀏覽器權限');
        }
    } else {
        stopLongRecAndUpload();
    }
});

function processLongAudioUpload(blob, mimeType) {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];

        // 🎯 診斷機制：計算音檔容量 (KB)
        const kbSize = Math.round(base64Audio.length / 1024);

        // 如果講了幾秒鐘，檔案卻小於 10KB，代表瀏覽器根本沒錄到聲音！
        if (kbSize < 10) {
            showToast(`⚠️ 錄音異常 (僅 ${kbSize}KB)，疑似未收到音，請重試！`);
            longAudioBtn.innerHTML = '⏺️ 長段錄音';
            longAudioBtn.disabled = false;
            return;
        }

        loadingMask.style.display = 'flex';
        loadingMask.innerHTML = `🎧 上傳中 (檔案大小: ${kbSize}KB)...`;

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'processWebAudio',
                token: getUserToken(),
                payload: base64Audio,
                mimeType: mimeType
            })
        })
        .then(response => response.text())
        .then(result => {
            let finalText = result;
            try {
                const data = JSON.parse(result);
                if (data.error) throw new Error(data.error);
                finalText = data.text || result;
            } catch (error) {}

            clinicalInput.value = (clinicalInput.value ? clinicalInput.value + '\n\n' : '') + '[長段語音轉錄]：\n' + finalText;
            autoResize(clinicalInput);
            showToast('✅ 語音辨識完成！');
        })
        .catch(error => showToast('❌ 語音上傳失敗'))
        .finally(() => {
            loadingMask.style.display = 'none';
            longAudioBtn.innerHTML = '⏺️ 長段錄音';
            longAudioBtn.disabled = false;
        });
    };
}

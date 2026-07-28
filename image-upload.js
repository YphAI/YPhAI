// image-upload.js
// 📷 電腦端圖片、相簿辨識 + Ctrl+V 貼上截圖辨識

pcCameraBtn.addEventListener('click', () => { cameraInput.click(); });
pcGalleryBtn.addEventListener('click', () => { galleryInput.click(); });

function handlePcImageFile(file, activeBtn) {
    if (!file) return;
    loadingMask.style.display = 'flex';
    loadingMask.innerHTML = '🔍 正在辨識影像...';
    activeBtn.disabled = true;

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
                body: JSON.stringify({
                    action: 'processImage',
                    token: getUserToken(),
                    payload: base64String
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

                clinicalInput.value = (clinicalInput.value ? clinicalInput.value + '\n\n' : '') + '[系統辨識結果]：\n' + finalText;
                autoResize(clinicalInput);
                showToast('✅ 影像辨識完成');
            })
            .catch(error => showToast('❌ 辨識失敗'))
            .finally(() => {
                loadingMask.style.display = 'none';
                loadingMask.innerHTML = '⏳ 醫療大腦運算中，請稍候...';
                activeBtn.disabled = false;
                cameraInput.value = '';
                galleryInput.value = '';
            });
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

cameraInput.addEventListener('change', function(e) { handlePcImageFile(e.target.files[0], pcCameraBtn); });
galleryInput.addEventListener('change', function(e) { handlePcImageFile(e.target.files[0], pcGalleryBtn); });

// ==========================================
// 📋 支援電腦端直接貼上截圖 (Ctrl + V)
// ==========================================
document.addEventListener('paste', function(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== 0) continue;

        const blob = items[i].getAsFile();
        if (!blob) return;

        showToast('📋 偵測到剪貼簿截圖，正在辨識...');
        loadingMask.style.display = 'flex';
        loadingMask.innerHTML = '🔍 正在辨識貼上的截圖...';

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
                    body: JSON.stringify({
                        action: 'processImage',
                        token: getUserToken(),
                        payload: base64String
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

                    clinicalInput.value = (clinicalInput.value ? clinicalInput.value + '\n\n' : '') + '[系統辨識截圖]：\n' + finalText;
                    autoResize(clinicalInput);
                    showToast('✅ 截圖辨識完成');
                })
                .catch(error => showToast('❌ 截圖辨識失敗'))
                .finally(() => {
                    loadingMask.style.display = 'none';
                    loadingMask.innerHTML = '⏳ 醫療大腦運算中，請稍候...';
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
    }
});

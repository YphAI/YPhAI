// image-upload.js
// 📷 影像處理共用工具 + Ctrl+V 貼上截圖辨識

window.SharedImageUtil = {
    process: function(file, targetInput, activeBtn, isRemote = false) {
        if (!file) return;
        const originalText = activeBtn.innerText;
        activeBtn.disabled = true;
        activeBtn.innerText = '⏳ 辨識中';

        if (!isRemote) {
            loadingMask.style.display = 'flex';
            loadingMask.innerHTML = '🔍 正在辨識影像...';
        } else {
            targetInput.value = (targetInput.value ? targetInput.value + '\n\n' : '') + '[系統辨識中...]';
        }

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

                    if (isRemote) {
                        targetInput.value = targetInput.value.replace('[系統辨識中...]', '[系統辨識結果]：\n' + finalText);
                    } else {
                        targetInput.value = (targetInput.value ? targetInput.value + '\n\n' : '') + '[系統辨識結果]：\n' + finalText;
                        if (typeof autoResize === 'function') autoResize(targetInput);
                        if (typeof showToast === 'function') showToast('✅ 影像辨識完成');
                    }
                })
                .catch(error => {
                    if (isRemote) targetInput.value = targetInput.value.replace('[系統辨識中...]', '[辨識失敗]');
                    else if (typeof showToast === 'function') showToast('❌ 辨識失敗');
                })
                .finally(() => {
                    if (!isRemote) loadingMask.style.display = 'none';
                    activeBtn.disabled = false;
                    activeBtn.innerText = originalText;
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// ==========================================
// PC 端按鈕綁定 (手機端會在 mobile-sync 綁定)
// ==========================================
if (typeof pcCameraBtn !== 'undefined') {
    pcCameraBtn.addEventListener('click', () => { cameraInput.click(); });
    pcGalleryBtn.addEventListener('click', () => { galleryInput.click(); });
    cameraInput.addEventListener('change', function(e) { SharedImageUtil.process(e.target.files[0], clinicalInput, pcCameraBtn, false); cameraInput.value = ''; });
    galleryInput.addEventListener('change', function(e) { SharedImageUtil.process(e.target.files[0], clinicalInput, pcGalleryBtn, false); galleryInput.value = ''; });
}

// 📋 支援電腦端直接貼上截圖 (Ctrl + V)
document.addEventListener('paste', function(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== 0) continue;
        const blob = items[i].getAsFile();
        if (!blob) return;

        if (typeof showToast === 'function') showToast('📋 偵測到剪貼簿截圖，正在辨識...');
        if (typeof loadingMask !== 'undefined') {
            loadingMask.style.display = 'flex';
            loadingMask.innerHTML = '🔍 正在辨識貼上的截圖...';
        }

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

                    clinicalInput.value = (clinicalInput.value ? clinicalInput.value + '\n\n' : '') + '[系統辨識截圖]：\n' + finalText;
                    if (typeof autoResize === 'function') autoResize(clinicalInput);
                    if (typeof showToast === 'function') showToast('✅ 截圖辨識完成');
                })
                .catch(error => { if (typeof showToast === 'function') showToast('❌ 截圖辨識失敗'); })
                .finally(() => { if (typeof loadingMask !== 'undefined') loadingMask.style.display = 'none'; });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
    }
});

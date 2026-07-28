// tags-and-analyze.js
// 快捷標籤載入、清空輸入、送出分析

const selectedTags = new Set();

window.onload = () => {
    fetch(GAS_WEB_APP_URL + '?action=getInitialData')
        .then(response => response.json())
        .then(data => {
            categoryTabs.innerHTML = '';
            const colorPalettes = [
                { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', icon: '💊' },
                { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '🔄' },
                { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', icon: '⚠️' },
                { bg: '#ede9fe', color: '#5b21b6', border: '#ddd6fe', icon: '📉' },
                { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', icon: '📌' }
            ];

            data.tags.forEach((tag, index) => {
                const style = colorPalettes[index % colorPalettes.length];
                const btn = document.createElement('button');
                btn.className = 'tag-btn';
                btn.style.cssText = `background: ${style.bg}; color: ${style.color}; border: 1px solid ${style.border}; padding: 6px 12px; font-size: 0.85rem; border-radius: 20px;`;
                btn.innerHTML = `${style.icon} ${tag}`;

                btn.onclick = function() {
                    if (this.classList.contains('active')) {
                        this.classList.remove('active');
                        selectedTags.delete(tag);
                    } else {
                        this.classList.add('active');
                        selectedTags.add(tag);
                    }
                };
                categoryTabs.appendChild(btn);
            });
        })
        .catch(error => {
            categoryTabs.innerHTML = '<span style="color:red; font-size:0.85rem;">⚠️ 無法載入標籤，請檢查 GAS 網址</span>';
        });
};

window.clearClinicalInput = function() {
    clinicalInput.value = '';
    autoResize(clinicalInput);
    document.querySelectorAll('.tag-btn.active').forEach(btn => btn.classList.remove('active'));
    if (typeof selectedTags !== 'undefined') selectedTags.clear();
    showToast('🗑️ 內容與標籤已重置');
    clinicalInput.focus();
};

analyzeBtn.addEventListener('click', () => {
    const inputText = clinicalInput.value.trim();
    const tagsArray = Array.from(selectedTags);

    if (!inputText && tagsArray.length === 0) return showToast('⚠️ 請輸入主訴或選擇標籤');

    let payloadText = inputText;
    if (tagsArray.length > 0) {
        payloadText = `[病患詢問重點：${tagsArray.join(', ')}]\n` + inputText;
    }

    loadingMask.style.display = 'flex';
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '⏳ 處理中...';

    fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'callGemini',
            token: getUserToken(),
            payload: payloadText
        })
    })
    .then(response => response.text())
    .then(jsonString => {
        try {
            const data = JSON.parse(jsonString);
            if (data.error) {
                showToast('❌ ' + data.error);
            } else {
                categoryBadge.innerHTML = '🏷️ ' + (data.category || '未分類');
                categoryBadge.style.display = 'inline-block';

                let processedProblem = typeof data.problem === 'object' ? JSON.stringify(data.problem, null, 2) : (data.problem || '');
                problemOutput.value = processedProblem.replace(/\\n/g, '\n');

                let processedReply = '';
                if (typeof data.reply === 'object') {
                    if (Array.isArray(data.reply)) {
                        processedReply = data.reply.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join('\n');
                    } else {
                        processedReply = JSON.stringify(data.reply, null, 2);
                    }
                } else {
                    processedReply = data.reply || '';
                }

                replyOutput.value = processedReply.replace(/\\n/g, '\n');

                autoResize(problemOutput);
                autoResize(replyOutput);
                showToast('✅ 分析完成');
            }
        } catch (e) {
            showToast('❌ 資料解析失敗');
        }
    })
    .catch(error => showToast('❌ 網路連接失敗'))
    .finally(() => {
        loadingMask.style.display = 'none';
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '✨ 送出分析';
    });
});

// 🔗 Micromedex 連結
document.getElementById('micromedexBtn').addEventListener('click', () => {
    window.open('https://www.micromedexsolutions.com/micromedex2/librarian/PFActionId/evidencexpert.FindDrugInteractions?navitem=topInteractions&isToolPage=true#/drugInteractionSearch', '_blank');
});

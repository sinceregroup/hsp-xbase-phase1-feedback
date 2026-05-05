// ==========================================
// CONFIGURATION
// ==========================================
// 這裡填入跟 GAS 後端一致的 Key
const API_KEY = 'hsp-xbase-phase1-feedback-2026';

// 1. Parse URL Parameters (Global Scope)
const urlParams = new URLSearchParams(window.location.search);

document.addEventListener('DOMContentLoaded', function () {
    const sideParam = urlParams.get('side') || '';
    const floorParam = urlParams.get('floor') || '';
    const companyParam = urlParams.get('company') || '';

    // 2. Set Input Fields from URL
    const sideInput = document.getElementById('side');
    if (sideInput && sideParam) {
        sideInput.value = sideParam;
    }

    const companyInput = document.getElementById('company');
    if (companyInput && companyParam) {
        companyInput.value = companyParam;
    }

    // 3. Populate Floor Dropdown
    const floorSelect = document.getElementById('floor');
    const floors = typeof xbaseFloors !== 'undefined' ? xbaseFloors : [];

    if (floors.length > 0) {
        floors.forEach(floor => {
            const option = document.createElement('option');
            option.value = floor;
            option.textContent = floor;
            if (floor === floorParam) {
                option.selected = true;
            }
            floorSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = "其他";
        option.textContent = "其他 (Other)";
        floorSelect.appendChild(option);
    }

    // 4. Setup Issue Dropdowns logic
    setupIssueDropdowns();
});

function setupIssueDropdowns() {
    const floorSelect = document.getElementById('floor');
    const sideInput = document.getElementById('side');
    const categorySelect = document.getElementById('issueCategory');
    const locationSelect = document.getElementById('issueLocation');

    function updateDropdowns() {
        const floor = floorSelect.value;
        const side = sideInput.value;
        const key = `${floor}-${side}`;

        // Clear existing
        categorySelect.innerHTML = '<option value="" selected disabled>請選擇分類 (Select Category)</option>';
        locationSelect.innerHTML = '<option value="" selected disabled>請選擇位置 (Select Location)</option>';

        if (!floor || !side) {
            categorySelect.innerHTML = '<option value="" selected disabled>請先選擇樓層與確認方位</option>';
            locationSelect.disabled = true;
            categorySelect.disabled = true;
            return;
        }

        categorySelect.disabled = false;

        // Populate Categories
        if (typeof issueCategories !== 'undefined') {
            issueCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        }

        // Populate Locations
        if (typeof issueLocations !== 'undefined') {
            const locs = issueLocations[key];
            if (locs) {
                locationSelect.disabled = false;
                locs.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc;
                    option.textContent = loc;
                    locationSelect.appendChild(option);
                });
            } else {
                locationSelect.innerHTML = '<option value="" selected disabled>目前尚無此區域資料</option>';
                locationSelect.disabled = true;
            }
        }
    }

    floorSelect.addEventListener('change', updateDropdowns);
    
    // Initial check
    if (floorSelect.value && sideInput.value) {
        updateDropdowns();
    } else {
        categorySelect.disabled = true;
        locationSelect.disabled = true;
    }
}

// ==========================================
// 圖片處理邏輯 (含 HEIC 自動轉檔)
// ==========================================
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const imageBase64 = document.getElementById('imageBase64');
const imageMimeType = document.getElementById('imageMimeType'); // 需在 HTML 增加此 hidden input
const submitBtn = document.getElementById('submitBtn'); // 取得按鈕以便控制鎖定

// 建立狀態提示文字
const imageStatus = document.createElement('div');
imageStatus.className = 'mt-2 small text-muted';
if (imageInput) imageInput.parentNode.appendChild(imageStatus);

if (imageInput) {
    imageInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];

        // 重置 UI
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        imageBase64.value = '';
        if (imageMimeType) imageMimeType.value = '';
        imageStatus.innerHTML = '';

        if (!file) return;

        // 鎖定送出按鈕，避免轉檔未完成就送出
        if (submitBtn) submitBtn.disabled = true;
        imageStatus.innerHTML = '<span class="spinner-border spinner-border-sm me-1 text-primary"></span>處理圖片中... (Processing...)';

        try {
            let processedFile = file;
            let finalMimeType = file.type;

            // 檢查是否為 HEIC / HEIF
            // 檔名檢查是為了相容某些舊瀏覽器無法識別 type 的情況
            const isHeic = file.type === 'image/heic' ||
                file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif');

            if (isHeic) {
                imageStatus.innerHTML = '<span class="spinner-border spinner-border-sm me-1 text-primary"></span>HEIC 轉檔中... (Converting...)';
                // 使用 heic2any 轉成 JPEG
                const blob = await heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.8
                });
                processedFile = Array.isArray(blob) ? blob[0] : blob;
                finalMimeType = 'image/jpeg';
            }

            // 讀取檔案 (原檔或轉檔後的 Blob)
            const reader = new FileReader();
            reader.onload = function (e) {
                // 1. 顯示預覽
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';

                // 2. 設定 Base64 (移除 data:image/xxx;base64, 前綴)
                const base64String = e.target.result.split(',')[1];
                imageBase64.value = base64String;

                // 3. 設定 MimeType
                if (imageMimeType) imageMimeType.value = finalMimeType;

                // 4. 更新狀態並解鎖按鈕
                imageStatus.innerHTML = '<span class="text-success fw-bold">✓ 圖片已準備就緒 (Image Ready)</span>';
                if (submitBtn) submitBtn.disabled = false;
            };

            reader.readAsDataURL(processedFile);

        } catch (error) {
            console.error("Image Error:", error);
            imageStatus.innerHTML = '<span class="text-danger">❌ 圖片處理失敗，請換一張 (Process Failed)</span>';
            imageInput.value = ''; // 清空
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}



// ==========================================
// Form Submission
// ==========================================
$('#submitBtn').on('click', function () {
    const submitButton = $(this);
    const form = document.getElementById('feedbackForm');

    // 1. HTML5 Basic Validation
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // 2. Phone/Ext Validation (如果有的話)
    const contactInput = $('#contact').val().trim();
    if (contactInput) {
        // 允許: 09開頭手機, 0開頭市話, #開頭分機, 或 3-8碼純數字分機
        const phoneRegex = /(^0[\d\-#]{6,20}$)|(^#?\d{3,8}$)/;
        if (!phoneRegex.test(contactInput)) {
            $('#alertModalBody').html('<b>電話格式有誤</b><br>請輸入有效的手機、市話或分機號碼。<br><small class="text-muted">Invalid phone number format.</small>');
            new bootstrap.Modal(document.getElementById('alertModal')).show();
            return;
        }
    }

    // 3. Email Validation (如果有的話)
    const emailInput = $('#email').val().trim();
    if (emailInput) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput)) {
            $('#alertModalBody').html('<b>Email 格式有誤</b><br>請輸入有效的電子信箱地址。<br><small class="text-muted">Invalid email address.</small>');
            new bootstrap.Modal(document.getElementById('alertModal')).show();
            return;
        }
    }

    // Lock Button
    submitButton.prop('disabled', true);
    submitButton.html('<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>傳送中... (Submitting...)');

    // 4. Prepare Data (FormData)
    const formData = new FormData();
    // 優先使用網址列的 key 參數，若無則使用預設 API_KEY
    const urlKey = urlParams.get('key');
    formData.append('key', urlKey || API_KEY);

    formData.append('company', $('#company').val() || '');
    formData.append('floor', $('#floor').val());
    formData.append('side', $('#side').val() || '');
    formData.append('name', $('#name').val() || '');
    formData.append('contact', contactInput);
    formData.append('email', emailInput);
    formData.append('issueCategory', $('#issueCategory').val() || '');
    formData.append('issueLocation', $('#issueLocation').val() || '');
    formData.append('issueDescription', $('#issueDescription').val() || '');
    formData.append('feedback', $('#feedback').val() || '');
    formData.append('image', $('#imageBase64').val() || '');

    // 這裡改為讀取 hidden input 的 mimeType (因為可能被轉檔成 jpeg 了)
    // 如果沒有圖片，給空值
    formData.append('mimeType', $('#imageMimeType').val() || '');

    // 5. Send via fetch
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.result === 'success') {
                showSuccess();
            } else {
                throw new Error(data.message || data.error || 'Unknown Error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            submitButton.prop('disabled', false);
            submitButton.html('送出意見 <small class="d-block fw-normal opacity-75" style="font-size: 0.8rem;">Submit Feedback</small>');

            $('#alertModalBody').html('提交失敗 (Submission Failed):<br>' + (error.message || error));
            const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
            alertModal.show();
        });

    function showSuccess() {
        $('#mainContainer').fadeOut(300, function () {
            $('#successContainer').fadeIn(500);
        });
    }
});
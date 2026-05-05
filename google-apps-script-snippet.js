/**
 * Google Apps Script for HSP Housing Feedback (With Discord Webhook)
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code into Code.gs.
 * 4. Replace 'YOUR_FOLDER_ID_HERE' with the ID of the Google Drive folder where you want to save images.
 *    (Folder ID is the last part of the folder URL: drive.google.com/drive/folders/THIS_PART)
 * 5. Save and Deploy as Web App:
 *    - Click "Deploy" > "New deployment".
 *    - Select type: "Web app".
 *    - Description: "v1".
 *    - Execute as: "Me".
 *    - Who has access: "Anyone" (IMPORTANT for the form to work without login).
 *    - Click "Deploy" and copy the "Web App URL".
 * 6. Paste the Web App URL into the `SCRIPT_URL` constant in your config.js file.
 */

const FOLDER_ID = '1F0co9gN49TPEekbcoiosZEqmIddVP5fX'; // 您的 Google Drive 資料夾 ID
const SHEET_NAME = 'Sheet1';
const VALID_KEY = 'sincere-hsp-feedback-2025'; // 前端傳來的驗證金鑰
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1442725655740547072/74z5X93v9XhqTOjkIFhXdoOyItVqKJyLE0typ73bwWjdBElgVXrPG7iSes3H1JQ7IPdp'; // 您的 Discord Webhook

function doPost(e) {
    try {
        // 1. 安全性檢查 (API Key)
        const requestKey = e.parameter.key;
        if (requestKey !== VALID_KEY) {
            return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'message': 'Invalid API Key' }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // 2. 取得試算表
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

        // 3. 提取參數
        const params = e.parameter;
        const company = params.company || '未提供';
        const floor = params.floor || '未指定';
        const side = params.side || '未指定';
        const name = params.name || '';
        const contact = params.contact || '';
        const email = params.email || '';
        const issueCategory = params.issueCategory || '未提供';
        const issueLocation = params.issueLocation || '未提供';
        const issueDescription = params.issueDescription || '無內容';
        const feedback = params.feedback || '無內容';
        const imageBase64 = params.image || '';
        const mimeType = params.mimeType || 'image/jpeg';

        let fileUrl = '';
        let fileId = ''; // 用於 Discord 圖片顯示

        // 4. 處理圖片上傳
        if (imageBase64 && FOLDER_ID && FOLDER_ID !== 'YOUR_FOLDER_ID_HERE') {
            try {
                const decoded = Utilities.base64Decode(imageBase64);
                const blob = Utilities.newBlob(decoded, mimeType, `upload_${Date.now()}`);
                const folder = DriveApp.getFolderById(FOLDER_ID);
                const file = folder.createFile(blob);

                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

                fileUrl = file.getUrl();
                fileId = file.getId(); // 抓取 ID 供 Discord 使用
            } catch (err) {
                fileUrl = 'Error saving image: ' + err.toString();
            }
        }

        // 5. 寫入試算表
        // 在 contact 前面加單引號 ' 強制轉為字串，避免 0 被吃掉
        const contactValue = contact ? "'" + contact : "";

        sheet.appendRow([
            new Date(),
            company,
            floor,
            side,
            name,
            contactValue,
            email,
            issueCategory,
            issueLocation,
            issueDescription,
            feedback,
            fileUrl
        ]);

        // 6. 發送 Discord 通知 (非同步執行，避免卡住回應)
        // 注意：GAS 的 doPost 內最好直接執行，不要用 trigger，以免權限問題
        sendDiscordWebhook(company, floor, side, name, contact, email, issueCategory, issueLocation, issueDescription, feedback, fileId);

        return ContentService.createTextOutput(JSON.stringify({ 'result': 'success' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 發送 Discord Webhook
 */
function sendDiscordWebhook(company, floor, side, name, contact, email, issueCategory, issueLocation, issueDescription, feedback, fileId) {
    if (!DISCORD_WEBHOOK_URL) return;

    // 1. 組合描述文字
    let description = `**分類：** ${issueCategory}\n**位置：** ${issueLocation}\n\n`;
    description += `**故障說明：**\n${issueDescription}\n\n`;
    description += `**意見回饋：**\n${feedback}\n\n`;

    // 組合聯絡資訊
    const nameStr = name || "未提供";
    const contactStr = contact || "未提供";
    const emailStr = email || "未提供";

    description += `**聯絡資訊：**\n👤 ${nameStr}  |  📞 ${contactStr}\n📧 ${emailStr}`;

    // 2. 準備 Embed 物件
    const embed = {
        title: "🛠️ 竹科X基地第一期意見回饋",
        // 將公司與樓層方位放在作者欄位，顯示效果最好
        author: {
            name: `${company} - ${floor} ${side}`,
            // 這裡可以放一個通用的圖標，例如房子的 icon，或者留空
        },
        description: description,
        color: 0x0071E3,
        footer: {
            text: "回饋時間：" + new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
        }
    };

    // 3. 如果有圖片，加入 Image 欄位
    // Discord 無法直接顯示 drive.google.com/file/d/.../view 的連結
    // 必須轉換成 drive.google.com/uc?export=view&id=...
    if (fileId) {
        const directImageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        embed.image = {
            url: directImageUrl
        };
    }

    const payload = {
        embeds: [embed]
    };

    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        UrlFetchApp.fetch(DISCORD_WEBHOOK_URL, options);
    } catch (e) {
        console.error("發送 Discord Webhook 失敗: " + e.toString());
    }
}

// 初始化 Sheet 標題用
function setupSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Timestamp', 'Company', 'Floor', 'Side', 'Name', 'Contact', 'Email', 'Category', 'Location', 'Description', 'Feedback', 'Image URL']);
    }
}
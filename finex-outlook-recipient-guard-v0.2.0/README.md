# FINEX Outlook Recipient Guard

[日本語](README.ja-JP.md)

Outlook 寄送前防呆 Add-in。它使用 Smart Alerts `OnMessageSend` 與 `PromptUser`，在發現外部收件者或其他風險時顯示原生確認框；寄件者仍可選擇 **Send Anyway**。本工具用來降低誤寄機率，不是 DLP，也不宣稱能阻止惡意外傳。

## 支援範圍

- Microsoft 365／Exchange Online
- Outlook 網頁版、新版 Outlook for Windows
- 支援 Mailbox 1.12 的傳統 Outlook for Windows
- Mac 版可能可運作，但本版未驗證
- Outlook iOS／Android 不支援 Smart Alerts 寄送事件，因此不在保護範圍

正式環境應由 Microsoft 365 管理員集中部署。側載只供本機開發與試行。

## 目前行為

- 內部網域預設為 `finex-tech.com.tw`。
- 未受信任的外部網域會觸發確認；`sk-el.co.jp` 預設為可信任外部網域，可直接通過一般外寄提醒。
- 混合外寄時會顯示可信任與需確認的外部地址，按 To／CC／BCC 標示。受 Smart Alerts 500 字元限制，優先顯示高風險問題，再顯示外部地址與網域摘要。
- To、CC、BCC 合計達 200 人時提醒。此數值是可調整的試行值。
- 附件原始大小合計大於 150 MB 時提醒；inline 內容也計入，訊息會分別顯示一般附件與 inline 容量。此數值不是 Exchange 的實際郵件上限。
- 跨 To／CC／BCC 的重複地址預設會提醒。
- Email 格式、疑似內部網域拼錯與管理員指定的高風險網域會優先顯示。
- 所有提醒皆可由寄件者覆寫，與本工具的防呆定位一致。

通訊群組通常只會以群組地址呈現，Add-in 無法可靠展開成員。群組內的外部成員可能不會被識別，本版不宣稱涵蓋此情境。

## 規則設定（schema v2）

正式設定放在與 Add-in 相同來源的 HTTPS URL：

```text
https://outlook-guard.finex-tech.com.tw/config/rules.json
```

此 endpoint 必須讓未連 VPN 的 Outlook Web 使用者讀取，並設為公開唯讀；管理員仍由內網檔案伺服器或受控發布流程修改。公開設定不可放密碼、金鑰、個人 Email 或群組地址。

```json
{
  "$schemaVersion": 2,
  "settings": {
    "internalDomains": ["finex-tech.com.tw"],
    "warnAtRecipientCount": 200,
    "warnAboveTotalAttachmentBytes": 157286400,
    "warnInvalidEmailFormat": true,
    "warnDuplicateRecipients": true,
    "typoDetection": {
      "enabled": true,
      "maxDomainEditDistance": 2
    }
  },
  "trustedExternalDomains": ["sk-el.co.jp"],
  "highRiskDomains": []
}
```

`trustedExternalDomains` 只免除一般外寄確認，不是其他規則的通行證。`highRiskDomains` 會產生高優先提醒；同一網域不可同時存在於兩者，否則整份遠端設定無效。

網域預設採精確比對。`*.example.com` 只匹配 `a.example.com` 等子網域，不包含根網域 `example.com`；兩者都需要時必須分別列出。內部網域採相同規則。

Add-in 每次寄送會以 ETag 條件式請求讀取設定，最多等待 2 秒。逾時、HTTP 錯誤、無效 JSON、schema v1 或規則衝突時，會依序使用該 runtime 最後一次有效設定或隨版本編譯的備援設定，並提醒寄件者設定可能不是最新版。發布新版本時，請同步更新 `config/rules.json` 與 `src/fallback-rules.ts`。

## 本機開發

安裝 Node.js 20 LTS 後執行：

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run validate:manifest
npm run dev
```

開發伺服器使用 `https://localhost:3000`。第一次測試前需信任本機 HTTPS 憑證，再將 `manifest.xml` 側載到 Outlook。

正式部署時，先產生正式 manifest：

```powershell
npm run manifest:production -- https://add-in.example.com
npm run validate:manifest:production
```

腳本會把 manifest 內所有 `https://localhost:3000` 換成公司 HTTPS 主機並輸出 `manifest.production.xml`。再透過 Microsoft 365 管理中心先部署給 IT 與 5–10 位高外寄量使用者。試行至少一週並驗證三種 Windows／Web Outlook 用戶端後，再逐步擴大。

## 語系與遙測

Outlook 顯示語言為日文時使用 `ja-JP`，其他語系回退 `zh-TW`。日文翻譯如有歧義，以繁體中文文件為準。

本版不傳送遙測，只預留 no-op `TelemetryClient` 介面。未來若啟用，應只收集規則代碼、數量、用戶端類型、時間與設定版本，不收集主旨、附件名稱或完整 Email。

## 設計參考

寄送確認的資訊排序與 To／CC／BCC 分組概念參考 OutlookOkan。原專案是 Apache 2.0 授權的 Windows VSTO/WPF Add-in；本專案維持 Web Add-in 架構，未引入其 WPF/VSTO 程式碼、簽署金鑰、`.vs`、`bin` 或 `obj`。詳見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

# FINEX Outlook Recipient Guard

[繁體中文](README.md)

Outlook の誤送信を防ぐための確認用 Add-in です。Smart Alerts の `OnMessageSend` と `PromptUser` を使用し、社外宛先やその他のリスクが見つかった場合に Outlook 標準の確認画面を表示します。送信者は **Send Anyway** を選択できます。本ツールは誤操作を減らすためのものであり、DLP や悪意ある情報持ち出しを防止する仕組みではありません。

> この日本語訳に曖昧な点がある場合は、繁体字中国語版を正とします。

## サポート範囲

- Microsoft 365／Exchange Online
- Outlook on the web、新しい Outlook for Windows
- Mailbox 1.12 対応の従来版 Outlook for Windows
- Outlook for Mac は本リリースでは未検証
- Outlook iOS／Android は Smart Alerts の送信イベントに対応していないため対象外

本番環境では Microsoft 365 管理センターから一元展開してください。サイドロードは開発と試行にのみ使用します。

## 動作概要

- 社内ドメインの初期値は `finex-tech.com.tw` です。
- 信頼済みではない社外ドメインがある場合は確認を表示します。`sk-el.co.jp` は初期状態で信頼済みです。
- 社外宛先が混在する場合、To／CC／BCC と信頼状態を表示します。Smart Alerts の 500 文字制限により、高リスク項目、社外宛先、ドメイン概要の順で表示します。
- 宛先が合計 200 件以上の場合に注意を表示します。この値は試行用で変更できます。
- 添付ファイルの元サイズが合計 150 MB を超える場合に注意を表示します。インライン添付も含みます。この値は Exchange の実際の上限ではありません。
- To／CC／BCC 間の重複宛先、メール形式、社内ドメインの入力ミス、高リスクドメインを確認します。
- すべての注意は送信者が上書きできます。

配布リストは通常、グループのアドレスとしてのみ取得されます。Add-in はメンバーを確実に展開できないため、グループ内の社外メンバーを検出できない場合があります。

## ルール設定（schema v2）

本番設定は Add-in と同一オリジンの HTTPS URL で公開します。

```text
https://outlook-guard.finex-tech.com.tw/config/rules.json
```

VPN に接続していない Outlook Web ユーザーも読み取れる、公開・読み取り専用の endpoint とします。更新は社内ファイルサーバーまたは管理された公開手順から管理者だけが行います。公開設定にはパスワード、鍵、個人のメールアドレス、グループアドレスを含めないでください。

```json
{
  "$schemaVersion": 2,
  "settings": {
    "internalDomains": ["finex-tech.com.tw"],
    "warnAtRecipientCount": 200,
    "warnAboveTotalAttachmentBytes": 157286400,
    "warnInvalidEmailFormat": true,
    "warnDuplicateRecipients": true,
    "typoDetection": { "enabled": true, "maxDomainEditDistance": 2 }
  },
  "trustedExternalDomains": ["sk-el.co.jp"],
  "highRiskDomains": []
}
```

`trustedExternalDomains` は通常の社外送信確認だけを省略します。`highRiskDomains` は優先度の高い注意を表示します。同じドメインを両方に設定すると、リモート設定全体が無効になります。

ドメインは完全一致です。`*.example.com` は `a.example.com` などのサブドメインだけに一致し、`example.com` 自体には一致しません。両方が必要な場合は別々に登録してください。社内ドメインも同じ仕様です。

送信ごとに ETag を使った条件付きリクエストを行い、2 秒でタイムアウトします。取得または検証に失敗した場合は、最後に有効だった設定、またはビルドに含まれる予備設定を使用し、最新ではない可能性を通知します。リリース時は `config/rules.json` と `src/fallback-rules.ts` を同期してください。

## ローカル開発

Node.js 20 LTS をインストールして実行します。

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run validate:manifest
npm run dev
```

開発サーバーは `https://localhost:3000` を使用します。ローカル HTTPS 証明書を信頼し、`manifest.xml` を Outlook にサイドロードしてください。

本番では、まず本番用 manifest を生成します。

```powershell
npm run manifest:production -- https://add-in.example.com
npm run validate:manifest:production
```

スクリプトは manifest 内のすべての `https://localhost:3000` を会社の HTTPS ホストに置き換え、`manifest.production.xml` を出力します。その後、Microsoft 365 管理センターから IT と社外送信の多い 5～10 名で1週間以上試行してから段階的に展開します。

## テレメトリと設計参考

本リリースはテレメトリを送信しません。将来のために no-op の `TelemetryClient` インターフェースだけを用意しています。

情報の優先順位と To／CC／BCC の分類は OutlookOkan を参考にしています。OutlookOkan は Apache 2.0 ライセンスの Windows VSTO/WPF Add-in です。本プロジェクトは Web Add-in のままであり、WPF/VSTO コード、署名鍵、`.vs`、`bin`、`obj` は取り込んでいません。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

import type { RecipientField, SupportedLocale } from "./types";

const messages = {
  "zh-TW": {
    header: (count: number) => `寄送前請確認（${count} 項）：`,
    noRecipient: "尚未填寫任何收件者。",
    tooManyRecipients: (actual: number, limit: number) => `收件者共 ${actual} 人，已達試行提醒值 ${limit} 人。`,
    duplicateRecipients: (values: string) => `收件者重複出現在不同欄位：${values}`,
    invalidEmail: (value: string) => `Email 格式疑似錯誤：${value}`,
    highRiskDomain: (value: string) => `高風險網域，請再次確認：${value}`,
    possibleTypo: (value: string, expected: string) => `${value} 的網域疑似誤植，是否應為 ${expected}？`,
    attachmentsTooLarge: (total: string, limit: string, regular: string, inline: string, names: string) =>
      `附件共 ${total} MB，超過試行提醒值 ${limit} MB（一般 ${regular} MB、inline ${inline} MB）${names ? `：${names}` : ""}`,
    externalIntro: (count: number) => `外部收件者 ${count} 位，請檢查後決定是否寄送：`,
    trusted: "已信任",
    untrusted: "需確認",
    moreRecipients: (count: number) => `另有 ${count} 位`,
    domains: (values: string) => `外部網域：${values}`,
    configStale: "遠端設定無法在 2 秒內完成驗證，目前使用備援設定；內容可能不是最新版。",
    unexpectedError: "寄送檢查目前無法完成。請檢查收件者後，再決定是否仍要寄送。",
    remaining: (count: number) => `另有 ${count} 項提醒，請返回郵件內容檢查。`,
    field: { to: "To", cc: "CC", bcc: "BCC" } as Record<RecipientField, string>
  },
  "ja-JP": {
    header: (count: number) => `送信前にご確認ください（${count}件）：`,
    noRecipient: "宛先が入力されていません。",
    tooManyRecipients: (actual: number, limit: number) => `宛先は ${actual} 件です。試行中の注意基準 ${limit} 件に達しています。`,
    duplicateRecipients: (values: string) => `同じ宛先が複数の欄にあります：${values}`,
    invalidEmail: (value: string) => `メールアドレスの形式をご確認ください：${value}`,
    highRiskDomain: (value: string) => `高リスクのドメインです。再確認してください：${value}`,
    possibleTypo: (value: string, expected: string) => `${value} のドメインは入力ミスの可能性があります。${expected} ではありませんか？`,
    attachmentsTooLarge: (total: string, limit: string, regular: string, inline: string, names: string) =>
      `添付ファイルは合計 ${total} MB です。試行中の注意基準 ${limit} MB を超えています（通常 ${regular} MB、インライン ${inline} MB）${names ? `：${names}` : ""}`,
    externalIntro: (count: number) => `社外宛先 ${count} 件を確認し、送信するか判断してください：`,
    trusted: "信頼済み",
    untrusted: "要確認",
    moreRecipients: (count: number) => `ほか ${count} 件`,
    domains: (values: string) => `社外ドメイン：${values}`,
    configStale: "リモート設定を2秒以内に検証できなかったため、予備設定を使用しています。最新ではない可能性があります。",
    unexpectedError: "送信チェックを完了できませんでした。宛先を確認し、送信を続けるか判断してください。",
    remaining: (count: number) => `ほか ${count} 件の注意があります。メール内容をご確認ください。`,
    field: { to: "To", cc: "CC", bcc: "BCC" } as Record<RecipientField, string>
  }
};

export type MessageCatalog = typeof messages["zh-TW"];

export function localeFromOffice(value?: string): SupportedLocale {
  return value?.toLowerCase().startsWith("ja") ? "ja-JP" : "zh-TW";
}

export function t(locale: SupportedLocale): MessageCatalog {
  return messages[locale] as MessageCatalog;
}

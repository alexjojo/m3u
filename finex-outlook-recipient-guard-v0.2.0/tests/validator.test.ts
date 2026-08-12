import { describe, expect, it } from "vitest";
import { validateRules } from "../src/rules";
import { domainMatches, formatViolations, validateMessage } from "../src/validator";
import type { MessageSnapshot, Rules } from "../src/types";

const rules: Rules = {
  $schemaVersion: 2,
  settings: {
    internalDomains: ["finex-tech.com.tw"],
    warnAtRecipientCount: 200,
    warnAboveTotalAttachmentBytes: 150 * 1024 * 1024,
    warnInvalidEmailFormat: true,
    warnDuplicateRecipients: true,
    typoDetection: { enabled: true, maxDomainEditDistance: 2 }
  },
  trustedExternalDomains: ["sk-el.co.jp"],
  highRiskDomains: []
};

const message = (count: number, bytes = 0): MessageSnapshot => ({
  subject: "測試",
  recipients: Array.from({ length: count }, (_, index) => ({
    displayName: "", emailAddress: `u${index}@finex-tech.com.tw`, field: "to"
  })),
  attachments: bytes ? [{ name: "data.bin", size: bytes, isInline: false }] : []
});

describe("寄送規則邊界", () => {
  it("199 位不提醒，200 位會提醒", () => {
    expect(validateMessage(message(199), rules).some((v) => v.code === "TOO_MANY_RECIPIENTS")).toBe(false);
    expect(validateMessage(message(200), rules).some((v) => v.code === "TOO_MANY_RECIPIENTS")).toBe(true);
  });

  it("附件剛好 150 MB 不提醒，多 1 byte 會提醒", () => {
    expect(validateMessage(message(1, 150 * 1024 * 1024), rules).some((v) => v.code === "ATTACHMENTS_TOO_LARGE")).toBe(false);
    expect(validateMessage(message(1, 150 * 1024 * 1024 + 1), rules).some((v) => v.code === "ATTACHMENTS_TOO_LARGE")).toBe(true);
  });

  it("inline 附件計入總容量並在訊息中分列", () => {
    const sample = message(1);
    sample.attachments = [{ name: "signature.png", size: 151 * 1024 * 1024, isInline: true }];
    const warning = validateMessage(sample, rules).find((v) => v.code === "ATTACHMENTS_TOO_LARGE");
    expect(warning?.message).toContain("inline 151.0 MB");
  });
});

describe("外部網域確認", () => {
  it("未信任外部網域需要確認", () => {
    const sample = message(1);
    sample.recipients[0].emailAddress = "customer@example.com";
    expect(validateMessage(sample, rules).some((v) => v.code === "EXTERNAL_CONFIRMATION")).toBe(true);
  });

  it("只有 sk-el.co.jp 時免除一般外寄確認", () => {
    const sample = message(1);
    sample.recipients[0].emailAddress = "contact@sk-el.co.jp";
    expect(validateMessage(sample, rules).some((v) => v.code === "EXTERNAL_CONFIRMATION")).toBe(false);
  });

  it("混合外寄時列出已信任與需確認的全部外部地址", () => {
    const sample = message(0);
    sample.recipients = [
      { displayName: "", emailAddress: "contact@sk-el.co.jp", field: "cc" },
      { displayName: "", emailAddress: "customer@example.com", field: "bcc" }
    ];
    const warning = validateMessage(sample, rules).find((v) => v.code === "EXTERNAL_CONFIRMATION");
    expect(warning?.message).toContain("CC contact@sk-el.co.jp [已信任]");
    expect(warning?.message).toContain("BCC customer@example.com [需確認]");
  });

  it("高風險網域產生獨立且高優先提醒", () => {
    const configured = structuredClone(rules);
    configured.highRiskDomains = ["risk.example"];
    const sample = message(1);
    sample.recipients[0].emailAddress = "person@risk.example";
    expect(validateMessage(sample, configured).some((v) => v.code === "HIGH_RISK_DOMAIN")).toBe(true);
  });
});

describe("網域與重複地址", () => {
  it("wildcard 只匹配子網域，不包含根網域", () => {
    expect(domainMatches("mail.example.com", "*.example.com")).toBe(true);
    expect(domainMatches("example.com", "*.example.com")).toBe(false);
    expect(domainMatches("badexample.com", "*.example.com")).toBe(false);
  });

  it("預設提醒跨欄位重複地址並列出欄位", () => {
    const sample = message(1);
    sample.recipients.push({ ...sample.recipients[0], field: "cc" });
    const warning = validateMessage(sample, rules).find((v) => v.code === "DUPLICATE_RECIPIENT");
    expect(warning?.message).toContain("TO/CC");
  });
});

describe("設定與顯示", () => {
  it("拒絕 schema v1", () => {
    expect(() => validateRules({ ...rules, $schemaVersion: 1 })).toThrow(/schema v2/);
  });

  it("拒絕舊版個人或群組地址欄位", () => {
    expect(() => validateRules({ ...rules, requiredRecipientRules: [] })).toThrow(/不支援欄位/);
  });

  it("拒絕信任與高風險網域衝突", () => {
    const configured = structuredClone(rules);
    configured.highRiskDomains = ["sk-el.co.jp"];
    expect(() => validateRules(configured)).toThrow(/衝突/);
  });

  it("日文訊息可用且確認框不超過 500 字元", () => {
    const sample = message(0);
    sample.recipients = Array.from({ length: 20 }, (_, index) => ({
      displayName: "", emailAddress: `customer-${index}@example-${index}.com`, field: "to"
    }));
    const output = formatViolations(validateMessage(sample, rules, "ja-JP"), "ja-JP");
    expect(output).toContain("送信前");
    expect(output.length).toBeLessThanOrEqual(500);
  });
});

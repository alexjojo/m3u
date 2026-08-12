export type RecipientField = "to" | "cc" | "bcc";
export type SupportedLocale = "zh-TW" | "ja-JP";

export interface Recipient {
  displayName: string;
  emailAddress: string;
  field: RecipientField;
}

export interface AttachmentInfo {
  name: string;
  size: number;
  isInline: boolean;
}

export interface MessageSnapshot {
  subject: string;
  recipients: Recipient[];
  attachments: AttachmentInfo[];
}

export interface Rules {
  $schemaVersion: 2;
  settings: {
    internalDomains: string[];
    warnAtRecipientCount: number;
    warnAboveTotalAttachmentBytes: number;
    warnInvalidEmailFormat: boolean;
    warnDuplicateRecipients: boolean;
    typoDetection: { enabled: boolean; maxDomainEditDistance: number };
  };
  trustedExternalDomains: string[];
  highRiskDomains: string[];
}

export interface Violation {
  code: string;
  message: string;
  priority: 0 | 1 | 2;
}

export interface LoadedRules {
  rules: Rules;
  stale: boolean;
  source: "remote" | "last-known" | "bundled";
}

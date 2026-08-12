import type { Rules } from "./types";

// Keep this synchronized with config/rules.json when producing a release.
export const FALLBACK_RULES: Rules = {
  $schemaVersion: 2,
  settings: {
    internalDomains: ["finex-tech.com.tw"],
    warnAtRecipientCount: 200,
    warnAboveTotalAttachmentBytes: 157286400,
    warnInvalidEmailFormat: true,
    warnDuplicateRecipients: true,
    typoDetection: { enabled: true, maxDomainEditDistance: 2 }
  },
  trustedExternalDomains: ["sk-el.co.jp"],
  highRiskDomains: []
};

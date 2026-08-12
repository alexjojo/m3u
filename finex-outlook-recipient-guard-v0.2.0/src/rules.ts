import { FALLBACK_RULES } from "./fallback-rules";
import { domainMatches } from "./validator";
import type { LoadedRules, Rules } from "./types";

const CONFIG_URL = "/config/rules.json";
const CONFIG_TIMEOUT_MS = 2000;
let lastKnownRules: Rules | undefined;
let lastKnownEtag: string | undefined;

function normalizedDomainRule(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function rejectUnknownKeys(name: string, value: object, allowedKeys: string[]): void {
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new Error(`${name} 含不支援欄位：${unknown.join("、")}`);
}

function validateDomainRules(name: string, values: unknown): asserts values is string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`${name} 必須是非空字串陣列`);
  }
  for (const raw of values) {
    const value = normalizedDomainRule(raw);
    const domain = value.startsWith("*.") ? value.slice(2) : value;
    if (domain.includes("*") || domain.includes("@") || !domain.includes(".")) throw new Error(`${name} 含無效網域：${raw}`);
  }
}

export function validateRules(candidate: unknown): asserts candidate is Rules {
  if (!candidate || typeof candidate !== "object") throw new Error("rules.json 必須是物件");
  const rules = candidate as Partial<Rules>;
  rejectUnknownKeys("rules.json", candidate, ["$schemaVersion", "settings", "trustedExternalDomains", "highRiskDomains"]);
  if (rules.$schemaVersion !== 2) throw new Error("只支援 rules.json schema v2");
  if (!rules.settings || typeof rules.settings !== "object") throw new Error("settings 不可省略");
  rejectUnknownKeys("settings", rules.settings, [
    "internalDomains", "warnAtRecipientCount", "warnAboveTotalAttachmentBytes",
    "warnInvalidEmailFormat", "warnDuplicateRecipients", "typoDetection"
  ]);
  const trustedExternalDomains = rules.trustedExternalDomains;
  const highRiskDomains = rules.highRiskDomains;
  validateDomainRules("internalDomains", rules.settings.internalDomains);
  validateDomainRules("trustedExternalDomains", trustedExternalDomains);
  validateDomainRules("highRiskDomains", highRiskDomains);
  if (!rules.settings.internalDomains.length) throw new Error("internalDomains 不可為空");
  if (!Number.isInteger(rules.settings.warnAtRecipientCount) || rules.settings.warnAtRecipientCount < 1) {
    throw new Error("warnAtRecipientCount 必須是正整數");
  }
  if (!Number.isFinite(rules.settings.warnAboveTotalAttachmentBytes) || rules.settings.warnAboveTotalAttachmentBytes < 0) {
    throw new Error("warnAboveTotalAttachmentBytes 不可為負數");
  }
  if (typeof rules.settings.warnInvalidEmailFormat !== "boolean" || typeof rules.settings.warnDuplicateRecipients !== "boolean") {
    throw new Error("提醒開關必須是布林值");
  }
  const typo = rules.settings.typoDetection;
  if (!typo || typeof typo.enabled !== "boolean" || !Number.isInteger(typo.maxDomainEditDistance) || typo.maxDomainEditDistance < 0) {
    throw new Error("typoDetection 設定無效");
  }
  rejectUnknownKeys("typoDetection", typo, ["enabled", "maxDomainEditDistance"]);
  const conflicts = trustedExternalDomains.filter((trusted) =>
    highRiskDomains.some((risk) => domainMatches(normalizedDomainRule(trusted), normalizedDomainRule(risk))
      || domainMatches(normalizedDomainRule(risk), normalizedDomainRule(trusted))));
  if (conflicts.length) throw new Error(`信任與高風險網域衝突：${conflicts.join("、")}`);
}

async function fetchRemoteRules(): Promise<Rules> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const headers = lastKnownEtag ? { "If-None-Match": lastKnownEtag } : undefined;
    const response = await fetch(CONFIG_URL, { cache: "no-store", headers, signal: controller.signal });
    if (response.status === 304 && lastKnownRules) return lastKnownRules;
    if (!response.ok) throw new Error(`rules.json HTTP ${response.status}`);
    const candidate: unknown = await response.json();
    validateRules(candidate);
    lastKnownRules = candidate;
    lastKnownEtag = response.headers.get("ETag") ?? undefined;
    return candidate;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRules(): Promise<LoadedRules> {
  try {
    return { rules: await fetchRemoteRules(), stale: false, source: "remote" };
  } catch (error) {
    console.warn("Recipient Guard is using backup rules", error);
    if (lastKnownRules) return { rules: lastKnownRules, stale: true, source: "last-known" };
    validateRules(FALLBACK_RULES);
    return { rules: FALLBACK_RULES, stale: true, source: "bundled" };
  }
}

import { t } from "./i18n";
import type { MessageSnapshot, Recipient, Rules, SupportedLocale, Violation } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = (value: string) => value.trim().toLowerCase().replace(/\.$/, "");
const domainOf = (email: string) => {
  const parts = normalize(email).split("@");
  return parts.length === 2 ? parts[1] : "";
};

export function domainMatches(domain: string, rule: string): boolean {
  const candidate = normalize(domain);
  const pattern = normalize(rule);
  if (!pattern.startsWith("*.")) return candidate === pattern;
  const suffix = pattern.slice(2);
  return candidate.length > suffix.length && candidate.endsWith(`.${suffix}`);
}

function matchesAnyDomain(domain: string, rules: string[]): boolean {
  return rules.some((rule) => domainMatches(domain, rule));
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function closestInternalDomain(domain: string, rules: Rules): string | undefined {
  return rules.settings.internalDomains
    .filter((candidate) => !candidate.startsWith("*."))
    .find((candidate) => editDistance(domain, normalize(candidate)) <= rules.settings.typoDetection.maxDomainEditDistance);
}

function duplicateSummary(recipients: Recipient[]): string {
  const groups = new Map<string, Set<string>>();
  for (const recipient of recipients) {
    const email = normalize(recipient.emailAddress);
    const fields = groups.get(email) ?? new Set<string>();
    fields.add(recipient.field.toUpperCase());
    groups.set(email, fields);
  }
  return [...groups.entries()]
    .filter(([, fields]) => fields.size > 1)
    .map(([email, fields]) => `${email} (${[...fields].join("/")})`)
    .join("、");
}

function externalConfirmation(message: MessageSnapshot, rules: Rules, locale: SupportedLocale): Violation | undefined {
  const catalog = t(locale);
  const external = message.recipients.filter((recipient) => {
    const domain = domainOf(recipient.emailAddress);
    return domain && !matchesAnyDomain(domain, rules.settings.internalDomains);
  });
  const needsConfirmation = external.some((recipient) => !matchesAnyDomain(domainOf(recipient.emailAddress), rules.trustedExternalDomains));
  if (!needsConfirmation) return undefined;

  const summaries = external.slice(0, 10).map((recipient) => {
    const trusted = matchesAnyDomain(domainOf(recipient.emailAddress), rules.trustedExternalDomains);
    return `${catalog.field[recipient.field]} ${normalize(recipient.emailAddress)} [${trusted ? catalog.trusted : catalog.untrusted}]`;
  });
  const domains = [...new Set(external.map((recipient) => domainOf(recipient.emailAddress)))];
  const clip = (value: string, max: number) => value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  const lines = [catalog.externalIntro(external.length)];
  for (const summary of summaries) {
    if ([...lines, summary].join("\n").length > 300) break;
    lines.push(summary);
  }
  const shown = lines.length - 1;
  if (external.length > shown) lines.push(catalog.moreRecipients(external.length - shown));
  lines.push(clip(catalog.domains(domains.join("、")), 110));
  return { code: "EXTERNAL_CONFIRMATION", priority: 2, message: lines.join("\n") };
}

export function validateMessage(message: MessageSnapshot, rules: Rules, locale: SupportedLocale = "zh-TW"): Violation[] {
  const catalog = t(locale);
  const violations: Violation[] = [];

  if (message.recipients.length === 0) violations.push({ code: "NO_RECIPIENT", priority: 0, message: catalog.noRecipient });
  if (message.recipients.length >= rules.settings.warnAtRecipientCount) {
    violations.push({
      code: "TOO_MANY_RECIPIENTS", priority: 1,
      message: catalog.tooManyRecipients(message.recipients.length, rules.settings.warnAtRecipientCount)
    });
  }

  if (rules.settings.warnDuplicateRecipients) {
    const summary = duplicateSummary(message.recipients);
    if (summary) violations.push({ code: "DUPLICATE_RECIPIENT", priority: 1, message: catalog.duplicateRecipients(summary) });
  }

  const reportedHighRiskDomains = new Set<string>();
  for (const recipient of message.recipients) {
    const email = normalize(recipient.emailAddress);
    const domain = domainOf(email);
    if (rules.settings.warnInvalidEmailFormat && !EMAIL_PATTERN.test(email)) {
      violations.push({ code: "INVALID_EMAIL", priority: 0, message: catalog.invalidEmail(recipient.emailAddress) });
      continue;
    }
    if (matchesAnyDomain(domain, rules.highRiskDomains) && !reportedHighRiskDomains.has(domain)) {
      violations.push({ code: "HIGH_RISK_DOMAIN", priority: 0, message: catalog.highRiskDomain(domain) });
      reportedHighRiskDomains.add(domain);
    }
    if (rules.settings.typoDetection.enabled && !matchesAnyDomain(domain, rules.settings.internalDomains)) {
      const similar = closestInternalDomain(domain, rules);
      if (similar) violations.push({ code: "POSSIBLE_DOMAIN_TYPO", priority: 0, message: catalog.possibleTypo(email, similar) });
    }
  }

  const regularBytes = message.attachments.filter((item) => !item.isInline).reduce((sum, item) => sum + Math.max(0, item.size || 0), 0);
  const inlineBytes = message.attachments.filter((item) => item.isInline).reduce((sum, item) => sum + Math.max(0, item.size || 0), 0);
  const totalBytes = regularBytes + inlineBytes;
  if (totalBytes > rules.settings.warnAboveTotalAttachmentBytes) {
    const mb = (value: number, digits = 1) => (value / 1024 / 1024).toFixed(digits);
    const regularAttachments = message.attachments.filter((item) => !item.isInline);
    const names = regularAttachments.map((item) => item.name).slice(0, 3).join("、");
    violations.push({
      code: "ATTACHMENTS_TOO_LARGE", priority: 1,
      message: catalog.attachmentsTooLarge(
        mb(totalBytes), mb(rules.settings.warnAboveTotalAttachmentBytes, 0), mb(regularBytes), mb(inlineBytes),
        `${names}${regularAttachments.length > 3 ? "…" : ""}`
      )
    });
  }

  const external = externalConfirmation(message, rules, locale);
  if (external) violations.push(external);
  return violations.sort((a, b) => a.priority - b.priority);
}

export function configurationWarning(locale: SupportedLocale): Violation {
  return { code: "CONFIGURATION_STALE", priority: 1, message: t(locale).configStale };
}

export function formatViolations(violations: Violation[], locale: SupportedLocale = "zh-TW"): string {
  const catalog = t(locale);
  const sorted = [...violations].sort((a, b) => a.priority - b.priority);
  const header = catalog.header(sorted.length);
  const parts: string[] = [];
  let omitted = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const candidate = `• ${sorted[index].message}`;
    const suffix = index < sorted.length - 1 ? `\n• ${catalog.remaining(sorted.length - index - 1)}` : "";
    if (`${header}\n${[...parts, candidate].join("\n")}${suffix}`.length <= 500) parts.push(candidate);
    else { omitted = sorted.length - index; break; }
  }
  if (omitted > 0) {
    const remainingLine = `• ${catalog.remaining(omitted)}`;
    while (parts.length && `${header}\n${[...parts, remainingLine].join("\n")}`.length > 500) parts.pop();
    parts.push(remainingLine);
  }
  return `${header}\n${parts.join("\n")}`.slice(0, 500);
}

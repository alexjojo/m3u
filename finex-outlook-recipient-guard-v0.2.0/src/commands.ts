import { localeFromOffice, t } from "./i18n";
import { readMessage } from "./outlook";
import { loadRules } from "./rules";
import { telemetry } from "./telemetry";
import { configurationWarning, domainMatches, formatViolations, validateMessage } from "./validator";

async function onMessageSend(event: Office.MailboxEvent): Promise<void> {
  const locale = localeFromOffice(Office.context.displayLanguage);
  try {
    const [loaded, message] = await Promise.all([loadRules(), readMessage()]);
    const violations = validateMessage(message, loaded.rules, locale);
    if (loaded.stale) violations.push(configurationWarning(locale));
    const externalDomains = new Set(message.recipients
      .map((item) => item.emailAddress.split("@").pop()?.toLowerCase() ?? "")
      .filter((domain) => domain && !loaded.rules.settings.internalDomains.some((rule) => domainMatches(domain, rule))));
    void telemetry.trackCheck({
      ruleCodes: violations.map((item) => item.code),
      recipientCount: message.recipients.length,
      externalDomainCount: externalDomains.size,
      configurationSource: loaded.source
    });
    event.completed(violations.length
      ? { allowEvent: false, errorMessage: formatViolations(violations, locale) }
      : { allowEvent: true });
  } catch (error) {
    console.error("Recipient Guard failed", error);
    event.completed({ allowEvent: false, errorMessage: t(locale).unexpectedError });
  }
}

Office.actions.associate("onMessageSend", onMessageSend);

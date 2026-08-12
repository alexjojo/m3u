export interface TelemetryEvent {
  ruleCodes: string[];
  recipientCount: number;
  externalDomainCount: number;
  configurationSource: "remote" | "last-known" | "bundled";
}

export interface TelemetryClient {
  trackCheck(event: TelemetryEvent): void | Promise<void>;
}

// Reserved extension point. This release intentionally sends no telemetry.
export const telemetry: TelemetryClient = { trackCheck: () => undefined };

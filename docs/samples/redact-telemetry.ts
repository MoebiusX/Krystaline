/**
 * Redact directly-identifying values before they are written to a span
 * attribute (or any telemetry sink). Identifiers such as crypto destination
 * addresses, emails, or account handles are PII and must not reach a trace
 * backend — especially one that any public/read-only tooling can query. Keep a
 * short head/tail for debuggability; fully mask anything too short to redact
 * meaningfully.
 *
 * Apply this at the boundary where client telemetry leaves the authenticated
 * context, e.g. before setAttribute('...'). Do not rely on display-side
 * formatters for this — display formatting and telemetry redaction have
 * different threat models.
 */
export function redactForTelemetry(value: string | null | undefined): string {
    if (!value) return '';
    const s = String(value);
    if (s.length <= 12) return '[redacted]';
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

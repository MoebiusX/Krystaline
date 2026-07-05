/**
 * Trace ID Utilities
 * 
 * Handles conversion between internal trace ID format (UUID with hyphens)
 * and Jaeger-compatible format (32 hex characters without hyphens)
 */

/**
 * Format a trace ID for use with Jaeger UI
 * Jaeger expects 32 hex characters (no hyphens)
 * Our internal format may include hyphens (UUID format: 8-4-4-4-12)
 */
export function formatTraceIdForJaeger(traceId: string): string {
    if (!traceId) return '';
    // Remove all hyphens to get 32 hex characters
    return traceId.replace(/-/g, '');
}

/**
 * Get Jaeger trace URL for a given trace ID
 */
export function getJaegerTraceUrl(traceId: string): string {
    const jaegerUrl = import.meta.env.VITE_JAEGER_URL || 'http://localhost:16686';
    const formattedId = formatTraceIdForJaeger(traceId);
    return `${jaegerUrl}/trace/${formattedId}`;
}

/**
 * Check if a trace ID is valid for Jaeger (32 hex characters)
 */
export function isValidJaegerTraceId(traceId: string): boolean {
    const formatted = formatTraceIdForJaeger(traceId);
    return /^[0-9a-f]{32}$/i.test(formatted);
}

/**
 * Redact a directly-identifying value (e.g. a wallet address) before it is
 * written to a span attribute. Span attributes are exported to the trace
 * backend, so a full identifier there is effectively published. Keep a short
 * head/tail for debuggability; fully mask anything too short to redact
 * meaningfully.
 */
export function redactAddressForTelemetry(address: string | null | undefined): string {
    if (!address) return '';
    const a = String(address);
    if (a.length <= 12) return '[redacted]';
    return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

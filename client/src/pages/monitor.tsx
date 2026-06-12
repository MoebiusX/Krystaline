/**
 * Mission Control — Krystaline's real-time observability surface.
 *
 * Reads the same live feeds the MCP server exposes to Tomograph:
 * span baselines, σ-scored anomalies, SLO error budgets, the Jaeger
 * service topology, and Bayesian root-cause inference.
 *
 * CRITICAL: Every number on this page is derived from live traces and
 * metrics. No mock/fake/placeholder data is ever shown — when a feed is
 * unreachable we say so. Honest empty states over fake green.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createLogger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Layout from "@/components/Layout";
import { getJaegerTraceUrl } from "@/lib/trace-utils";
import { BaselineStatusBadge, type BaselineStatusIndicator } from "@/components/ui/baseline-status-badge";
import { DeviationMiniChart } from "@/components/ui/deviation-mini-chart";
import {
    Activity,
    AlertTriangle,
    Brain,
    Crosshair,
    ExternalLink,
    Gauge,
    Network,
    RefreshCw,
    Timer,
    Waves,
} from "lucide-react";

const log = createLogger('Monitor');

// ─── Severity configuration (SEV 1-5) ───────────────────────────────────────

const SEVERITY_CONFIG = {
    1: { name: 'Critical', color: 'bg-red-600', textColor: 'text-red-400', badge: 'SEV1' },
    2: { name: 'Major', color: 'bg-orange-600', textColor: 'text-orange-400', badge: 'SEV2' },
    3: { name: 'Moderate', color: 'bg-amber-600', textColor: 'text-amber-400', badge: 'SEV3' },
    4: { name: 'Minor', color: 'bg-yellow-600', textColor: 'text-yellow-400', badge: 'SEV4' },
    5: { name: 'Low', color: 'bg-lime-600', textColor: 'text-lime-400', badge: 'SEV5' },
} as const;

type SeverityLevel = 1 | 2 | 3 | 4 | 5;

// ─── Feed types ──────────────────────────────────────────────────────────────

interface WSMessage {
    type: 'analysis-start' | 'analysis-chunk' | 'analysis-complete' | 'alert' | 'heartbeat';
    data?: any;
    anomalyIds?: string[];
    timestamp?: string;
}

interface LiveAlert {
    severity: 'critical' | 'high' | 'medium';
    message: string;
    timestamp: string;
}

interface ServiceHealth {
    name: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    avgDuration: number;
    spanCount: number;
    activeAnomalies: number;
    lastSeen: string;
}

interface SpanBaseline {
    service: string;
    operation: string;
    spanKey: string;
    mean: number;
    stdDev: number;
    p50: number;
    p95: number;
    p99: number;
    sampleCount: number;
    lastUpdated: string;
    statusIndicator?: BaselineStatusIndicator;
}

interface Anomaly {
    id: string;
    traceId: string;
    service: string;
    operation: string;
    duration: number;
    expectedMean: number;
    expectedStdDev: number;
    deviation: number;
    severity: SeverityLevel;
    severityName: string;
    timestamp: string;
    dayOfWeek?: number;
    hourOfDay?: number;
}

interface AnalysisResponse {
    traceId: string;
    summary: string;
    possibleCauses: string[];
    recommendations: string[];
    confidence: 'low' | 'medium' | 'high';
    prompt?: string;        // Exact prompt sent to LLM (for training)
    rawResponse?: string;   // Raw LLM response (for training)
}

interface RecalculateResponse {
    success: boolean;
    baselinesCount: number;
    duration: number;
    message: string;
}

interface CorrelatedMetrics {
    anomalyId: string;
    timestamp: string;
    service: string;
    metrics: {
        cpuPercent: number | null;
        memoryMB: number | null;
        requestRate: number | null;
        errorRate: number | null;
        p99LatencyMs: number | null;
        activeConnections: number | null;
    };
    insights: string[];
    healthy: boolean;
}

interface AmountAnomaly {
    id: string;
    orderId?: string;
    transferId?: string;
    traceId?: string;
    userId: string;
    operationType: string;
    asset: string;
    amount: number;
    dollarValue: number;
    expectedMean: number;
    expectedStdDev: number;
    deviation: number;
    severity: SeverityLevel;
    severityName: string;
    timestamp: string;
    reason: string;
}

interface SloResponse {
    availability: {
        target: number;
        current: number | null;
        burnRate1h: number | null;
        burnRate6h: number | null;
        budgetRemaining: number | null;
        budgetMinutesRemaining: number | null;
    };
    latency: {
        target: number;
        targetMs: number;
        currentRatioBelow500ms: number | null;
        p95Ms: number | null;
        p99Ms: number | null;
        budgetRemaining: number | null;
    };
    timestamp: string;
}

interface HourlyTrendBucket {
    hour: string;
    count: number;
    critical: number;
}

interface HistoryResponse {
    anomalies: unknown[];
    hourlyTrend: HourlyTrendBucket[];
    totalCount: number;
}

interface ServiceEdge {
    parent: string;
    child: string;
    callCount: number;
}

interface TopologyResponse {
    nodes: string[];
    edges: ServiceEdge[];
    updatedAt: string;
}

interface RootCause {
    service: string;
    probability: number;
    evidence: string;
}

interface BayesianInsight {
    service: string;
    latency_anomaly_probability: number;
    error_anomaly_probability: number;
    likely_root_causes: RootCause[];
    confidence: number;
    timestamp: string;
}

interface BayesianInsightsResponse {
    insights: BayesianInsight[];
    count: number;
    timestamp: string;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString();

const timeAgo = (timestamp: string | Date, now: number) => {
    const seconds = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
};

/** Render a ratio (0-1) as a percentage, honest about missing data. */
const fmtPct = (x: number | null | undefined, digits = 2) =>
    x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`;

const fmtMs = (x: number | null | undefined, digits = 0) =>
    x === null || x === undefined ? '—' : `${x.toFixed(digits)}ms`;

const STATUS_HEX: Record<string, string> = {
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    unknown: '#64748b',
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'healthy': return { label: 'HEALTHY', className: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' };
        case 'warning': return { label: 'WARNING', className: 'bg-amber-600/20 text-amber-400 border-amber-500/30' };
        case 'critical': return { label: 'CRITICAL', className: 'bg-red-600/20 text-red-400 border-red-500/30' };
        default: return { label: 'UNKNOWN', className: 'bg-slate-600/20 text-slate-400 border-slate-500/30' };
    }
};

const getSeverityBadge = (severity: SeverityLevel) => {
    const config = SEVERITY_CONFIG[severity];
    return {
        className: `${config.color} text-white font-bold`,
        label: config.badge,
        name: config.name,
    };
};

// ─── Shared shell pieces ─────────────────────────────────────────────────────

const PANEL = 'rounded-2xl border border-cyan-500/15 bg-slate-900/60 backdrop-blur-xl shadow-xl';
const MICRO = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/60';

function SectionHeader({ icon: Icon, kicker, title, aside }: {
    icon: typeof Activity;
    kicker: string;
    title: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <Icon className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                    <div className={MICRO}>{kicker}</div>
                    <div className="text-cyan-50 text-lg font-semibold leading-tight">{title}</div>
                </div>
            </div>
            {aside && <div className="flex items-center gap-2 shrink-0">{aside}</div>}
        </div>
    );
}

// ─── SLO vitals strip ────────────────────────────────────────────────────────

function BudgetBar({ remaining }: { remaining: number | null }) {
    if (remaining === null) {
        return <div className="h-1.5 rounded-full bg-slate-800" title="No data" />;
    }
    const pct = Math.max(0, Math.min(100, remaining * 100));
    const tone = pct > 50 ? 'from-emerald-500 to-cyan-500' : pct > 20 ? 'from-amber-500 to-yellow-500' : 'from-red-600 to-orange-500';
    return (
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
                className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all duration-700`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

function burnTone(burn: number | null): string {
    if (burn === null) return 'text-slate-500';
    if (burn >= 2) return 'text-red-400';
    if (burn >= 1) return 'text-amber-400';
    return 'text-emerald-400';
}

function VitalsStrip({ slo, anomalies, services }: {
    slo: SloResponse | undefined;
    anomalies: Anomaly[] | undefined;
    services: ServiceHealth[] | undefined;
}) {
    const av = slo?.availability;
    const lat = slo?.latency;
    const sloOffline = slo !== undefined && av?.current === null && lat?.p95Ms === null;

    const sevCounts = useMemo(() => {
        const counts = { high: 0, mid: 0, low: 0 };
        for (const a of anomalies ?? []) {
            if (a.severity <= 2) counts.high++;
            else if (a.severity === 3) counts.mid++;
            else counts.low++;
        }
        return counts;
    }, [anomalies]);

    const healthyCount = services?.filter(s => s.status === 'healthy').length ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Availability SLO */}
            <div className={`${PANEL} p-5`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={MICRO}>Availability SLO</span>
                    <Gauge className="h-4 w-4 text-cyan-400/50" />
                </div>
                <div className="text-3xl font-bold font-mono text-cyan-50">
                    {fmtPct(av?.current ?? null, 3)}
                </div>
                <p className="text-xs text-cyan-100/50 mt-1 leading-relaxed">
                    Successful requests over the last hour, against a {av ? (av.target * 100).toFixed(1) : '99.9'}% target.
                </p>
                <div className="mt-3 space-y-1.5">
                    <BudgetBar remaining={av?.budgetRemaining ?? null} />
                    <div className="flex justify-between text-xs">
                        {av?.budgetRemaining != null && av.budgetRemaining < 0 ? (
                            <span className="text-red-400" title="More errors in the 30-day window than the SLO allows — the budget is overspent.">
                                error budget exhausted (30d window)
                            </span>
                        ) : (
                            <span className="text-cyan-100/50">
                                error budget {fmtPct(av?.budgetRemaining ?? null, 0)} left
                                {av?.budgetMinutesRemaining != null && av.budgetMinutesRemaining > 0 && ` (~${Math.round(av.budgetMinutesRemaining)}min)`}
                            </span>
                        )}
                        <span className={burnTone(av?.burnRate1h ?? null)} title="How fast errors consume the budget: ×1 = exactly sustainable, above ×1 the budget is shrinking.">
                            burn ×{av?.burnRate1h != null ? av.burnRate1h.toFixed(2) : '—'}
                        </span>
                    </div>
                </div>
                {sloOffline && (
                    <p className="text-xs text-amber-400/80 mt-2">Prometheus SLO recording rules unreachable — showing no data rather than a fake green.</p>
                )}
            </div>

            {/* Latency SLO */}
            <div className={`${PANEL} p-5`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={MICRO}>Latency SLO</span>
                    <Timer className="h-4 w-4 text-cyan-400/50" />
                </div>
                <div className="text-3xl font-bold font-mono text-cyan-50">
                    {fmtMs(lat?.p95Ms)}
                    <span className="text-base text-cyan-100/40 font-normal ml-1.5">p95</span>
                </div>
                <p className="text-xs text-cyan-100/50 mt-1 leading-relaxed">
                    5-minute p95 from Prometheus histograms; p99 {fmtMs(lat?.p99Ms)}. Target: {lat ? (lat.target * 100).toFixed(0) : '95'}% of requests under {lat?.targetMs ?? 500}ms.
                </p>
                <div className="mt-3 space-y-1.5">
                    <BudgetBar remaining={lat?.budgetRemaining ?? null} />
                    <div className="flex justify-between text-xs">
                        {lat?.budgetRemaining != null && lat.budgetRemaining < 0 ? (
                            <span className="text-red-400" title="More slow requests in the window than the SLO allows — the budget is overspent.">
                                latency budget exhausted
                            </span>
                        ) : (
                            <span className="text-cyan-100/50">latency budget {fmtPct(lat?.budgetRemaining ?? null, 0)} left</span>
                        )}
                        <span className="text-cyan-100/50">{fmtPct(lat?.currentRatioBelow500ms ?? null, 1)} under {lat?.targetMs ?? 500}ms</span>
                    </div>
                </div>
            </div>

            {/* Active anomalies */}
            <div className={`${PANEL} p-5`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={MICRO}>Active Anomalies</span>
                    <Crosshair className="h-4 w-4 text-cyan-400/50" />
                </div>
                <div className={`text-3xl font-bold font-mono ${anomalies === undefined ? 'text-slate-500' : anomalies.length === 0 ? 'text-emerald-400' : sevCounts.high > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {anomalies === undefined ? '—' : anomalies.length}
                </div>
                <p className="text-xs text-cyan-100/50 mt-1 leading-relaxed">
                    Spans deviating from their learned baseline, σ-scored into SEV1-5.
                </p>
                <div className="flex gap-2 mt-3 text-xs font-mono">
                    <span className={`px-2 py-0.5 rounded-md border ${sevCounts.high > 0 ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-slate-700 text-slate-500'}`}>
                        {sevCounts.high} SEV1-2
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border ${sevCounts.mid > 0 ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-500'}`}>
                        {sevCounts.mid} SEV3
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border ${sevCounts.low > 0 ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' : 'border-slate-700 text-slate-500'}`}>
                        {sevCounts.low} SEV4-5
                    </span>
                </div>
            </div>

            {/* Services reporting */}
            <div className={`${PANEL} p-5`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={MICRO}>Services Reporting</span>
                    <Network className="h-4 w-4 text-cyan-400/50" />
                </div>
                <div className="text-3xl font-bold font-mono text-cyan-50">
                    {services === undefined ? '—' : (
                        <>
                            <span className={healthyCount === services.length && services.length > 0 ? 'text-emerald-400' : ''}>{healthyCount}</span>
                            <span className="text-cyan-100/40">/{services.length}</span>
                        </>
                    )}
                </div>
                <p className="text-xs text-cyan-100/50 mt-1 leading-relaxed">
                    Services emitting OpenTelemetry spans in the current window, judged healthy by their own baselines.
                </p>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                    {(services ?? []).map(s => (
                        <span
                            key={s.name}
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: STATUS_HEX[s.status] ?? STATUS_HEX.unknown }}
                            title={`${s.name}: ${s.status}`}
                        />
                    ))}
                    {services !== undefined && services.length === 0 && (
                        <span className="text-xs text-slate-500">No spans observed yet</span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Anomaly pulse (24h trend) ───────────────────────────────────────────────

function AnomalyPulse({ trend }: { trend: HourlyTrendBucket[] | undefined }) {
    const total = trend?.reduce((s, b) => s + b.count, 0) ?? 0;
    const criticals = trend?.reduce((s, b) => s + b.critical, 0) ?? 0;
    const max = Math.max(1, ...(trend ?? []).map(b => b.count));

    return (
        <div className={`${PANEL} flex flex-col`}>
            <SectionHeader
                icon={Waves}
                kicker="Last 24 hours"
                title="Anomaly Pulse"
                aside={
                    <div className="text-right text-xs text-cyan-100/50">
                        <div><span className="font-mono text-cyan-50 text-sm">{trend ? total : '—'}</span> detected</div>
                        <div><span className={`font-mono text-sm ${criticals > 0 ? 'text-red-400' : 'text-cyan-50'}`}>{trend ? criticals : '—'}</span> critical (SEV1-2)</div>
                    </div>
                }
            />
            <div className="px-5 pb-5 flex-1 flex flex-col justify-end">
                {trend === undefined ? (
                    <div className="text-slate-500 text-sm text-center py-8">Loading anomaly history…</div>
                ) : (
                    <>
                        <div className="flex items-end gap-1 h-28">
                            {trend.map((b, i) => {
                                const hPct = (b.count / max) * 100;
                                const critPct = b.count > 0 ? (b.critical / b.count) * hPct : 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 flex flex-col justify-end h-full group cursor-default"
                                        title={`${b.hour} UTC — ${b.count} anomalies (${b.critical} critical)`}
                                    >
                                        <div
                                            className="w-full rounded-t-sm bg-red-500/80 transition-all duration-500"
                                            style={{ height: `${critPct}%` }}
                                        />
                                        <div
                                            className="w-full rounded-t-sm bg-cyan-500/50 group-hover:bg-cyan-400/70 transition-all duration-500"
                                            style={{ height: `${Math.max(b.count > 0 ? 3 : 0, hPct - critPct)}%` }}
                                        />
                                        <div className="w-full h-px bg-cyan-500/20" />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-cyan-100/40 mt-2">
                            {trend.filter((_, i) => i % 6 === 0).map((b, i) => <span key={i}>{b.hour}</span>)}
                            <span>now</span>
                        </div>
                        {total === 0 && (
                            <p className="text-xs text-cyan-100/40 mt-3 text-center">
                                Quiet — no baseline deviations recorded in the last 24h. The detector is live; this is a real zero.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Live AI console (WebSocket) ─────────────────────────────────────────────

function LiveConsole({ wsConnected, isStreaming, streamingText, streamingAnomalyIds, liveAlerts, lastUpdated }: {
    wsConnected: boolean;
    isStreaming: boolean;
    streamingText: string;
    streamingAnomalyIds: string[];
    liveAlerts: LiveAlert[];
    lastUpdated: Date | null;
}) {
    const consoleRef = useRef<HTMLDivElement>(null);

    // Keep the console scrolled to the newest output while streaming
    useEffect(() => {
        if (isStreaming && consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [streamingText, isStreaming]);

    return (
        <div className={`${PANEL} flex flex-col`}>
            <SectionHeader
                icon={Brain}
                kicker="Streaming over WebSocket"
                title={
                    <span className="flex items-center gap-2.5">
                        Live AI Analysis
                        <span className="relative flex h-2.5 w-2.5">
                            {wsConnected && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />
                        </span>
                    </span>
                }
                aside={
                    <Badge className={`border ${wsConnected ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30'}`}>
                        {wsConnected ? 'LINK UP' : 'LINK DOWN'}
                    </Badge>
                }
            />
            <div className="px-5 pb-5 flex-1 flex flex-col gap-3">
                {liveAlerts.length > 0 && (
                    <div className="space-y-1.5">
                        {liveAlerts.map((alert, i) => (
                            <div
                                key={i}
                                className={`px-3 py-2 rounded-lg border text-sm flex items-baseline gap-2 ${alert.severity === 'critical'
                                    ? 'bg-red-950/40 border-red-700/50 text-red-200'
                                    : alert.severity === 'high'
                                        ? 'bg-orange-950/40 border-orange-700/50 text-orange-200'
                                        : 'bg-amber-950/40 border-amber-700/50 text-amber-200'
                                    }`}
                            >
                                <span className="font-mono text-[10px] uppercase opacity-70 shrink-0">{alert.severity}</span>
                                <span className="flex-1">{alert.message}</span>
                                <span className="text-[10px] font-mono opacity-50 shrink-0">{formatTime(alert.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div
                    ref={consoleRef}
                    className="flex-1 bg-slate-950/70 rounded-xl p-4 border border-cyan-500/15 font-mono text-[13px] leading-relaxed text-cyan-300/90 whitespace-pre-wrap overflow-y-auto min-h-[120px] max-h-[280px]"
                >
                    {(streamingText || isStreaming) ? (
                        <>
                            {streamingText || 'Enriching trace context…'}
                            {isStreaming && <span className="animate-pulse text-cyan-300">▋</span>}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-6">
                            <span className="text-cyan-400/70">Watching for SEV1-3 anomalies</span>
                            <span className="text-cyan-100/30 text-xs mt-1.5 font-sans">
                                When the detector fires, the LLM's reasoning streams here token by token — the same analysis Tomograph reads over MCP.
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between text-[11px] text-cyan-100/40 font-mono">
                    <span>
                        {streamingAnomalyIds.length > 0
                            ? `analyzing ${streamingAnomalyIds.slice(0, 2).map(id => id.slice(0, 8)).join(', ')}${streamingAnomalyIds.length > 2 ? ` +${streamingAnomalyIds.length - 2}` : ''}`
                            : 'idle'}
                    </span>
                    {lastUpdated && <span>last analysis {lastUpdated.toLocaleTimeString()}</span>}
                </div>
            </div>
        </div>
    );
}

// ─── Service topology map ────────────────────────────────────────────────────

interface NodeLayout {
    name: string;
    x: number;
    y: number;
    width: number;
}

const TOPO = { colGap: 190, rowGap: 58, nodeH: 30, padX: 24, padY: 28 };

function layoutTopology(graph: TopologyResponse): { nodes: NodeLayout[]; width: number; height: number } {
    const layerOf = new Map<string, number>();
    const incoming = new Map<string, number>(graph.nodes.map(n => [n, 0]));
    for (const e of graph.edges) {
        incoming.set(e.child, (incoming.get(e.child) ?? 0) + 1);
    }

    // Longest-path layering from the roots; bounded passes guard against cycles.
    const roots = graph.nodes.filter(n => (incoming.get(n) ?? 0) === 0);
    (roots.length > 0 ? roots : graph.nodes.slice(0, 1)).forEach(n => layerOf.set(n, 0));
    for (let pass = 0; pass < graph.nodes.length; pass++) {
        let changed = false;
        for (const e of graph.edges) {
            const p = layerOf.get(e.parent);
            if (p === undefined) continue;
            if ((layerOf.get(e.child) ?? -1) < p + 1) {
                layerOf.set(e.child, p + 1);
                changed = true;
            }
        }
        if (!changed) break;
    }
    graph.nodes.forEach(n => { if (!layerOf.has(n)) layerOf.set(n, 0); });

    const layers = new Map<number, string[]>();
    for (const n of graph.nodes) {
        const l = layerOf.get(n)!;
        if (!layers.has(l)) layers.set(l, []);
        layers.get(l)!.push(n);
    }

    const maxRows = Math.max(...Array.from(layers.values()).map(l => l.length));
    const height = TOPO.padY * 2 + (maxRows - 1) * TOPO.rowGap + TOPO.nodeH;
    const maxLayer = Math.max(...Array.from(layers.keys()));

    const nodes: NodeLayout[] = [];
    for (const [layer, names] of Array.from(layers.entries())) {
        names.sort();
        const blockH = (names.length - 1) * TOPO.rowGap + TOPO.nodeH;
        const startY = (height - blockH) / 2;
        names.forEach((name, i) => {
            nodes.push({
                name,
                x: TOPO.padX + layer * TOPO.colGap,
                y: startY + i * TOPO.rowGap,
                width: Math.min(150, Math.max(76, name.length * 7.2 + 22)),
            });
        });
    }

    const width = TOPO.padX * 2 + maxLayer * TOPO.colGap + Math.max(...nodes.map(n => n.width));
    return { nodes, width, height };
}

function TopologyMap({ graph, statusByService }: {
    graph: TopologyResponse | undefined;
    statusByService: Map<string, string>;
}) {
    const layout = useMemo(() => graph && graph.nodes.length > 0 ? layoutTopology(graph) : null, [graph]);

    if (!graph || !layout) {
        return (
            <div className="flex items-center justify-center h-full min-h-[180px] text-sm text-slate-500 text-center px-6">
                {graph === undefined
                    ? 'Loading dependency graph from Jaeger…'
                    : 'No inter-service calls observed in the last hour — the graph is built from real Jaeger dependency data, so it stays empty until traffic flows.'}
            </div>
        );
    }

    const pos = new Map(layout.nodes.map(n => [n.name, n]));
    const maxCalls = Math.max(1, ...graph.edges.map(e => e.callCount));

    return (
        <div className="px-3 pb-4 overflow-x-auto">
            <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="w-full"
                style={{ minWidth: Math.min(layout.width, 560), maxHeight: 320 }}
            >
                {/* Edges with traffic-paced flow particles */}
                {graph.edges.map((e, i) => {
                    const a = pos.get(e.parent);
                    const b = pos.get(e.child);
                    if (!a || !b) return null;
                    const x1 = a.x + a.width, y1 = a.y + TOPO.nodeH / 2;
                    const x2 = b.x, y2 = b.y + TOPO.nodeH / 2;
                    const d = `M ${x1} ${y1} C ${x1 + 55} ${y1}, ${x2 - 55} ${y2}, ${x2} ${y2}`;
                    const weight = e.callCount / maxCalls;
                    // Busier edges flow faster: 1.8s for the hottest path, up to 6s for cold ones
                    const dur = (6 - weight * 4.2).toFixed(1);
                    return (
                        <g key={i}>
                            <path d={d} fill="none" stroke="#22d3ee" strokeOpacity={0.15 + weight * 0.3} strokeWidth={1 + weight * 1.6}>
                                <title>{`${e.parent} → ${e.child} · ${e.callCount.toLocaleString()} calls (last hour)`}</title>
                            </path>
                            <circle r={2.2} fill="#67e8f9" opacity={0.9}>
                                <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d} />
                            </circle>
                        </g>
                    );
                })}

                {/* Service nodes, colored by live health status */}
                {layout.nodes.map(n => {
                    const status = statusByService.get(n.name) ?? 'unknown';
                    const color = STATUS_HEX[status] ?? STATUS_HEX.unknown;
                    return (
                        <g key={n.name} transform={`translate(${n.x}, ${n.y})`}>
                            <rect
                                width={n.width}
                                height={TOPO.nodeH}
                                rx={15}
                                fill="#0f172a"
                                stroke={color}
                                strokeOpacity={0.7}
                                strokeWidth={1.2}
                            />
                            <circle cx={14} cy={TOPO.nodeH / 2} r={3.5} fill={color} />
                            <text
                                x={24}
                                y={TOPO.nodeH / 2 + 3.5}
                                fill="#cffafe"
                                fontSize={11}
                                fontFamily="ui-monospace, monospace"
                            >
                                {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
                            </text>
                            <title>{`${n.name} — ${status}`}</title>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── Bayesian inference panel ────────────────────────────────────────────────

function ProbBar({ label, p }: { label: string; p: number }) {
    const pct = Math.max(0, Math.min(100, p * 100));
    const tone = pct >= 70 ? 'bg-red-500' : pct >= 30 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-14 text-cyan-100/50 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right font-mono text-cyan-100/70">{pct.toFixed(0)}%</span>
        </div>
    );
}

function BayesianPanel({ data, isError }: { data: BayesianInsightsResponse | undefined; isError: boolean }) {
    return (
        <div className={`${PANEL} flex flex-col`}>
            <SectionHeader
                icon={Brain}
                kicker="Probabilistic engine"
                title="Bayesian Inference"
                aside={data && <span className="text-[11px] font-mono text-cyan-100/40">{data.count} services scored</span>}
            />
            <div className="px-5 pb-5 space-y-3 flex-1">
                <p className="text-xs text-cyan-100/40 leading-relaxed -mt-1">
                    A Bayesian model continuously fits each service's latency and error behavior, then reports the posterior probability that it is currently anomalous — with evidence for likely root causes.
                </p>
                {isError ? (
                    <div className="text-sm text-amber-400/80 bg-amber-950/30 border border-amber-700/30 rounded-lg px-4 py-3">
                        Bayesian engine unreachable — probabilistic scoring is offline right now.
                    </div>
                ) : data === undefined ? (
                    <div className="text-sm text-slate-500 text-center py-6">Loading insights…</div>
                ) : data.insights.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-6">
                        No insights yet — the engine trains on live traces and publishes once it has enough evidence.
                    </div>
                ) : (
                    data.insights.map(insight => (
                        <div key={insight.service} className="rounded-xl bg-slate-950/50 border border-cyan-500/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-sm text-cyan-300">{insight.service}</span>
                                <span className="text-[10px] font-mono text-cyan-100/40" title="Model confidence in this assessment, based on sample volume">
                                    confidence {(insight.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                            <ProbBar label="latency" p={insight.latency_anomaly_probability} />
                            <ProbBar label="errors" p={insight.error_anomaly_probability} />
                            {insight.likely_root_causes.slice(0, 2).map((rc, i) => (
                                <div key={i} className="text-xs text-cyan-100/60 flex items-baseline gap-2">
                                    <span className="text-purple-400 font-mono shrink-0">p={(rc.probability * 100).toFixed(0)}%</span>
                                    <span><span className="text-cyan-200 font-mono">{rc.service}</span> — {rc.evidence}</span>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Monitor() {
    const queryClient = useQueryClient();
    const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
    const [minSeverity, setMinSeverity] = useState<SeverityLevel>(5); // Show all by default (SEV 5 = lowest)

    // Live streaming state
    const [streamingText, setStreamingText] = useState<string>('');
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [streamingAnomalyIds, setStreamingAnomalyIds] = useState<string[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
    const [wsConnected, setWsConnected] = useState<boolean>(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [wsAnalysisResult, setWsAnalysisResult] = useState<AnalysisResponse | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Ticking clock for relative timestamps and data-freshness display
    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // WebSocket connection
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/monitor`;

        const connect = () => {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                log.info('Connected to monitor');
                setWsConnected(true);
            };

            ws.onclose = () => {
                log.warn('Disconnected, reconnecting...');
                setWsConnected(false);
                setTimeout(connect, 3000);
            };

            ws.onmessage = (event) => {
                const msg: WSMessage = JSON.parse(event.data);

                switch (msg.type) {
                    case 'analysis-start':
                        setIsStreaming(true);
                        setStreamingText('');
                        setStreamingAnomalyIds(msg.anomalyIds || []);
                        break;

                    case 'analysis-chunk':
                        setStreamingText(prev => prev + (msg.data || ''));
                        break;

                    case 'analysis-complete':
                        setIsStreaming(false);
                        setLastUpdated(new Date());
                        // If structured analysis data arrived, populate AI Analysis card
                        if (msg.data && typeof msg.data === 'object' && msg.data.summary) {
                            setWsAnalysisResult(msg.data as AnalysisResponse);
                        }
                        break;

                    case 'alert':
                        setLiveAlerts(prev => [{
                            severity: msg.data.severity,
                            message: msg.data.message,
                            timestamp: msg.timestamp || new Date().toISOString()
                        }, ...prev].slice(0, 5)); // Keep last 5 alerts
                        break;
                }
            };

            ws.onerror = (err) => {
                log.error({ err }, 'WebSocket error');
            };
        };

        connect();

        return () => {
            wsRef.current?.close();
        };
    }, []);

    // ── Data feeds ──
    const { data: healthData, dataUpdatedAt: healthUpdatedAt } = useQuery<{ status: string; services: ServiceHealth[] }>({
        queryKey: ["/api/v1/monitor/health"],
        refetchInterval: 5000,
    });

    const { data: baselinesData } = useQuery<{ baselines: SpanBaseline[] }>({
        queryKey: ["/api/v1/monitor/baselines/enriched"],
        refetchInterval: 10000,
    });

    const { data: anomaliesData } = useQuery<{ active: Anomaly[] }>({
        queryKey: ["/api/v1/monitor/anomalies"],
        refetchInterval: 5000,
    });

    const { data: amountAnomaliesData } = useQuery<{ active: AmountAnomaly[]; enabled: boolean }>({
        queryKey: ["/api/v1/monitor/amount-anomalies"],
        refetchInterval: 5000,
    });

    const { data: sloData } = useQuery<SloResponse>({
        queryKey: ["/api/v1/monitor/slo"],
        refetchInterval: 15000,
    });

    const { data: historyData } = useQuery<HistoryResponse>({
        queryKey: ["/api/v1/monitor/history?hours=24"],
        refetchInterval: 60000,
    });

    const { data: topologyData } = useQuery<TopologyResponse>({
        queryKey: ["/api/v1/monitor/topology"],
        refetchInterval: 60000,
    });

    const { data: bayesianData, isError: bayesianError } = useQuery<BayesianInsightsResponse>({
        queryKey: ["/api/v1/monitor/bayesian/insights"],
        refetchInterval: 20000,
    });

    const { data: trainingStats } = useQuery<{ totalExamples: number; goodExamples: number; badExamples: number }>({
        queryKey: ["/api/v1/monitor/training/stats"],
        refetchInterval: 30000,
    });

    // ── Mutations ──
    const analyzeMutation = useMutation({
        mutationFn: async (traceId: string) => {
            const res = await fetch("/api/v1/monitor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ traceId }),
            });
            return res.json() as Promise<AnalysisResponse>;
        },
    });

    const correlationMutation = useMutation({
        mutationFn: async (anomaly: Anomaly) => {
            const res = await fetch("/api/v1/monitor/correlate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    anomalyId: anomaly.id,
                    service: anomaly.service,
                    timestamp: anomaly.timestamp,
                }),
            });
            return res.json() as Promise<CorrelatedMetrics>;
        },
    });

    const recalculateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/v1/monitor/recalculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            return res.json() as Promise<RecalculateResponse>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/v1/monitor"] });
        },
    });

    // Training data rating
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionText, setCorrectionText] = useState('');
    const [ratingSuccess, setRatingSuccess] = useState<'good' | 'bad' | null>(null);

    const ratingMutation = useMutation({
        mutationFn: async ({ rating, correction }: { rating: 'good' | 'bad'; correction?: string }) => {
            if (!selectedAnomaly || !analyzeMutation.data || (analyzeMutation.data as any).status === 'processing') return;

            // Use the EXACT prompt and response from the LLM call
            const res = await fetch("/api/v1/monitor/training/rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    anomaly: {
                        id: selectedAnomaly.id,
                        traceId: selectedAnomaly.traceId,
                        service: selectedAnomaly.service,
                        operation: selectedAnomaly.operation,
                        duration: selectedAnomaly.duration,
                        expectedMean: selectedAnomaly.expectedMean,
                        deviation: selectedAnomaly.deviation,
                        severity: selectedAnomaly.severity,
                        severityName: selectedAnomaly.severityName,
                        timestamp: selectedAnomaly.timestamp,
                    },
                    prompt: analyzeMutation.data.prompt || `Analyze anomaly: ${selectedAnomaly.service}:${selectedAnomaly.operation}`,
                    completion: analyzeMutation.data.rawResponse || `${analyzeMutation.data.summary}\n\nCauses: ${(analyzeMutation.data.possibleCauses || []).join(', ')}\n\nRecommendations: ${(analyzeMutation.data.recommendations || []).join(', ')}`,
                    rating,
                    correction,
                }),
            });
            return res.json();
        },
        onSuccess: (_, variables) => {
            setRatingSuccess(variables.rating);
            setShowCorrectionModal(false);
            setCorrectionText('');
            setTimeout(() => setRatingSuccess(null), 3000);
        },
    });

    // ── Handlers ──
    const handleSelectAnomaly = (anomaly: Anomaly) => {
        setSelectedAnomaly(anomaly);
        analyzeMutation.reset();
        correlationMutation.reset();
        setWsAnalysisResult(null);
        // Auto-fetch correlated metrics
        correlationMutation.mutate(anomaly);
    };

    const handleClearSelection = () => {
        setSelectedAnomaly(null);
        analyzeMutation.reset();
        correlationMutation.reset();
        setWsAnalysisResult(null);
    };

    // ── Derived ──
    const statusByService = useMemo(
        () => new Map((healthData?.services ?? []).map(s => [s.name, s.status])),
        [healthData]
    );

    const overallStatus = healthData?.status ?? 'unknown';
    const statusChip = getStatusBadge(overallStatus);
    const dataAgeSec = healthUpdatedAt ? Math.max(0, Math.floor((nowTick - healthUpdatedAt) / 1000)) : null;

    const filteredAnomalies = (anomaliesData?.active ?? []).filter(a => a.severity <= minSeverity);

    // Active analysis result: WebSocket (async path) or cached HTTP response
    const analysis = wsAnalysisResult || (analyzeMutation.data?.summary ? analyzeMutation.data : null);
    const analysisPending = !!(analyzeMutation.data && (analyzeMutation.data as any).status === 'processing' && !wsAnalysisResult);

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-cyan-100">
                {/* Faint structural grid — the room, not the furniture */}
                <div
                    className="pointer-events-none fixed inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(6,182,212,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.4) 1px, transparent 1px)',
                        backgroundSize: '56px 56px',
                    }}
                />

                <div className="relative max-w-[1600px] mx-auto p-5 sm:p-8 space-y-5">

                    {/* ── Command header ── */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                        <div>
                            <div className={MICRO}>Krystaline Observability</div>
                            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent leading-tight">
                                Mission Control
                            </h1>
                            <p className="text-sm text-cyan-100/50 mt-1 max-w-xl">
                                The exchange's nervous system, live. Every figure below is derived from real traces and metrics — the same MCP feeds Tomograph reads. Nothing staged.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${statusChip.className}`}>
                                <span className="relative flex h-2.5 w-2.5">
                                    {overallStatus === 'healthy' && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_HEX[overallStatus] ?? STATUS_HEX.unknown }} />
                                </span>
                                <span className="font-semibold text-sm tracking-wide">{statusChip.label}</span>
                                <span className="text-[10px] font-mono opacity-60" title="Seconds since the health feed last answered">
                                    {dataAgeSec === null ? 'awaiting data' : `${dataAgeSec}s`}
                                </span>
                            </div>
                            <button
                                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/v1/monitor"] })}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-slate-900/60 text-cyan-100 hover:bg-slate-800 hover:border-cyan-400/50 text-sm font-medium transition-all backdrop-blur"
                            >
                                <RefreshCw className="h-3.5 w-3.5" /> Refresh
                            </button>
                            <button
                                onClick={() => recalculateMutation.mutate()}
                                disabled={recalculateMutation.isPending}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
                            >
                                {recalculateMutation.isPending ? 'Recalculating…' : 'Recalculate Baselines'}
                            </button>
                            <button
                                onClick={() => window.open(import.meta.env.VITE_JAEGER_URL || "http://localhost:16686", "_blank")}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-slate-900/60 text-cyan-100 hover:bg-slate-800 hover:border-cyan-400/50 text-sm font-medium transition-all backdrop-blur"
                            >
                                Jaeger <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Recalculation status */}
                    {recalculateMutation.data && (
                        <div className={`p-3 rounded-xl text-sm border ${recalculateMutation.data.success ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200' : 'bg-red-950/40 border-red-700/50 text-red-200'}`}>
                            {recalculateMutation.data.success ? '✅' : '❌'} {recalculateMutation.data.message}
                            {recalculateMutation.data.success && ` (${recalculateMutation.data.duration}ms)`}
                        </div>
                    )}

                    {/* ── 1 · Is the system OK? — SLO vitals ── */}
                    <VitalsStrip slo={sloData} anomalies={anomaliesData?.active} services={healthData?.services} />

                    {/* ── 2 · What is happening right now? ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                        <div className="lg:col-span-3">
                            <AnomalyPulse trend={historyData?.hourlyTrend} />
                        </div>
                        <div className="lg:col-span-2">
                            <LiveConsole
                                wsConnected={wsConnected}
                                isStreaming={isStreaming}
                                streamingText={streamingText}
                                streamingAnomalyIds={streamingAnomalyIds}
                                liveAlerts={liveAlerts}
                                lastUpdated={lastUpdated}
                            />
                        </div>
                    </div>

                    {/* ── 3 · Where? — System map ── */}
                    <div className={PANEL}>
                        <SectionHeader
                            icon={Network}
                            kicker="Jaeger dependency graph · last hour"
                            title="System Map"
                            aside={topologyData && (
                                <span className="text-[11px] font-mono text-cyan-100/40">
                                    {topologyData.nodes.length} services · {topologyData.edges.length} call paths
                                </span>
                            )}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 items-stretch">
                            <div className="lg:col-span-3">
                                <TopologyMap graph={topologyData} statusByService={statusByService} />
                            </div>
                            <div className="lg:col-span-2 px-5 pb-5 lg:pl-0 space-y-2">
                                {(healthData?.services ?? []).map((service) => {
                                    const badge = getStatusBadge(service.status);
                                    return (
                                        <div
                                            key={service.name}
                                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-cyan-500/10 hover:border-cyan-400/25 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_HEX[service.status] ?? STATUS_HEX.unknown }} />
                                                <span className="font-mono text-sm text-cyan-50 truncate">{service.name}</span>
                                                <Badge className={`${badge.className} border text-[10px] px-1.5 py-0 hidden sm:inline-flex`}>{badge.label}</Badge>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <span className="font-mono text-sm text-cyan-100/80" title="Average span duration vs. learned baseline">
                                                    {formatDuration(service.avgDuration)}
                                                </span>
                                                <div className="text-[10px] text-cyan-100/40 font-mono">
                                                    {service.activeAnomalies > 0
                                                        ? <span className="text-amber-400">{service.activeAnomalies} active anomal{service.activeAnomalies > 1 ? 'ies' : 'y'}</span>
                                                        : `seen ${timeAgo(service.lastSeen, nowTick)}`}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!healthData?.services || healthData.services.length === 0) && (
                                    <div className="text-slate-500 text-sm text-center py-8">
                                        Collecting baseline data — services appear as soon as spans arrive.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 4 · What is wrong, and why? — Incident workbench ── */}
                    <div className={PANEL}>
                        <SectionHeader
                            icon={Crosshair}
                            kicker="σ-scored against learned baselines"
                            title={
                                <span className="flex items-center gap-2.5">
                                    Incident Workbench
                                    {filteredAnomalies.length > 0 && (
                                        <Badge variant="destructive" className="px-2">{filteredAnomalies.length}</Badge>
                                    )}
                                </span>
                            }
                            aside={
                                <select
                                    value={minSeverity}
                                    onChange={(e) => setMinSeverity(Number(e.target.value) as SeverityLevel)}
                                    className="bg-slate-950/60 border border-cyan-500/30 text-cyan-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 backdrop-blur"
                                >
                                    <option value={5}>All (SEV5+)</option>
                                    <option value={4}>SEV4+ Minor</option>
                                    <option value={3}>SEV3+ Moderate</option>
                                    <option value={2}>SEV2+ Major</option>
                                    <option value={1}>SEV1 Critical only</option>
                                </select>
                            }
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 px-5 pb-5">
                            {/* Anomaly list */}
                            <div className="lg:col-span-2 space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                                {filteredAnomalies.map((anomaly) => {
                                    const sevBadge = getSeverityBadge(anomaly.severity);
                                    const tone = anomaly.severity <= 2
                                        ? 'border-red-600/50 bg-red-950/30 hover:bg-red-950/50'
                                        : anomaly.severity <= 3
                                            ? 'border-amber-600/50 bg-amber-950/30 hover:bg-amber-950/50'
                                            : 'border-yellow-600/40 bg-yellow-950/20 hover:bg-yellow-950/40';
                                    const selected = selectedAnomaly?.id === anomaly.id;
                                    return (
                                        <div
                                            key={anomaly.id}
                                            className={`p-3.5 rounded-xl cursor-pointer transition-all border ${tone} ${selected ? 'ring-2 ring-purple-500' : ''}`}
                                            onClick={() => handleSelectAnomaly(anomaly)}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Badge className={`${sevBadge.className} text-[10px] px-1.5 py-0 shrink-0`}>{sevBadge.label}</Badge>
                                                    <span className="font-mono text-sm text-cyan-50 truncate">
                                                        <span className="text-cyan-400">{anomaly.service}</span>
                                                        <span className="text-slate-500">:</span>
                                                        {anomaly.operation}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400 shrink-0">{formatTime(anomaly.timestamp)}</span>
                                            </div>
                                            <div className="text-sm text-slate-200">
                                                <span className="text-red-400 font-semibold font-mono">{formatDuration(anomaly.duration)}</span>
                                                <span className="text-cyan-100/50"> vs {formatDuration(anomaly.expectedMean)} expected · </span>
                                                <span className="font-mono" title={`${anomaly.deviation.toFixed(1)} standard deviations from this span's learned mean`}>
                                                    {anomaly.deviation.toFixed(1)}σ
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredAnomalies.length === 0 && (
                                    <div className="text-slate-400 text-center py-12 text-sm">
                                        {anomaliesData === undefined
                                            ? 'Loading anomalies…'
                                            : anomaliesData.active.length > 0
                                                ? `No anomalies at SEV${minSeverity} or higher`
                                                : 'No active anomalies — every span currently within its learned baseline.'}
                                    </div>
                                )}
                            </div>

                            {/* Detail panel */}
                            <div className="lg:col-span-3 rounded-xl bg-slate-950/50 border border-cyan-500/10 p-4">
                                {selectedAnomaly ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Badge className={`${getSeverityBadge(selectedAnomaly.severity).className} text-[10px] px-1.5 py-0`}>
                                                    {getSeverityBadge(selectedAnomaly.severity).label}
                                                </Badge>
                                                <span className="font-mono text-sm text-cyan-50 truncate">
                                                    {selectedAnomaly.service}:{selectedAnomaly.operation}
                                                </span>
                                                <span className="text-[10px] font-mono text-cyan-100/40">trace {selectedAnomaly.traceId.slice(0, 12)}…</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => analyzeMutation.mutate(selectedAnomaly.traceId)}
                                                    disabled={analyzeMutation.isPending || analysisPending}
                                                    className="bg-purple-600 hover:bg-purple-700 text-xs"
                                                >
                                                    {analyzeMutation.isPending || analysisPending ? 'Analyzing…' : 'Run AI Analysis'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-cyan-400 hover:text-cyan-300 text-xs"
                                                    onClick={() => window.open(getJaegerTraceUrl(selectedAnomaly.traceId), "_blank")}
                                                >
                                                    Trace <ExternalLink className="h-3 w-3 ml-1" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleClearSelection}
                                                    className="text-slate-400 hover:text-slate-200 text-xs"
                                                >
                                                    Close
                                                </Button>
                                            </div>
                                        </div>

                                        {/* AI analysis */}
                                        {analysisPending && (
                                            <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-4 flex items-center gap-3">
                                                <div className="animate-spin h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full shrink-0" />
                                                <div className="text-sm text-cyan-100/70">
                                                    Enriching trace with metrics, logs, and topology context — the LLM verdict streams into the Live AI console and lands here when done.
                                                </div>
                                            </div>
                                        )}

                                        {analysis && (
                                            <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-4 space-y-3">
                                                <div>
                                                    <div className={MICRO}>Summary</div>
                                                    <p className="text-sm text-cyan-50 leading-relaxed mt-1">{analysis.summary}</p>
                                                </div>
                                                {analysis.possibleCauses?.length > 0 && (
                                                    <div>
                                                        <div className={MICRO}>Possible causes</div>
                                                        <ul className="list-disc list-inside text-sm text-cyan-100/90 space-y-1 mt-1">
                                                            {analysis.possibleCauses.map((cause: string, i: number) => <li key={i}>{cause}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {analysis.recommendations?.length > 0 && (
                                                    <div>
                                                        <div className={MICRO}>Recommendations</div>
                                                        <ul className="list-disc list-inside text-sm text-emerald-300 space-y-1 mt-1">
                                                            {analysis.recommendations.map((rec: string, i: number) => <li key={i}>{rec}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/60">
                                                    <Badge
                                                        variant="outline"
                                                        title="The model's own confidence in this diagnosis"
                                                        className={`text-xs ${analysis.confidence === 'high'
                                                            ? 'border-emerald-500 text-emerald-400'
                                                            : analysis.confidence === 'medium'
                                                                ? 'border-amber-500 text-amber-400'
                                                                : 'border-slate-500 text-slate-400'}`}
                                                    >
                                                        confidence: {analysis.confidence}
                                                    </Badge>
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <span className="text-xs text-cyan-100/40">Rate to train the model:</span>
                                                        <button
                                                            onClick={() => ratingMutation.mutate({ rating: 'good' })}
                                                            disabled={ratingMutation.isPending || ratingSuccess !== null}
                                                            className="px-2.5 py-1 rounded-md text-xs bg-emerald-900/50 border border-emerald-700 text-emerald-400 hover:bg-emerald-800/50 disabled:opacity-50 transition-colors"
                                                        >
                                                            {ratingSuccess === 'good' ? '✓ Saved' : '👍 Good'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowCorrectionModal(true)}
                                                            disabled={ratingMutation.isPending || ratingSuccess !== null}
                                                            className="px-2.5 py-1 rounded-md text-xs bg-red-900/50 border border-red-700 text-red-400 hover:bg-red-800/50 disabled:opacity-50 transition-colors"
                                                        >
                                                            {ratingSuccess === 'bad' ? '✓ Saved' : '👎 Bad'}
                                                        </button>
                                                        {trainingStats && (
                                                            <span className="text-[10px] text-slate-500 font-mono">{trainingStats.totalExamples} examples</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Correlated metrics at the moment of the anomaly */}
                                        <div>
                                            <div className={`${MICRO} mb-2`}>
                                                Resource state at anomaly time (Prometheus)
                                                {correlationMutation.isPending && <span className="ml-2 normal-case tracking-normal text-cyan-400/60">loading…</span>}
                                            </div>
                                            {correlationMutation.data ? (
                                                <>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {([
                                                            { label: 'CPU', value: correlationMutation.data.metrics.cpuPercent, fmt: (v: number) => `${v.toFixed(1)}%`, warn: 60, crit: 80 },
                                                            { label: 'Memory', value: correlationMutation.data.metrics.memoryMB, fmt: (v: number) => `${v.toFixed(0)}MB`, warn: 512, crit: Infinity },
                                                            { label: 'Req rate', value: correlationMutation.data.metrics.requestRate, fmt: (v: number) => `${v.toFixed(1)}/s` },
                                                            { label: 'Error rate', value: correlationMutation.data.metrics.errorRate, fmt: (v: number) => `${v.toFixed(1)}%`, warn: 1, crit: 5 },
                                                            { label: 'P99 latency', value: correlationMutation.data.metrics.p99LatencyMs, fmt: (v: number) => `${v.toFixed(0)}ms` },
                                                            { label: 'Connections', value: correlationMutation.data.metrics.activeConnections, fmt: (v: number) => `${v}`, warn: 100, crit: Infinity },
                                                        ] as Array<{ label: string; value: number | null; fmt: (v: number) => string; warn?: number; crit?: number }>).map(m => {
                                                            const tone = m.value === null ? 'text-slate-500'
                                                                : m.crit !== undefined && m.value >= m.crit ? 'text-red-400'
                                                                    : m.warn !== undefined && m.value >= m.warn ? 'text-amber-400'
                                                                        : 'text-emerald-400';
                                                            return (
                                                                <div key={m.label} className="rounded-lg bg-slate-900/70 border border-cyan-500/10 px-3 py-2">
                                                                    <div className="text-[10px] uppercase tracking-wider text-cyan-100/40">{m.label}</div>
                                                                    <div className={`font-mono text-lg font-semibold ${tone}`}>
                                                                        {m.value !== null ? m.fmt(m.value) : 'n/a'}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {correlationMutation.data.insights.length > 0 ? (
                                                        <div className="mt-2 rounded-lg bg-amber-950/30 border border-amber-700/40 px-3 py-2">
                                                            {correlationMutation.data.insights.map((insight, i) => (
                                                                <div key={i} className="text-sm text-amber-200">{insight}</div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="mt-2 text-xs text-cyan-100/40">
                                                            No resource pressure at anomaly time — points away from infrastructure, toward the code path itself.
                                                        </p>
                                                    )}
                                                </>
                                            ) : !correlationMutation.isPending && (
                                                <p className="text-xs text-slate-500">
                                                    Metrics unavailable for this window — is Prometheus reachable?
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center px-6">
                                        <Crosshair className="h-8 w-8 text-cyan-500/30 mb-3" />
                                        <p className="text-sm text-cyan-100/50 max-w-sm">
                                            Select an anomaly to open the workbench — AI root-cause analysis, the resource state at the moment it happened, and a one-click jump to the raw trace.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 5 · The evidence — probabilistic + business anomalies ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <BayesianPanel data={bayesianData} isError={bayesianError} />

                        {/* Whale detection */}
                        <div className={`${PANEL} flex flex-col`}>
                            <SectionHeader
                                icon={Waves}
                                kicker="Amount anomalies · business layer"
                                title={
                                    <span className="flex items-center gap-2.5">
                                        🐋 Whale Detection
                                        {(amountAnomaliesData?.active?.length ?? 0) > 0 && (
                                            <Badge className="bg-amber-600 text-white px-2">{amountAnomaliesData!.active.length}</Badge>
                                        )}
                                    </span>
                                }
                                aside={
                                    <Badge className={`border ${amountAnomaliesData?.enabled ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-600/20 text-slate-400 border-slate-500/30'}`}>
                                        {amountAnomaliesData === undefined ? '…' : amountAnomaliesData.enabled ? 'Active' : 'Disabled'}
                                    </Badge>
                                }
                            />
                            <div className="px-5 pb-5 space-y-2.5 max-h-[420px] overflow-y-auto flex-1">
                                <p className="text-xs text-cyan-100/40 leading-relaxed -mt-1">
                                    The same σ-scoring applied to transaction <em>amounts</em> instead of durations — surfacing outsized trades and transfers the moment they clear.
                                </p>
                                {(amountAnomaliesData?.active ?? []).map((anomaly) => {
                                    const sevBadge = getSeverityBadge(anomaly.severity);
                                    return (
                                        <div key={anomaly.id} className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/25 hover:bg-amber-950/40 transition-all">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <Badge className={`${sevBadge.className} text-[10px] px-1.5 py-0`}>{sevBadge.label}</Badge>
                                                        <span className="text-amber-400 font-bold text-sm">{anomaly.operationType}</span>
                                                        <span className="text-white font-medium text-sm">{anomaly.asset}</span>
                                                    </div>
                                                    <div className="font-mono text-base text-white font-bold">
                                                        {anomaly.amount.toLocaleString()} {anomaly.asset}
                                                        <span className="text-emerald-400 ml-2 text-sm">
                                                            (${anomaly.dollarValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-300 mt-1">{anomaly.reason}</div>
                                                    <div className="text-[11px] text-amber-400/70 mt-0.5 font-mono">
                                                        {anomaly.deviation.toFixed(1)}σ above the {anomaly.expectedMean.toLocaleString()} average for {anomaly.operationType}:{anomaly.asset}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-slate-400 text-xs font-mono">{formatTime(anomaly.timestamp)}</div>
                                                    {anomaly.traceId && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-xs h-6 px-2 mt-1 text-cyan-400 hover:text-cyan-300"
                                                            onClick={() => window.open(getJaegerTraceUrl(anomaly.traceId!), "_blank")}
                                                        >
                                                            Trace →
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {amountAnomaliesData !== undefined && amountAnomaliesData.active.length === 0 && (
                                    <div className="text-slate-500 text-center py-10 text-sm">
                                        No whale transactions detected — all amounts within learned distributions.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 6 · The foundation — learned baselines ── */}
                    <div className={PANEL}>
                        <SectionHeader
                            icon={Activity}
                            kicker="What 'normal' means here"
                            title="Learned Baselines"
                            aside={baselinesData?.baselines && (
                                <span className="text-[11px] font-mono text-cyan-100/40">{baselinesData.baselines.length} spans tracked</span>
                            )}
                        />
                        <div className="px-5 pb-5">
                            <p className="text-xs text-cyan-100/40 leading-relaxed mb-3 max-w-3xl">
                                Per-operation latency profiles learned online from every Jaeger span (Welford's algorithm). These distributions define "normal" — the σ-deviations that drive every anomaly above are measured against them.
                            </p>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-cyan-500/15 hover:bg-transparent">
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold">Span</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-center">Now vs baseline</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-right">Mean</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-right">Std Dev (σ)</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-right">P95</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-right">P99</TableHead>
                                            <TableHead className="text-cyan-100/80 text-sm font-semibold text-right">Samples</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {baselinesData?.baselines?.slice(0, 15).map((baseline, index) => (
                                            <TableRow
                                                key={baseline.spanKey}
                                                className={`border-cyan-500/10 ${index % 2 === 0 ? 'bg-slate-950/30' : 'bg-slate-950/50'} hover:bg-slate-800/40 transition-colors`}
                                            >
                                                <TableCell className="font-mono text-sm py-2.5">
                                                    <span className="text-cyan-400 font-medium">{baseline.service}</span>
                                                    <span className="text-cyan-500/50 mx-1">:</span>
                                                    <span className="text-cyan-100">{baseline.operation}</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <DeviationMiniChart
                                                            currentValue={baseline.statusIndicator?.recentMean ?? baseline.mean}
                                                            mean={baseline.mean}
                                                            stdDev={baseline.stdDev}
                                                            deviation={baseline.statusIndicator?.deviation}
                                                            status={baseline.statusIndicator?.status}
                                                            width={80}
                                                            height={28}
                                                        />
                                                        <BaselineStatusBadge indicator={baseline.statusIndicator} size="sm" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-cyan-100 font-mono">{formatDuration(baseline.mean)}</TableCell>
                                                <TableCell className="text-right text-sm text-cyan-300/70 font-mono">±{formatDuration(baseline.stdDev)}</TableCell>
                                                <TableCell className="text-right text-sm text-cyan-100 font-mono">{formatDuration(baseline.p95)}</TableCell>
                                                <TableCell className="text-right text-sm text-cyan-100 font-mono">{formatDuration(baseline.p99)}</TableCell>
                                                <TableCell className="text-right text-sm text-cyan-300/70 font-mono">{baseline.sampleCount.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {(!baselinesData?.baselines || baselinesData.baselines.length === 0) && (
                                    <div className="text-cyan-400/60 text-center py-10 text-sm">
                                        Collecting baseline data from Jaeger — the table fills as spans accumulate.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Honesty footer */}
                    <div className="flex items-center justify-center gap-2 text-xs text-cyan-100/40 pb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-cyan-500/50" />
                        <span>
                            Honest by design: every figure above is computed from live traces and metrics. When a feed is down, you see "—", never a fake green.
                        </span>
                    </div>
                </div>

                {/* Correction modal */}
                {showCorrectionModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl">
                            <h3 className="text-xl font-semibold text-white mb-3">Provide Correction</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                How should the AI have responded? Your correction becomes a training example for future analyses.
                            </p>
                            <textarea
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                                placeholder="Enter the correct analysis..."
                                className="w-full h-40 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                            />
                            <div className="flex gap-3 mt-4 justify-end">
                                <button
                                    onClick={() => {
                                        setShowCorrectionModal(false);
                                        setCorrectionText('');
                                    }}
                                    className="px-4 py-2 rounded-md text-sm border border-slate-600 text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => ratingMutation.mutate({ rating: 'bad', correction: correctionText })}
                                    disabled={!correctionText.trim() || ratingMutation.isPending}
                                    className="px-4 py-2 rounded-md text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {ratingMutation.isPending ? 'Saving…' : 'Submit Correction'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

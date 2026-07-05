# Krystaline Bayesian Inference Service

Hierarchical Bayesian modeling for probabilistic observability.  
Extends Krystaline's deterministic anomaly detection with uncertainty-aware
inference, root cause analysis, and confidence scoring. Two engines run side
by side: a hierarchical latency/error model and a Noisy-OR alert correlator
that trains itself from resolved incidents.

## Why Bayesian?

- **Partial pooling.** Per-service parameters are drawn from a global
  hyperprior (`μ_service[i] ~ Normal(μ_global, σ_global)`), so a low-traffic
  service with only a handful of observed spans shrinks toward the fleet-wide
  prior instead of false-alerting on its own noisy mean.
- **Calibrated probabilities, not binary thresholds.** A 3σ trip-wire says
  "anomalous: yes/no". This service returns
  `latency_anomaly_probability: 0.87` with `confidence: 0.91`, so consumers
  can rank services, tune their own cut-offs, and see how much the model
  actually knows.
- **Dependency-aware RCA.** Anomaly evidence propagates through the service
  graph with an explicit formula: a parent's posterior uncertainty widens by
  its worst child, `σ_parent ← sqrt(σ_parent² + 0.25 · max(σ_child)²)`, and
  its error prior shifts when any downstream error rate exceeds 10%
  (`error_alpha += 2 · max_child_err`). During root-cause ranking, a child
  whose own child scores higher is dampened ×0.7, so blame settles on the
  deepest anomalous dependency rather than the first hop
  ([`app/models.py`](app/models.py), `_incorporate_dependency_priors` and
  `_rank_root_causes`).

## Architecture

```
Krystaline (Node/TypeScript)
  └─ server/bayesian/
       ├─ feature-extractor.ts  → OTEL traces → structured features
       ├─ alert-extractor.ts    → Alertmanager alerts + anomalies → incidents
       ├─ client.ts             → HTTP client to Python service
       └─ inference.ts          → Orchestration (train → infer → insights)
                ↓ REST (JSON)
Bayesian Service (Python FastAPI, port 8100)
  └─ bayesian-service/app/
       ├─ main.py     → FastAPI endpoints + Prometheus /metrics
       ├─ models.py   → BayesianInferenceEngine + AlertCorrelationEngine
       ├─ poller.py   → AutonomousPoller (Alertmanager + exemplars, 30 s)
       └─ schemas.py  → Pydantic request/response schemas
```

## Engine 1: Hierarchical Latency & Error Model

### Latency Model (Hierarchical LogNormal)

```
Global:
  μ_global     ~ Normal(0, 1)
  σ_global     ~ HalfNormal(1)

Per-service:
  μ_service[i]    ~ Normal(μ_global, σ_global)
  σ_service[i]    ~ HalfNormal(1)

Observation:
  log(latency) ~ Normal(μ_service[i], σ_service[i])
```

Full MCMC sampling runs only when raw span durations are supplied (at least
10 samples for some service): PyMC `pm.sample` with **500 draws, 200 tuning
steps, 2 chains, single core** for container compatibility. When only summary
statistics are available, the service falls back to closed-form
moment-matched posteriors instead:

```
μ_service = log(mean) − 0.5·log(1 + (std/mean)²)
σ_service = sqrt(log(1 + (std/mean)²))
```

### Error Model (Beta-Bernoulli)

```
Per-service:
  p_error[i] ~ Beta(1 + errors, 1 + successes)

Observation:
  error ~ Bernoulli(p_error[i])
```

### Dependency-Aware Extension

Upstream services inherit increased uncertainty from anomalous downstream
services — the exact adjustments quoted in *Why Bayesian?* above:
`σ_parent ← sqrt(σ_parent² + 0.25 · max(σ_child)²)`, error-prior shift above
10% downstream error rate, and the ×0.7 grandchild dampening during
root-cause ranking.

## Engine 2: Noisy-OR Alert Correlator

When several alerts fire together, which one is the root cause? The
`AlertCorrelationEngine` ranks the currently-firing set with a Noisy-OR
Bayesian network:

```
P(c is root cause | firing alerts A) ∝ P_prior(c) × ∏_{a ∈ A, a≠c} P(a fires | c)
```

- `P_prior(c)` — Laplace-smoothed historical root-cause frequency, with a
  temporal bonus (2× prior for the first alert to fire, 1.3× for the second).
- `P(a | c)` — learned co-occurrence, `(co_count + 0.5) / (rc_count + 1)`.
- A leak probability of 0.05 handles alert pairs never seen together;
  scores are normalized via log-sum-exp.

Training consumes incidents (clusters of co-occurring alerts). If an incident
carries a labeled `root_cause_alert` it is used directly; otherwise the
earliest-firing alert is the presumed root cause.

### Autonomous poller

The engine trains itself — no manual labeling required. A background asyncio
task ([`app/poller.py`](app/poller.py)) runs every **30 s**
(`POLL_INTERVAL_SECONDS`, set to 30 in `docker-compose.yml`):

1. Fetches all alerts from Alertmanager (`/api/v2/alerts`).
2. Enriches them with **Prometheus exemplar trace IDs**
   (`/api/v1/query_exemplars`, nearest exemplar within ±5 min of firing) —
   closing the loop alert → exemplar → trace.
3. Clusters resolved alerts into incidents (5-minute window) and auto-trains
   on incidents it has not seen before (last 500 incident IDs retained).
4. When 2+ alerts are firing, runs Noisy-OR inference and caches the ranked
   result for `GET /alert-rca`.

## API Endpoints

### `POST /train`

Fit the hierarchical model to historical service metrics. Passing raw `spans`
triggers full MCMC; summary-only requests use the conjugate fallback.

```json
{
  "services": [
    {
      "service_name": "kx-exchange",
      "latency": { "p50": 12, "p95": 45, "p99": 120, "mean": 18, "std_dev": 15, "sample_count": 5000 },
      "error_rate": 0.02,
      "error_count": 100,
      "request_count": 5000
    }
  ],
  "dependency_graph": {
    "nodes": ["kx-exchange", "kx-matcher", "kx-wallet"],
    "edges": [
      { "parent": "kx-exchange", "child": "kx-matcher", "call_count": 3000 },
      { "parent": "kx-exchange", "child": "kx-wallet", "call_count": 1500 }
    ]
  }
}
```

### `POST /infer`

Get anomaly probabilities and root cause rankings.

```json
{
  "services": [{ "service_name": "kx-exchange", "latency": { "..." }, "..." }],
  "dependency_graph": { "nodes": ["..."], "edges": ["..."] },
  "time_windows": [
    {
      "window_name": "5m",
      "start_epoch_ms": 1711735000000,
      "end_epoch_ms": 1711735300000,
      "services": [{ "..." }]
    }
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "service": "kx-exchange",
      "latency_anomaly_probability": 0.87,
      "error_anomaly_probability": 0.12,
      "likely_root_causes": [
        { "service": "kx-matcher", "probability": 0.65, "evidence": "latency_anomaly=0.82; p99=450.0ms" },
        { "service": "kx-wallet", "probability": 0.22, "evidence": "err_rate=5.2%" }
      ],
      "confidence": 0.91,
      "posterior_latency_mean": 2.89,
      "posterior_latency_std": 0.45,
      "posterior_error_rate": 0.019
    }
  ],
  "model_trained": true,
  "inference_time_ms": 3.21
}
```

**Units:** `posterior_latency_mean` and `posterior_latency_std` are in
**log-space (natural log of milliseconds)** — the μ and σ of the LogNormal
posterior. Above, `2.89` means e^2.89 ≈ 18 ms. `posterior_error_rate` and all
probabilities are plain [0, 1] values; `inference_time_ms` is milliseconds.

### `POST /train-alerts` / `POST /infer-alerts`

Manual entry points to the Noisy-OR correlator: feed historical incidents,
then rank a firing alert set. The autonomous poller calls the same engine, so
these are mostly useful for testing and backfills.

### `GET /alert-rca`

Latest autonomous RCA result: ranked `probable_root_causes` (with exemplar
`trace_id` where available), the firing alert set, and poller health
(`poll_count`, `last_poll_at`, `error_count`).

### `GET /health`

```json
{ "status": "healthy", "model_loaded": true, "services_tracked": 4, "alert_model_incidents": 12, "last_trained": "2026-03-29T17:00:00Z" }
```

### `GET /metrics`

Prometheus metrics: train/infer counters and latency histograms, plus
`bayesian_model_trained`, `bayesian_services_tracked`,
`bayesian_alert_incidents_learned`, and poller cycle/error gauges.

## Running Locally

### Docker Compose (recommended)

```bash
docker compose up bayesian-service
```

Note: `npm run dev` does **not** start this container — it is the one compose
service you bring up separately. The compose definition publishes port 8100,
wires `ALERTMANAGER_URL`/`PROMETHEUS_URL` to the in-network containers, and
caps memory at 2 GB (PyMC compilation is hungry).

### Standalone

```bash
cd bayesian-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100
```

### Environment Variables

| Variable | Default | Used by | Description |
|---|---|---|---|
| `ALERTMANAGER_URL` | `http://localhost:9093` | Python | Alertmanager base URL for the autonomous poller |
| `PROMETHEUS_URL` | `http://localhost:9090` | Python | Prometheus base URL for exemplar enrichment |
| `POLL_INTERVAL_SECONDS` | `30` | Python | Autonomous poll interval |
| `BAYESIAN_SERVICE_URL` | `http://localhost:8100` | Node | Where the TypeScript client finds this service |
| `ENABLE_BAYESIAN_INFERENCE` | `false` | Node | Gate for starting the `server/bayesian/` integration |

## Integration with Krystaline

The TypeScript integration at `server/bayesian/` (started by the monitor when
`ENABLE_BAYESIAN_INFERENCE=true`) handles:

1. **Feature extraction** — Pulls traces from Jaeger, builds dependency graph from `TopologyService`, aggregates service metrics
2. **Training** — Periodically calls `/train` with historical features (every 15 min)
3. **Inference** — Calls `/infer` with current observations and returns `BayesianInsight[]`
4. **Fast path** — `inferFast()` uses cached baselines from `TraceProfiler` (no Jaeger fetch)

```typescript
import { bayesianInference } from './server/bayesian';

// Start periodic inference (trains every 15m, infers every 60s)
await bayesianInference.start();

// Get latest results
const insights = bayesianInference.getLatestInsights();

// Quick inference from cached baselines
const fast = await bayesianInference.inferFast();
```

## Performance

- Model parameters are cached in memory — no retraining per request
- Full PyMC MCMC (500 draws, 200 tune, 2 chains) only runs when raw span data is provided
- Summary-based training uses closed-form conjugate updates (instant)
- Inference is pure NumPy computation (~1-5ms per request)
- Batch inference: all services scored in a single call

## Dependencies & License

Python 3.12 (`Dockerfile`); PyMC ≥ 5.10.0, ArviZ ≥ 0.17.0, NumPy ≥ 1.26.0,
FastAPI ≥ 0.110.0 — version floors declared in
[`requirements.txt`](requirements.txt), resolved at image build. Licensed
[Apache-2.0](../LICENSE), same as the rest of the repository.

## Further Reading

- [`../docs/OBSERVABILITY_WHITEPAPER.md`](../docs/OBSERVABILITY_WHITEPAPER.md) — where probabilistic inference sits in the AI SRE thesis
- [`../docs/observability/05_BAYESIAN_INFERENCE.md`](../docs/observability/05_BAYESIAN_INFERENCE.md) — deep dive on the models and integration

Z-scores answer "is this anomalous"; this service answers "how likely, and why."

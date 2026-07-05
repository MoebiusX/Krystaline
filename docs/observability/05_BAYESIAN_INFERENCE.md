# Bayesian Inference Layer

*Part of the Proof of Observability series — foundations in [the whitepaper](../OBSERVABILITY_WHITEPAPER.md).*

Probabilistic anomaly detection and root-cause analysis using hierarchical Bayesian models. Two engines run side by side in [bayesian-service/](../../bayesian-service/): a hierarchical latency/error model for per-service anomaly probabilities, and a Noisy-OR alert-correlation network that ranks root causes during alert storms — trained autonomously by a background poller.

## Why hierarchical?

A low-traffic service — the matcher at 3 a.m., say — may produce only a handful of spans per window, far too few to estimate its own latency distribution, so a naive per-service model would either page on noise or stay silent. In the hierarchical model every service's parameters are drawn from shared global hyperpriors, so sparse services are shrunk toward the fleet-wide baseline (partial pooling) and borrow statistical strength from busy ones, while high-traffic services remain dominated by their own data.

## Two Inference Paths: Full MCMC vs Analytical Fallback

Training picks its path based on what data arrives ([models.py](../../bayesian-service/app/models.py), `BayesianInferenceEngine.train`):

| Path | When it runs | Cost |
|------|--------------|------|
| **Full MCMC** — PyMC sampling with 500 draws, 200 tune, 2 chains, single core | The train request includes raw per-service latencies and at least one service has ≥ 10 samples | Seconds. Posterior means are cached, so sampling cost is paid once per training cycle, never at inference time |
| **Analytical conjugate fallback** — moment-matched LogNormal from mean/std, Beta(1 + errors, 1 + successes) for error rates | Summary statistics only — the common path when features come from the TypeScript extractor | Pure arithmetic, no sampling. Inference against cached posteriors is sub-millisecond (`inference_time_ms: 0.29` in the example response below) |

Both paths land in the same cached `ServicePosterior` structure, so inference code doesn't care which one trained it.

## Architecture

```
[ OTEL Traces (Jaeger) ]
        ↓
[ Feature Extraction (TypeScript) ]
  - Service metrics: p50/p95/p99 latency, error rate, request volume
  - Dependency graph: service → downstream (from trace parent/child)
  - Time windows: 5m / 15m / 1h sliding windows
        ↓
[ Bayesian Service (Python + PyMC + FastAPI) ]
  - Hierarchical LogNormal latency model
  - Beta-Bernoulli error model
  - Dependency-aware prior propagation
        ↓
[ Probabilistic Insights ]
  - Anomaly probability per service (0.0–1.0)
  - Ranked root causes with probabilities
  - Confidence scores
  - Trend detection
```

## Models

### Latency Model (Hierarchical LogNormal)

```
Global:
  μ_global ~ Normal(0, 1)
  σ_global ~ HalfNormal(1)

Per-service:
  μ_service[i] ~ Normal(μ_global, σ_global)
  σ_service[i] ~ HalfNormal(1)

Observations:
  latency ~ LogNormal(μ_service[s], σ_service[s])
```

When raw spans are available, full MCMC sampling is used (500 draws, 200 tune, 2 chains) — see [Two Inference Paths](#two-inference-paths-full-mcmc-vs-analytical-fallback) above. Otherwise, conjugate updates from summary statistics provide instant training.

### Error Model (Beta-Bernoulli)

```
Per-service:
  p_error[i] ~ Beta(1 + errors, 1 + successes)

Observations:
  error ~ Bernoulli(p_error[s])
```

### Dependency-Aware Extensions

- Upstream service σ widened by `sqrt(σ² + 0.25 × max_child_σ²)`
- Error priors shifted when downstream error rate > 10%
- Root cause ranking: downstream anomalies propagated with attenuation

**The 0.25 damping factor.** When a service's dependency is unstable, that instability should widen the parent's posterior uncertainty — but not overwhelm it. The propagation rule in `_incorporate_dependency_priors` ([models.py](../../bayesian-service/app/models.py)) adds only a quarter of the *worst* child's variance to the parent, so a single noisy leaf cannot dominate the entire ancestry while still preventing overconfident anomaly calls on services whose dependencies are misbehaving. The in-code comment says only "dampened" — the value 0.25 is a design choice, not a derived constant. **[BACKLOG]: empirical calibration** of this damping factor against labeled incidents.

## API Endpoints

### Bayesian Service (Python, port 8100)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health, model status |
| `/train` | POST | Train latency/error model from historical features |
| `/infer` | POST | Anomaly inference with root causes |
| `/train-alerts` | POST | Train the Noisy-OR alert-correlation model from incidents |
| `/infer-alerts` | POST | Rank root causes among currently-firing alerts |
| `/alert-rca` | GET | Latest autonomous poller RCA result |
| `/metrics` | GET | Prometheus metrics |

### Monitor API (Express, via `/api/v1/monitor/`, alias `/api/monitor/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/bayesian/insights` | GET | Latest probabilistic insights |
| `/bayesian/train` | POST | Trigger model retraining |
| `/bayesian/health` | GET | Bayesian service health proxy |

### MCP Tools

| Tool | Description |
|------|-------------|
| `bayesian_health` | Check Bayesian service status |
| `bayesian_insights` | Get anomaly probabilities and root causes |
| `bayesian_train` | Trigger model retraining |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ENABLE_BAYESIAN_INFERENCE` | `false` | Enable the Bayesian inference loop |
| `BAYESIAN_SERVICE_URL` | `http://localhost:8100` | URL of the Python service |

## Inference Response Example

```json
{
  "results": [
    {
      "service": "kx-matcher",
      "latency_anomaly_probability": 0.921,
      "error_anomaly_probability": 0.156,
      "likely_root_causes": [
        {"service": "kx-exchange", "probability": 0.953, "evidence": "Upstream latency 2.1σ above baseline"},
        {"service": "kx-wallet", "probability": 0.182, "evidence": "Within normal parameters"}
      ],
      "confidence": 0.88
    }
  ],
  "model_trained": true,
  "inference_time_ms": 0.29
}
```

## File Layout

```
bayesian-service/           # Python microservice
├── app/
│   ├── main.py             # FastAPI endpoints + Prometheus metrics
│   ├── models.py           # BayesianInferenceEngine + AlertCorrelationEngine
│   ├── poller.py           # AutonomousPoller (30s Alertmanager/Prometheus loop)
│   └── schemas.py          # Pydantic request/response schemas
├── Dockerfile
├── requirements.txt
└── README.md

server/bayesian/            # TypeScript integration
├── alert-extractor.ts      # Alertmanager fetch, exemplar enrichment, clustering
├── client.ts               # HTTP client with health caching
├── feature-extractor.ts    # OTEL traces → structured features
├── inference.ts            # Orchestrator (train every 15m, infer every 60s)
├── types.ts                # TypeScript interfaces
└── index.ts                # Module exports
```

## Docker

```bash
# Build and start
docker compose build bayesian-service
docker compose up -d bayesian-service

# Test
curl http://localhost:8100/health
curl http://localhost:8100/metrics
```

> **Note:** `npm run dev` starts the other infrastructure containers but *not* `bayesian-service` — start it explicitly as above, and set `ENABLE_BAYESIAN_INFERENCE=true` for the Node monitor to use it.

## The Second Engine: Noisy-OR Alert Storm RCA

A separate model — `AlertCorrelationEngine` in [models.py](../../bayesian-service/app/models.py) — for analyzing alert storms: when multiple alerts fire during an incident,
the system learns which alert is the **harbinger** (root cause) vs. cascading symptoms.

### How It Works

1. **Training**: Feed historical alert incidents (co-occurring alerts + labeled root cause)
2. **Learning**: Builds a Noisy-OR Bayesian Network from co-occurrence patterns and temporal ordering
3. **Inference**: Given currently-firing alerts, ranks probable root causes by posterior probability

### Autonomous Poller — the Model That Trains Itself

The alert-correlation engine needs no manual training in practice. [poller.py](../../bayesian-service/app/poller.py) runs an `AutonomousPoller` as a background asyncio task inside the FastAPI app. Every 30 seconds (`POLL_INTERVAL_SECONDS`, default 30) it:

1. Fetches all alerts from Alertmanager's v2 API
2. Enriches them with exemplar trace IDs from Prometheus `/api/v1/query_exemplars` (nearest exemplar within ±5 minutes of the alert firing)
3. Splits firing vs. resolved alerts
4. Clusters newly-resolved alerts into incidents using a 5-minute time window and **auto-trains** the Noisy-OR model on incidents it hasn't seen before (remembering the last 500 incident IDs)
5. **Auto-infers** whenever ≥ 2 alerts are firing (a potential storm) and caches the ranked result, served at `GET /alert-rca`

No human labeling is required: root-cause attribution comes from temporal ordering within each resolved incident — the alert that fired first earns the harbinger prior.

### Noisy-OR Model

For each candidate root cause `c` given observed alerts:

```
P(c | alerts) ∝ P_prior(c) × ∏ P(symptom | c)
```

- **Prior**: Laplace-smoothed historical root cause frequency × temporal bonus (first-to-fire gets 2× weight)
- **Likelihood**: `P(symptom | root_cause) = (co_count + 0.5) / (rc_count + 1.0)` (Laplace smoothed)
- **Leak probability**: 0.05 for never-seen-together pairs

### Exemplar Enrichment

Alerts based on metrics with exemplars (e.g., `http_request_duration_seconds`) are enriched
with the **traceId** of the request that triggered the alert, via the Prometheus exemplars API.

```
Alert fired → metric selector → Prometheus /api/v1/query_exemplars → traceId → trace context
```

This closes the loop: **alert → metric → exemplar → trace → root cause service**.

### API Endpoints

```bash
# Train from historical alert incidents
curl -X POST http://localhost:8100/train-alerts \
  -H "Content-Type: application/json" \
  -d '{"incidents": [...]}'

# Infer root cause from current alerts
curl -X POST http://localhost:8100/infer-alerts \
  -H "Content-Type: application/json" \
  -d '{"alerts": [...]}'
```

### Example Output

```json
{
  "probable_root_causes": [
    {
      "alert_key": "HighLatencyP99:krystalinex",
      "alertname": "HighLatencyP99",
      "service": "krystalinex",
      "probability": 0.9986,
      "evidence": "Root cause in 2 prior incident(s); Fired first 4 time(s)",
      "trace_id": "abc123def456"
    }
  ],
  "incident_size": 3,
  "model_incidents_learned": 3
}
```

### MCP Tools

- `alert_rca` — Analyze currently-firing alerts to identify probable root cause
- `alert_rca_train` — Train the model from Alertmanager history

## Kubernetes

The service is deployed via the Helm chart in [k8s/charts/krystalinex/](../../k8s/charts/krystalinex/):
- `templates/deployment-bayesian-service.yaml` — Deployment + Service
- `values.yaml` → `bayesianService.enabled: true` (port 8100, 2Gi memory limit)
- Prometheus scrape target auto-configured when enabled
- Server pod gets `BAYESIAN_SERVICE_URL` and `ENABLE_BAYESIAN_INFERENCE` env vars injected (`templates/deployment-server.yaml`)

---

*Previous: [04 — LLM Fine-Tuning Guide](04_FINE_TUNING.md) · Next: [06 — On-Call Quick Guide](06_TRACING_ONCALL.md)*

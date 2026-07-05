# Krystaline — Demo Script

> **Duration:** ~23 minutes (30+ with Q&A)  
> **Audience:** Fintech CTOs, observability architects, technical presenters who already know the stack — terse cue cards, no narration  
> **Environment:** Live at [krystaline.io](https://www.krystaline.io)  
> **Role in the demo arc:** the condensed technical run-through. The canonical investor script (full narration, Q&A, recovery playbook) is [product/04_INVESTOR_DEMO_SCRIPT.md](product/04_INVESTOR_DEMO_SCRIPT.md); the self-serve localhost version is [product/03_DEMO_WALKTHROUGH.md](product/03_DEMO_WALKTHROUGH.md)  
> **Core thesis:** *"Other exchanges say 'trust us.' We say 'verify it yourself.'"*

---

## Pre‑Demo (5 min before)

```bash
# Warm the trace pipeline
curl -X POST https://www.krystaline.io/api/v1/monitor/recalculate
# Execute 3–5 trades via the UI to populate recent traces
```

Open tabs in order:

| # | URL | Purpose |
|---|-----|---------|
| 1 | `krystaline.io` | Landing page |
| 2 | `krystaline.io/jaeger/` | Distributed traces |
| 3 | `krystaline.io/grafana/` | Unified dashboard |
| 4 | `krystaline.io/monitor` | Anomaly detection + AI |
| 5 | `krystaline.io/transparency` | ZK proofs |
| 6 | `krystaline.io/alertmanager/` | Alert routing |
| 7 | MCP client (Claude Desktop / Copilot) connected to `otel-mcp-server` | Ask the Exchange (Act 8) |

---

## Act 1 — The Problem (2 min)

*No screen sharing yet. Conversational.*

Three problems every financial platform faces:

1. **Regulation** — SEC/CFTC demand audit trails. Most platforms reconstruct them after the fact.
2. **Institutional trust** — Hedge funds and prime brokers demand proof of execution quality. "Trust us" doesn't work post‑FTX.
3. **Operational risk** — When something breaks at 2am, how fast can you diagnose it? Most teams: 30+ minutes. With AI diagnosis: 2 seconds.

> "We built an exchange where the observability IS the product."

---

## Act 2 — Landing Page (2 min)

*Show tab 1: `krystaline.io`*

Point out:
- **Live system status** badge (pulsing green dot, seconds since last update)
- **Real performance metrics** — P50/P95/P99 latencies from OpenTelemetry, not benchmarks
- **100% transaction coverage** — every trade generates 17+ spans, no sampling
- **"Don't Trust. Verify."** — this is the engineering philosophy, not marketing

> "These numbers update in real time from production telemetry. Nothing is mocked."

---

## Act 3 — Trade Execution (3 min)

*Register or log in, navigate to `/trade`*

1. Show **live Binance price feed** (WebSocket, updates every few seconds)
2. Execute a **BUY 0.001 BTC** order
3. Point to the **toast notification** with the Jaeger trace link
4. Explain the pipeline: Browser → Kong Gateway → Express API → RabbitMQ → Order Matcher → PostgreSQL

> "That trade just traversed 4 microservices. Every hop is a span. Let's look at the trace."

---

## Act 4 — The Distributed Trace (5 min)

*Open tab 2: Jaeger. Find the trade's trace.*

### 4A: Waterfall diagram
- Show the waterfall — typically 17+ spans on the full RabbitMQ trade path (observed in demo traces)
- Walk through: Kong auth → Express validation → RabbitMQ publish → Matcher processing → wallet update
- Highlight **W3C Trace Context** propagating through RabbitMQ message headers

### 4B: Span attributes
- Click into `order.match` span
- Show structured business context: `order.pair: BTC/USD`, `order.side: buy`, `order.price`, `enduser.id`
- This is not just infrastructure data — it's **business‑level observability**

### 4C: Grafana correlation
*Switch to tab 3: Grafana*
- Show the **Unified Observability Dashboard** (73 panels, 79 PromQL query targets)
- Point to exemplar dots on latency charts — click one to jump to the full trace
- Show **SLO panel**: 99.9% availability target, error budget remaining, burn rate

> "Metrics, traces, and logs unified through a single trace ID. Click any data point and get the full story."

---

## Act 5 — Anomaly Detection + AI (5 min)

*Switch to tab 4: `/monitor`*

### 5A: Time‑aware baselines
- 168 time buckets (7 days × 24 hours) per span key — two‑pass mean/variance with Bessel's correction
- Trade amounts get their own baseline: Welford's online algorithm — single‑pass, numerically stable — powers whale detection (3–7σ ladder)
- The system learns that Monday 9am traffic ≠ Sunday 3am

### 5B: AI diagnosis
- Find an anomaly (or reference a recent one)
- Click **Analyze** — watch the LLM stream in real time
- Output: `SUMMARY / CAUSES / RECOMMENDATIONS / CONFIDENCE`
- Llama 3.2:1B, LoRA fine‑tuned on this infrastructure's patterns
- **Feedback loop**: 👍/👎 ratings → stored as training examples → LoRA retraining pipeline (`scripts/retrain-model.sh`, run on demand; scheduled retraining is [BACKLOG])
- **The LLM never pages anyone** — Alertmanager/GoAlert page deterministically; the AI writes the first draft (its analysis is written back into the firing alert's annotations — [`server/monitor/alertmanager-notifier.ts`](../server/monitor/alertmanager-notifier.ts)), humans decide

> "Two seconds to get a structured root‑cause analysis that would take an SRE 30 minutes."

### 5C: Bayesian beat (1 min)
- Scroll to the **Bayesian Inference** panel on `/monitor` — per‑service posterior probability of anomaly, with evidence for likely root causes
- Or via API: `GET /api/v1/monitor/bayesian/insights` (alert RCA: `GET /api/v1/monitor/bayesian/alert-rca`)
- Under the hood: hierarchical PyMC latency model + Noisy‑OR alert correlation, auto‑trained every 30 s from resolved incidents
- *Local runs:* `npm run dev` does not start this container — `docker compose up bayesian-service` first

---

## Act 6 — Self‑Healing (2 min)

*Explain the closed‑loop control architecture:*

| Stage | Trigger | Automated Action |
|-------|---------|------------------|
| 1 | Feed stale 15s | Reconnect WebSocket |
| 2 | Feed stale 30s | Failover to secondary provider |
| 3 | Feed stale 45s | Reconnect all providers |
| 4 | Feed stale 60s | K8s pod restart via liveness probe |

- Alertmanager webhook → auto‑remediation service
- `NoTraffic` alert pings the site to self‑resolve
- **Business‑aware liveness**: `/health` checks tick freshness, not just process alive

> "The system detects, diagnoses, AND remediates — before a human even sees the alert."

---

## Act 7 — Cryptographic Proofs (2 min)

*Switch to tab 5: `/transparency`*

- Show **ZK proof statistics**: total proofs, verification rate, proving time (a 2026‑07‑05 benchmark against the committed circuit artifacts: 129–152 ms warm proving, 12–20 ms verification, 724‑byte proof)
- Every trade produces a **Poseidon commitment** binding: price, quantity, user, timestamp, trace ID
- **Solvency proofs** generated every 60 seconds — the Groth16 proof is verified server‑side and the public endpoint publishes the Poseidon commitment, without revealing individual balances
- Public verification API: `GET /api/public/zk/verify/:tradeId`

> "You can verify any trade with 30 lines of JavaScript. No trust required."

---

## Act 8 — Ask the Exchange (2 min)

*Switch to tab 7: the MCP client connected to `otel-mcp-server` (32 read‑only tools across 7 skills, v1.2.0; the embedded server via `npm run mcp` exposes 28).*

Everything shown so far — traces, metrics, proofs — is also exposed to AI agents over MCP, and the demo closes the loop live. Ask **"why is P99 elevated?"** and narrate the chain as it happens: the agent calls `traces_search` to pull slow traces from Jaeger, then `trace_get` to walk the span waterfall, and answers from spans — not vibes. Then ask **"verify my last trade"**: the agent calls `zk_proof_verify`, which hits `GET /api/public/zk/verify/:tradeId`, and the same real `snarkjs.groth16.verify()` verdict from Act 7 comes back to the agent. "Verify, don't trust" extends to machines. Extended playbook of 20 questions: [MCP_TOP_20_QUESTIONS.md](MCP_TOP_20_QUESTIONS.md).

---

## Act 9 — The Moat (2 min)

*No screen sharing. Direct.*

Five capabilities no other platform combines:

1. **Distributed tracing** — typically 17+ spans on the full RabbitMQ trade path, full W3C context, exemplar correlation
2. **Autonomous anomaly detection** — time‑aware baselines (two‑pass, Bessel‑corrected), Welford‑based whale detection, real‑time WebSocket
3. **AI diagnosis** — fine‑tuned local LLM, continuously improving from operator feedback
4. **Bayesian inference** — hierarchical probabilistic model for uncertainty‑aware root‑cause ranking (demoed in Act 5C)
5. **Cryptographic verification** — Groth16 zk‑SNARK proofs on every trade + solvency, verifiable by humans (Act 7) and agents (Act 8)

This is architectural depth, not a feature checklist. 12–18 months to replicate.

---

## Common Questions

| Question | Answer |
|----------|--------|
| Is this real data? | Yes — live Binance WebSocket, real order matching, real PostgreSQL. Only starter balance is simulated. |
| How many spans per trade? | Typically 17+ on the full RabbitMQ trade path (observed in demo traces), with structured business attributes |
| What if the LLM is wrong? | Confidence levels shown. Bad ratings feed into LoRA fine‑tuning — retraining runs on demand (`scripts/retrain-model.sh`); scheduled retraining is [BACKLOG]. |
| Can you fake a ZK proof? | No — Groth16 is cryptographically secure. Verification key is public. |
| What's your uptime SLA? | 99.9% (43 min error budget/month). Multi‑window burn rate alerting (Google SRE model). |
| How does this scale? | K8s HPA, OTEL Collector with tail‑based sampling (100% errors, 10% normal), async ZK proofs. |

---

## If Something Goes Wrong

| Issue | Recovery |
|-------|----------|
| Landing page shows "0 Traces" | Execute a trade first — traces populate in 5–10s |
| Jaeger empty | Traces propagate in 5–10 seconds after trade execution |
| LLM slow on first analysis | Model cold‑loads in 1–2 min. Second analysis is instant. |
| No anomalies visible | System is healthy. Show historical analysis or explain that's the goal. |
| RabbitMQ down | Orders are rejected fast with a clear error ("Order matching service unavailable") — fail-fast plus circuit breaker, no fallback. Restart RabbitMQ (`docker compose up -d rabbitmq`) and retry |

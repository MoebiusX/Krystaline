# Krystaline Demo Walkthrough — Self-Serve (localhost)

> **Purpose:** Step-by-step, self-serve tour of "Proof of Observability" on your own machine  
> **Audience:** Engineers and evaluators who cloned the repo — no presenter required  
> **Duration:** ~15 minutes (the first trade lands in 5 — the same path as the README's [See It in Five Minutes](../../README.md#see-it-in-five-minutes))  
> **Updated:** 2026-07-05  
> **Environment:** Local dev stack via `npm run dev`  
> **Role in the demo arc:** the self-serve localhost walkthrough. The canonical investor demo is [04_INVESTOR_DEMO_SCRIPT.md](04_INVESTOR_DEMO_SCRIPT.md); the condensed presenter cue cards are [../DEMO.md](../DEMO.md)

---

## Setup (5 minutes)

```bash
git clone https://github.com/MoebiusX/Krystaline.git
cd Krystaline
npm install --legacy-peer-deps
npm run dev   # Docker Desktop must be running; this starts 21 compose services + API + matcher + Vite
```

No manual `docker compose up` needed — `npm run dev` orchestrates the
infrastructure itself, waits for Kong/RabbitMQ/Postgres health, then starts the
API, the matcher, and Vite.

### Local URLs

| Service | URL | Notes |
|---------|-----|-------|
| **App** | http://localhost:5173 | |
| **MailDev** | http://localhost:1080 | Email verification inbox |
| **Jaeger** | http://localhost:16686 | |
| **Grafana** | http://localhost:3000 | admin/admin |
| **Prometheus** | http://localhost:9090 | |
| **Alertmanager** | http://localhost:9093 | |
| **GoAlert** | http://localhost:8081 | |
| **Bayesian API** | http://localhost:8100 | Optional: `docker compose up bayesian-service` — the one container `npm run dev` does not start |

### Optional Warm-up

```bash
# Recalculate baselines so the monitor page has fresh data
curl -X POST http://localhost:5000/api/v1/monitor/recalculate
```

---

## Demo Flow

### Act 1: The Promise (1 min)

**Navigate to:** http://localhost:5173 (Landing Page)

**What You'll See:**
- "Proof of Observability" headline
- Live system status badge
- Performance metrics (P50, P95, P99)
- 100% Transaction Coverage indicator

**Why This Matters:**
> Unlike traditional exchanges where your trade disappears into a black box, every metric here comes from real OpenTelemetry instrumentation — and in the next few minutes you'll trace and cryptographically verify your own trade.

**Known Issues to Avoid:**
- ⚠️ "Traces Collected: 0" if no trades yet — execute a trade first
- ⚠️ Some font sizes are inconsistent — cosmetic only

---

### Act 2: User Onboarding (3 min)

**Step 1: Register**
- Click "Start Trading" → `/register`
- Enter any email + password (the email never leaves your machine)
- Submit → "Check your email"

**Step 2: Verify Email**
- Open [MailDev](http://localhost:1080) — the local inbox catches everything
- Find the verification email, copy the 6-digit code

**Step 3: Complete Verification**
- Back to the app → Enter code
- Success → Redirected to login

**Step 4: Login**
- Enter credentials
- JWT tokens stored → Redirected to `/portfolio`

**Why This Matters:**
> Real email verification, real JWT tokens with refresh logic, real password hashing with bcrypt — this isn't a mockup.

---

### Act 3: Portfolio Overview (1 min)

**On `/portfolio` (My Wallet):**

**What You'll See:**
- Total balance in USD (calculated with real Binance prices)
- Individual asset cards: BTC, ETH, USDT, USD
- Quick action buttons: Deposit, Withdraw, Convert, Trade
- Real-time price updates every few seconds

**Why This Matters:**
> The prices update live over a WebSocket connection to Binance, not fake data. The balance is stored in PostgreSQL with proper transaction integrity. (Only the starter balance is simulated.)

---

### Act 4: Execute a Trade (2 min)

**Navigate to:** `/trade` (Dashboard)

**Step 1: Review the Interface**
- Current BTC/USD price (from Binance)
- Buy/Sell toggle
- Quantity input
- Wallet balance display

**Step 2: Execute a Buy Order**
1. Select "BUY"
2. Enter quantity: `0.001` BTC
3. Click "Place Order"
4. Watch for the toast notification

**What Happens Behind the Scenes:**
```
Browser → Kong Gateway → Express API → RabbitMQ → Order Matcher → PostgreSQL
   ↓           ↓              ↓            ↓              ↓            ↓
 [Span]     [Span]         [Span]       [Span]        [Span]       [Span]
```

**Step 3: Note the Trace Link**
- The success toast and the trade-verified modal both deep-link to your trade's trace
- Every row on the `/activity` page links its `traceId` to Jaeger
- This is the **Proof of Observability** moment — keep the `tradeId` handy for Act 8

---

### Act 5: The Transparency Reveal (3 min)

**Option A: Click the Trace Link in the Toast**
Opens Jaeger directly to this trade's trace

**Option B: Open Jaeger Manually**
- Navigate to: http://localhost:16686
- Service: `kx-exchange` (or `kx-wallet` to start from your own browser's span)
- Click "Find Traces"
- Select the most recent trace

**What to Look For in Jaeger:**

1. **Trace Overview**
   - The trace waterfall — typically 17+ spans on the full RabbitMQ trade path (observed in demo traces)
   - The first span, `order.submit.client`, comes from your own browser — the frontend is a traced service (`kx-wallet`)
   - Total duration in milliseconds

2. **Span Breakdown**
   | Span | What It Shows |
   |------|---------------|
   | `order.submit.client` | The click, traced from your browser |
   | `POST /api/v1/orders` | The request through Kong into the API |
   | `pg.query` | Database operations |
   | `publish orders` | Message to RabbitMQ (dual W3C context headers) |
   | `order.match` | Order matching in the separate `kx-matcher` service |
   | `pg.query` (wallet balance UPDATEs) | Balance changes — auto-instrumented pg spans, no manual settlement span |
   | `zk.prove` | Proof generation, inside the same trace |

3. **Drill Into a Span**
   - Click any span
   - Attributes: `order.pair`, `order.side`, `http.method`, `db.statement`
   - Timing breakdown per operation

**Why This Matters:**
> Every database query, every message, every service hop — fully traced, stitched across the async RabbitMQ hop back into one trace. If there was ever a dispute, the full path of any transaction is auditable. This is OpenTelemetry, the CNCF standard — not proprietary tooling.

---

### Act 6: System Transparency (1 min)

**Navigate to:** `/transparency`

**What You'll See:**
- System status by component
- Service health indicators
- Response time percentiles
- Active anomaly count

**Why This Matters:**
> This is not a status page someone updates by hand — it's derived from live telemetry, and the same data is exposed unauthenticated at `/api/public/*`.

---

### Act 7: Advanced Monitoring (2 min)

**Navigate to:** `/monitor`

**What You'll See:**
- Anomaly detection with severity levels (SEV1–5, a 3σ–8σ ladder with at least 10 samples per baseline)
- Baseline calculations per operation (168 time buckets: 7 days × 24 hours)
- LLM-powered "Analyze" button
- WebSocket streaming for real-time alerts
- The **Bayesian Inference** panel — per-service posterior probability of anomaly (needs the optional `bayesian-service` container from Setup)

**Try the LLM Analysis:**
1. Find any anomaly or slow trace
2. Click "Analyze"
3. Watch the streaming analysis from Ollama (first analysis cold-loads the model, 1–2 min; after that it's fast)
4. Read the structured output: summary, causes, recommendations, confidence

**Why This Matters:**
> The LLM runs locally on Ollama — no telemetry leaves your machine. And note the boundary: the LLM never pages anyone. Alertmanager/GoAlert page deterministically; the AI writes the first draft — its analysis is written back into the firing alert's annotations ([`server/monitor/alertmanager-notifier.ts`](../../server/monitor/alertmanager-notifier.ts)) — and humans decide.

---

### Act 8: Verify Your Trade Cryptographically (3 min)

This is the closer: the trade you made in Act 4 has a zero-knowledge integrity
proof, and you can check the math yourself — no account or API key required.

**Step 1: Grab the `tradeId`**
- From the trade toast, the trade-verified modal, or the `/activity` row of your Act 4 trade

**Step 2: Fetch the Proof**
```bash
curl -s http://localhost:5000/api/public/zk/proof/<tradeId> | jq
```
- Returns the Groth16 proof, the public signals `[tradeHash, priceLow, priceHigh]`, and the verification key

**Step 3: Verify It**
```bash
curl -s http://localhost:5000/api/public/zk/verify/<tradeId> | jq
```
- The server runs a real `snarkjs.groth16.verify()` against the committed verification key and returns the mathematical verdict
- Prefer not to trust the server? Step 2 gave you everything needed to run `snarkjs.groth16.verify()` yourself, in ~30 lines of JavaScript

**What the Math Guarantees:**
- Your fill price was within ±0.5% of the Binance reference price (`priceLow`/`priceHigh` are the public range)
- The `tradeHash` is a Poseidon commitment over fill price, quantity, user ID, timestamp, **and the OTel `traceId`** — the same trace you opened in Act 5, so the proof is cryptographically bound to the trace; swap the trace and the proof fails
- The circuit is 977 wires with a committed proving key in [`server/circuits/build/`](../../server/circuits/build/); a 2026-07-05 benchmark against those artifacts measured 129–152 ms warm proving, 12–20 ms verification, on a 724-byte proof

**If the proof isn't there yet:** proof generation is fire-and-forget after the
fill and never blocks the trade — wait a few seconds and re-fetch.

**Bonus — ask an AI to do all of this:**
> Point an MCP client (Claude Desktop, Copilot) at [`otel-mcp-server/`](../../otel-mcp-server/README.md) — or run `npm run mcp` for the embedded server — and ask *"verify my last trade"*. The agent chains `traces_search` → `trace_get` → `zk_proof_verify` against the same endpoints you just curled. Extended playbook: [../MCP_TOP_20_QUESTIONS.md](../MCP_TOP_20_QUESTIONS.md).

---

## Handling Common Questions

### "Is this real data?"
> "Yes. Prices come from Binance WebSocket. Trades go through a real order matching engine. PostgreSQL stores everything. Only the starter balance is simulated."

### "How many spans per transaction?"
> "Typically 17+ spans on the full RabbitMQ trade path (observed in demo traces), covering: API Gateway, authentication, validation, database reads, message queue, order matching, balance updates — and the zk proving pipeline inside the same trace."

### "What if there's an anomaly?"
> "Show `/monitor`. The system detects slowdowns automatically, calculates severity on a 3σ–8σ ladder, and can use a local LLM to draft the root-cause analysis. Paging stays deterministic via Alertmanager/GoAlert."

### "Can users see their own traces?"
> "Yes — that's the whole point. Every confirmation includes a link to Jaeger. Full transparency."

### "Can I verify a trade without trusting the server?"
> "Yes. `GET /api/public/zk/proof/:tradeId` returns the proof, public signals, and verification key — verify locally with the open-source `snarkjs` library."

---

## Known UI Issues (For Internal Reference)

These exist but shouldn't derail the walkthrough:

| Issue | Location | Workaround |
|-------|----------|------------|
| Font size inconsistency | Landing page metrics | Cosmetic only |
| "0 Traces" on first load | Landing page | Execute a trade first |
| P50/P95/P99 all show zeros | Fresh install | Show after some trades |
| Conversion to portfolio routing | After login | Expected behavior |

---

## Reset Between Runs

```bash
# Recalculate baselines for fresh metrics
curl -X POST http://localhost:5000/api/v1/monitor/recalculate
```

For a truly clean slate, stop `npm run dev`, run `docker compose down -v`, and start again.

---

## Backup: If Things Go Wrong

### Kong Not Routing
```bash
node scripts/enable-kong-otel.js
node scripts/enable-kong-cors.js
```

### No Prices Showing
- Check the Binance WebSocket in server logs
- Fallback: prices will show as 0 — connectivity issue, not a bug

### Jaeger Empty
- Traces may take 5–10 seconds to appear
- Refresh Jaeger, extend the time range

### RabbitMQ Not Connected
- Orders are rejected with a clear "Order matching service unavailable" error — [`order-service.ts`](../../server/core/order-service.ts) checks the RabbitMQ connection before publishing; there is no synchronous fallback
- The circuit breaker (opens after 3 consecutive failures) keeps rejections fast instead of letting requests pile up
- Restart RabbitMQ (`docker compose up -d rabbitmq`) and retry

---

## Appendix: Running Against the Live Lab

The same walkthrough works against the Kubernetes deployment at
`https://www.krystaline.io` — substitute the origin and note that the
observability endpoints sit behind nginx basic auth (see `values-secrets.yaml`
for credentials):

| Service | URL | Auth Required |
|---------|-----|---------------|
| **App** | https://www.krystaline.io | No |
| **Grafana** | https://www.krystaline.io/grafana/ | Yes (nginx + Grafana) |
| **Jaeger** | https://www.krystaline.io/jaeger/ | Yes |
| **Prometheus** | https://www.krystaline.io/prometheus/ | Yes |
| **Alertmanager** | https://www.krystaline.io/alertmanager/ | Yes |
| **GoAlert** | https://www.krystaline.io/goalert/ | Yes |

Redeploy, if needed:
```powershell
helm upgrade kx k8s/charts/krystalinex -f k8s/charts/krystalinex/values-local.yaml -f k8s/charts/krystalinex/values-secrets.yaml -n krystalinex
```

---

*This walkthrough demonstrates real functionality, not mockups. Everything above runs from a fresh `git clone`.*  
*Updated 2026-07-05*

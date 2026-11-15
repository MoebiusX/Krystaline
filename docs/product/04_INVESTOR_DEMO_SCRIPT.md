# Krystaline — Investor Demo Script

> **Purpose:** Curated presenter script for investor meetings — the canonical investor demo  
> **Duration:** 25–30 minutes (expandable to 40 with Q&A)  
> **Audience:** Regional lead investor + technical advisors — full narration, Q&A prep, and recovery playbook  
> **Environment:** Live at `www.krystaline.io` (Kubernetes)  
> **Role in the demo arc:** the canonical investor demo. Condensed technical cue cards: [../DEMO.md](../DEMO.md). Self-serve localhost version: [03_DEMO_WALKTHROUGH.md](03_DEMO_WALKTHROUGH.md). Extended MCP playbook: [../MCP_TOP_20_QUESTIONS.md](../MCP_TOP_20_QUESTIONS.md)  
> **Updated:** 2026-07-05

---

## Narrative Arc

```
COLD OPEN  Verify First      (1 min)   curl one trade's Groth16 verdict — before any story
ACT 1  The Problem           (3 min)   Why exchanges fail at trust
ACT 2  The Promise           (2 min)   Proof of Observability landing page
ACT 3  Real Platform         (3 min)   Login → Trade (registration happens in setup)
ACT 4  The Complete Picture  (5 min)   Tracing + Exemplars + Logs = audit trail
ACT 5  Automated Detection   (4 min)   Anomaly detector catches what humans miss
ACT 6  AI Diagnosis          (3 min)   LLM-powered root cause in plain English
ACT 7  Cryptographic Trust   (3 min)   ZK proofs — verify, don't trust
ACT 8  Ask the Exchange      (3 min)   An AI agent interrogates the platform over MCP
ACT 9  The Moat              (2 min)   Why this is defensible + the ask
```

**Core thesis:** *"Other exchanges say 'trust us.' We say 'verify it yourself.'"*

---

## Pre-Demo Setup (15 min before)

### 1. Warm the Pipeline

```bash
# Recalculate baselines so metrics are fresh
curl -X POST https://www.krystaline.io/api/v1/monitor/recalculate

# Execute 5–10 test trades to populate traces
# (Use the pre-registered demo account from step 2)
```

### 2. Register the Demo Account (registration is setup, not showtime)

- Navigate to `/register` → `investor-demo@krystaline.io` / `InvestorDemo2026!`
- Complete the email verification flow, confirm login works, then log out
- Keep one of the warm-up trades' `tradeId` handy — the cold open needs it

Live registration burns ~90 seconds of email-code fumbling. Do it before the
meeting; Act 3 opens with a clean login instead.

### 3. Connect the MCP Client (for Act 8)

- Point Claude Desktop, VS Code Copilot, or any MCP client at `otel-mcp-server`
  (v1.2.0 — 32 read-only tools across 7 skills; locally: `npm run mcp` for the
  embedded 28-tool server)
- Sanity-ask: *"Is the system healthy?"* — it should call `system_health` and
  answer within seconds

### 4. Open Browser Tabs (in order)

| Tab | URL | Purpose |
|-----|-----|---------|
| 1 | `https://www.krystaline.io` | Landing page (Act 2) |
| 2 | `https://www.krystaline.io/login` | Login (Act 3) |
| 3 | `https://www.krystaline.io/jaeger/` | Jaeger traces (Act 4) |
| 4 | `https://www.krystaline.io/grafana/` | Grafana dashboards (Act 4) |
| 5 | `https://www.krystaline.io/monitor` | Anomaly monitor (Act 5–6) |
| 6 | `https://www.krystaline.io/transparency` | Transparency page (Act 7) |

Plus: a terminal with a large font (cold open) and the connected MCP client (Act 8).

### 5. Verify Everything Works

```bash
# Health check
curl -s https://www.krystaline.io/api/v1/monitor/health | jq '.status'
# → "healthy"

# ZK stats (should show proof count > 0)
curl -s https://www.krystaline.io/api/public/zk/stats | jq '.totalProofsGenerated'

# Ollama running (for LLM analysis)
curl -s https://www.krystaline.io/api/v1/monitor/model | jq '.model'
# → "llama3.2:1b"
```

---

## The 60-Second Cold Open — Verify First

> **Action:** Before any narrative. Terminal open, font large. Use a `tradeId`
> from a warm-up trade (the trade toast, `/activity`, or `GET /api/public/trades`).

```bash
curl -s https://www.krystaline.io/api/public/zk/verify/<tradeId> | jq
```

### What to Say

> "Before I tell you anything, let me show you the only thing that matters.
> This is a real trade on our exchange, and this" — *[point at the verdict]* —
> "is its zero-knowledge integrity proof being verified right now. The server
> just ran a real `snarkjs.groth16.verify()` against a committed verification
> key. That's not a status flag someone set — it's a mathematical verdict, and
> the endpoint is public. No account, no API key, no trust."
>
> "Everything in the next twenty-five minutes exists to make that one HTTP
> response possible. Our thesis in one line: financial infrastructure should be
> verifiable **before** it asks anyone to trust it."

*[Close the terminal. Now start the story.]*

---

## ACT 1 — The Problem (3 minutes)

> **Setup:** No screen sharing yet. Start with a conversation.

### What to Say

> "Before I show you anything, let me ask a question. When you buy Bitcoin on Coinbase, or Kraken, or any exchange — what actually happens to your order?"
>
> *[Pause for response]*
>
> "You click 'Buy,' and a few seconds later it says 'Filled.' But what happened in between? What route did your order take through their systems? Did it execute at the best possible price? Was there a latency spike that affected your fill? You have absolutely no way to know."
>
> "This is the fundamental problem in crypto infrastructure: **opacity**. Every exchange is a black box. You send money in, you get a fill price out, and you have to trust that everything in between was handled correctly."
>
> "Now, this matters for three reasons:
>
> **First, regulation.** The SEC and CFTC are cracking down on exchanges that can't prove fair execution. FTX collapsed because nobody could verify what was actually happening inside.
>
> **Second, institutional adoption.** Hedge funds and asset managers won't put serious capital into a platform they can't audit. They need the same level of transparency they get from traditional brokers.
>
> **Third, operational risk.** When something goes wrong at 2am — a latency spike, a database timeout, a message queue backup — most exchanges discover it from customer complaints on Twitter. By then, the damage is done."
>
> "We built Krystaline to solve all three of these problems at once. Let me show you."

---

## ACT 2 — The Promise (2 minutes)

> **Action:** Switch to Tab 1 — `www.krystaline.io` (Landing Page)

### What You'll See

- **"Proof of Observability"** headline
- Live system status badge (Operational / Degraded)
- Performance metrics (P50, P95, P99 response times)
- "100% Transaction Coverage" indicator

### What to Say

> "This is Krystaline. The first thing you'll notice is this headline: **Proof of Observability**. That's not marketing — it's our core technical architecture."
>
> "See these numbers? P50: 12ms, P95: 45ms, P99: 243ms. Those aren't benchmarks from a slide deck. They're calculated in real-time from production OpenTelemetry instrumentation — the same standard used by Google, AWS, and every major cloud provider."
>
> "And this: **100% Transaction Coverage**. Every single trade that goes through our system generates a complete distributed trace — typically 17+ spans on the full RabbitMQ trade path (observed in demo traces) — that you can inspect yourself. Not a sample. Not a summary. Every one."
>
> "Let me prove it."

---

## ACT 3 — A Real Platform (3 minutes)

> **Action:** Switch to Tab 2 — Log in with the demo account you registered
> during setup

### Step 1: Log In

- Navigate to `/login`
- Enter: `investor-demo@krystaline.io` / `InvestorDemo2026!`
- Redirected to `/portfolio`

### What to Say

> "I created this account before you arrived, through the same flow every user
> gets: real email verification, real JWT authentication with refresh tokens,
> real bcrypt password hashing at cost factor 12. Registration is
> production-grade and boring to watch — which is exactly why I didn't make you
> watch it. What's not boring is what happens when we trade."

### Step 2: Execute a Trade

- Navigate to `/trade`
- Point out: "That price — $XX,XXX — is live from Binance's WebSocket feed. Updated every 3 seconds."
- Select **BUY**, enter `0.001` BTC
- Click **Place Order**
- Watch for the success toast

> "The order just went through our full pipeline: Kong API Gateway → Express API → RabbitMQ message queue → Order Matcher microservice → PostgreSQL. Five services, real message passing, real database transactions."
>
> *[Point to toast notification]*
>
> "See that trace link? That's where things get interesting."

---

## ACT 4 — The Complete Picture (5 minutes)

> **This is the core demo moment. Take your time here.**

### 4A: The Distributed Trace

> **Action:** Click the trace link in the toast, or switch to Tab 3 (Jaeger)

### What You'll See

- A waterfall diagram — typically 17+ spans on the full RabbitMQ trade path (observed in demo traces)
- Each span represents one operation in one service
- Total trace duration in milliseconds

### What to Say

> "This is the trade you just made. Every colored bar is a real operation that happened inside our infrastructure."
>
> *[Point to spans one by one]*
>
> "Here's the request hitting our API gateway — Kong — that's this first span. It does rate limiting, authentication, CORS — all before your request even reaches our code."
>
> "Then it hits our Express API. You can see the POST to `/api/v1/orders`. Notice the timing — 3 milliseconds for validation."
>
> "Now here's where it gets interesting. This span — `publish orders` — is your order being published to RabbitMQ. And this span below it — `order.match` — that's our order matching engine, running in a completely separate microservice, picking up your order from the queue and finding a match."
>
> "Notice the trace ID at the top. It's the same across all of these services. That's W3C Trace Context — an open standard — propagating through HTTP headers and message queue headers so every operation is linked into one story."

### 4B: Drill Into a Span

> **Action:** Click on one span (e.g., `order.match`)

> "Let me click into this span. See the attributes? `order.pair: BTC/USD`, `order.side: buy`, `order.price: 42,755.21`. Every business detail is captured as structured data, not just a log line."
>
> "And this attribute — `enduser.id` — tells us which user initiated this trade. So if there's ever a dispute, a regulator can trace exactly what happened, from button click to database write, in milliseconds."

### 4C: Exemplars — Metrics Linked to Traces

> **Action:** Switch to Tab 4 (Grafana). Open the Unified Observability Dashboard and find the "Request Latency with Exemplars" panel.

> "Here's our Grafana dashboard. See these dots on the latency panel? Those are called **exemplars**. Each dot is a real request, and each one contains a trace ID."

> *[Click an exemplar dot → trace opens inline in Grafana]*

> "I just clicked a single data point on a graph, and Grafana opened the full distributed trace — right here, inline, no need to leave the dashboard. This is Grafana's built-in trace viewer using our Jaeger datasource."
>
> "Most monitoring systems give you metrics OR traces. We give you both, linked together, with exemplars providing the bridge. And because our Jaeger datasource has node graph enabled, you can also see a visual map of which services talked to which."

### 4D: Logs with Trace Context

> "One more thing. Every log line our system produces automatically includes the trace ID and span ID. So if you search our logs for a specific trace, you get the complete story: what was logged, in which service, at what point in the request lifecycle."
>
> "Metrics, traces, and logs — the three pillars of observability — all correlated through a single trace ID. That's what gives you the **complete picture**."

---

## ACT 5 — Automated Detection (4 minutes)

> **Action:** Switch to Tab 5 — `/monitor` (Anomaly Monitoring Page)

### What You'll See

- **Service Health Cards**: Green/Yellow/Red status for each microservice
- **Anomaly List**: Table with severity badges (SEV1–SEV5)
- **Timeline Chart**: Anomalies over the last 24 hours

### What to Say

> "Now, having a complete picture is great — but a human can't watch 17 spans per trade, thousands of trades per day. That's where our anomaly detection comes in."
>
> "This monitor page updates every 10 seconds. Our system is continuously pulling traces from Jaeger, comparing every span's duration against its historical baseline, and flagging anything that deviates."

### 5A: Time-Aware Baselines

> "But here's what makes our system different from simple threshold alerts. We use **time-aware baselines** — 168 buckets per span key, one for each hour of the week."
>
> "Think about it: your exchange handles different traffic at Monday 9am versus Sunday 3am. A 200ms response that's totally normal during peak hours would be alarming at 3am when the system is idle. Our baselines capture that."
>
> "And we deliberately use two different algorithms. Duration baselines are recomputed in a two-pass batch with Bessel's correction, so the variance estimates are unbiased. Transaction **amounts** use **Welford's Online Algorithm** — running mean and standard deviation in a single pass, memory-efficient and numerically stable — because whale detection has to update on every single trade, in real time."

### 5B: Severity Classification

> "When a span deviates from its baseline, we classify it by severity using standard deviations:"

> *[Point to severity badges in the anomaly table]*

> "A SEV5 fires at 3 standard deviations above baseline — unusual, not urgent. A SEV1 needs 8 or more — something is seriously wrong. And no baseline is allowed to fire with fewer than 10 samples behind it, so a cold start can't page anyone."
>
> "But we don't just detect latency anomalies. We also profile **transaction amounts** on their own 3-to-7-sigma ladder. If someone suddenly tries to withdraw 100x their normal amount, our amount anomaly detector flags it immediately — we call it **whale detection**."
>
> "This is fully autonomous. No human sets thresholds. The system learns from its own data."

### 5C: Real-Time Notifications

> "And everything streams to this page in real-time over WebSocket. If an anomaly is detected right now, you'd see it appear here within 10 seconds — not in an email you read 20 minutes later."

---

## ACT 6 — AI Diagnosis (3 minutes)

> **Action:** Stay on `/monitor`. Find an anomaly (or trigger one).

### Triggering an Anomaly (if none exist)

> If the system is healthy, you can trigger a controlled anomaly:
> ```bash
> # Temporarily slow the Jaeger endpoint to create a latency spike
> # Or wait for natural variance — there's usually at least a SEV4/5
> ```

### What to Say

> "So our system detected an anomaly. Now what? In most organizations, this is where someone gets paged, opens a laptop, and starts manually investigating. That takes 15–30 minutes on average."
>
> "Watch this."

> **Action:** Click **"Analyze"** on a detected anomaly (or wait for auto-analysis on SEV1–3)

### What You'll See

- "Analysis in progress..." indicator
- Text streaming in real-time (like ChatGPT)
- Structured output: SUMMARY → CAUSES → RECOMMENDATIONS → CONFIDENCE

### What to Say

> *[As text streams in]*
>
> "What you're seeing right now is our AI analyzing this anomaly in real-time. It's running on **Llama 3.2** — a 1-billion parameter model hosted locally on our infrastructure. No data leaves our systems."
>
> "The AI doesn't just look at the anomaly. It receives the full context: the span attributes, the correlated system metrics — CPU, memory, error rates, connection counts — and the complete trace with all 17 spans."

> *[When analysis completes, read the summary]*

> "See this? It identified the likely cause, gave us three recommendations ranked by priority, and rated its own confidence. This is a structured first-pass triage in ~2 seconds that on-call then verifies — instead of 30 minutes of manual investigation."
>
> "And one boundary we never cross: **the LLM never pages anyone**. Alertmanager and GoAlert page deterministically, from fixed rules. The AI writes the first draft — its analysis is written back into the firing alert's annotations ([`server/monitor/alertmanager-notifier.ts`](../../server/monitor/alertmanager-notifier.ts)) so on-call opens the page with the triage already attached — and humans decide."

### 6A: The Training Loop

> *[Point to the 👍/👎 rating buttons]*

> "But here's the part that makes this a flywheel, not just a feature. See these rating buttons? When our engineers use this in production, they rate whether the analysis was helpful. Bad ratings include a correction — 'here's what you should have said.'"
>
> "Those corrections feed directly into our fine-tuning pipeline. We use **LoRA** — Low-Rank Adaptation — to tune the model on our specific infrastructure patterns. Only 0.4% of the model's parameters are modified. The result? A model that gets smarter about *our* system with every operator correction — the retraining pipeline is one command in the repo — running on commodity hardware. No GPU cluster needed."
>
> "The training data, the fine-tuning configuration, the merged model weights — it's all in our repository. Reproducible, version-controlled AI operations."

---

## ACT 7 — Cryptographic Trust (3 minutes)

> **Action:** Switch to Tab 6 — `/transparency` (Transparency Page)  
> Then navigate to Activity to show ZK proofs.

### 7A: The Transparency Dashboard

> "This page is public. Any user — or any regulator — can see our system status at any time."

> *[Point to the metrics]*

> "Service health, response times, active anomalies — all derived from real telemetry, not a manually updated status page."

### 7B: Zero-Knowledge Proofs

> **Action:** Navigate to Activity page → Find a recent trade → Click "ZK Proof ✓"

### What You'll See

- Trade hash (Poseidon commitment)
- Public signals: `[tradeHash, priceLow, priceHigh]`
- Verification status with timestamp
- Trace ID (links to Jaeger)

### What to Say

> "Now here's our final layer of trust — and this is what makes Krystaline truly unique."
>
> "Every trade that goes through our system generates a **zero-knowledge proof** using the **Groth16 protocol** — the same cryptographic standard used in blockchain privacy systems like Zcash."
>
> "This proof mathematically guarantees five things:"

> *[Count on fingers or point to screen]*

> "**One:** The fill price you received was within 0.5% of the real Binance price — we can't give you a worse price and claim otherwise.
>
> **Two:** The trade quantity matches exactly what was recorded.
>
> **Three:** The user ID is cryptographically bound — we can't attribute your trade to someone else.
>
> **Four:** The timestamp is committed — we can't backdate or alter when the trade happened.
>
> **Five:** The OpenTelemetry trace ID is embedded in the proof — we can't swap it for a different trace."

### 7C: Independent Verification

> "And here's the key: **you don't have to trust us to verify this**. The verification key is public. The proof data is available through our public API. Anyone with a JavaScript runtime and the `snarkjs` library can verify any trade in 30 lines of code."

```
GET /api/public/zk/proof/:tradeId  → Returns proof + public signals + verification key
GET /api/public/zk/verify/:tradeId → Server-side verification (or do it yourself)
```

> "We also generate a **solvency proof** every 60 seconds — a Groth16 proof, verified server-side, that our total reserves are greater than or equal to our liabilities, without revealing any individual user's balance. The public endpoint publishes the Poseidon commitment; the per-trade integrity proofs are the ones anyone can verify independently. That's the 'zero-knowledge' part: we prove the statement is true without revealing the underlying data."

### 7D: The ZK Stats

> **Action:** Show ZK stats (on transparency page or via API)

> "Total proofs generated, average proving time — read it off the live stats; a 2026-07-05 benchmark against the committed circuit artifacts measured 129–152 ms warm proving and 12–20 ms verification, on a 724-byte proof — verification success rate near 100%. And the solvency proof age tells you how recent the latest proof is. It's never more than 60 seconds old."
>
> "Traditional exchanges prove solvency once a year with an accounting firm. We run that check every minute with mathematics — the proof is verified server-side, and the Poseidon commitment is published publicly."

---

## ACT 8 — Ask the Exchange (3 minutes)

> **Action:** Switch to the MCP client you connected during setup (Claude
> Desktop or Copilot pointed at `otel-mcp-server` — 32 read-only tools across
> 7 skills, v1.2.0).

### What to Say

> "One last thing before I step back. Everything you've just seen — the traces,
> the metrics, the proofs — isn't only for humans staring at dashboards. It's
> exposed to AI agents through MCP, the Model Context Protocol. Watch what
> happens when I let an agent interrogate the exchange."

### Question 1: "Why is P99 elevated?"

> **Action:** Type the question into the MCP client. Narrate the tool calls as
> they appear.

> "See what it's doing? It called `traces_search` — that's a live query against
> Jaeger for the slowest recent traces. Now `trace_get` — it's pulling the full
> span waterfall for the worst one. And its answer cites the actual slow span,
> in the actual service. It's answering from spans, not vibes — the same
> evidence a human SRE would use, through governed, read-only tools."

### Question 2: "Verify my last trade."

> **Action:** Ask the second question. Let the verdict land.

> "Now the part I care about most. The agent just called `zk_proof_verify`,
> which hits the same public endpoint I curled in the first sixty seconds —
> `GET /api/public/zk/verify/:tradeId` — and a real `snarkjs.groth16.verify()`
> ran server-side. The agent didn't ask us to vouch for the trade. It checked
> the math itself."
>
> "That's the thesis completing the loop: 'verifiable before it asks anyone to
> trust it' — and *anyone* now includes machines. When your customers' AI
> assistants audit their brokers, we're the exchange that already answers."

> **Fallback:** If the live MCP connection misbehaves, show the extended
> playbook instead: [../MCP_TOP_20_QUESTIONS.md](../MCP_TOP_20_QUESTIONS.md) —
> twenty questions the tools answer, with example transcripts.

---

## ACT 9 — The Moat (2 minutes)

> **Action:** No screen needed. Eye contact with the investor.

### What to Say

> "Let me step back and tell you why this matters as an investment."
>
> "We've combined five technologies that no other exchange has put together:"

> "**First: Distributed tracing** — typically 17+ spans on the full trade path, full audit trail, using the CNCF standard that Google, AWS, and Microsoft are converging on. This isn't proprietary. It's the future of how all software will be instrumented."
>
> "**Second: Autonomous anomaly detection** — time-aware baselines that learn from traffic patterns, whale detection on transaction amounts, real-time WebSocket alerts. No thresholds to configure. No humans to watch dashboards."
>
> "**Third: AI-powered diagnosis** — a locally-hosted LLM that's being fine-tuned specifically on our infrastructure patterns. It gets smarter with every operator correction. The training pipeline is in our repo — reproducible, auditable AI ops."
>
> "**Fourth: Cryptographic verification** — Groth16 zero-knowledge proofs on every trade, publicly verifiable without trusting our infrastructure, plus a solvency proof every 60 seconds — verified server-side, with the Poseidon commitment published publicly."
>
> "**Fifth: Agent-ready access** — the whole evidence layer, traces to proofs, is exposed to AI agents through governed, read-only MCP tools. You just watched an agent verify a trade cryptographically. No other exchange can demo that."

### The Competitive Position

> "Coinbase has brand. Kraken has liquidity. But we're not aware of another exchange that publishes per-trade traces — major exchange status pages show aggregate uptime only. Neither generates a cryptographic proof of fair execution. Neither has an AI that explains anomalies in real-time."
>
> "Our moat is architectural. It's not a feature you bolt on — it's how the system is built from the ground up. A competitor would need 12 to 18 months to replicate this, and by then we'll have 18 months of fine-tuning data making our AI better."
>
> "We have 1,100+ passing automated tests (1,088 in the main suite + 99 in otel-mcp-server), a production Kubernetes deployment, real Binance prices, and every piece of infrastructure as code in our repository. This is production-grade engineering, not a demo."

### The Ask

> "We're raising a Series A to scale operations, add fiat rails, expand to multi-asset trading, and pursue regulatory approval in [target jurisdictions]. The technology is built. The moat is deep. We need capital to capture the market."

---

## Handling Investor Questions

### "Is this real data or simulated?"

> "Everything is real. Prices come from Binance's WebSocket feed. Trades go through a real order matching engine with RabbitMQ message passing. PostgreSQL stores everything with proper transaction integrity. The only thing simulated is the initial wallet balance — we give new users starter funds for the demo."

### "How many spans per transaction?"

> "Typically 17+ spans on the full RabbitMQ trade path (observed in demo traces), covering: API Gateway (Kong), authentication, input validation, database reads/writes, message queue publish/consume, order matching, wallet updates, and ZK proof generation. Every span captures structured attributes — not just timing, but business context like order pair, price, and user ID."

### "What happens if the LLM gives a wrong diagnosis?"

> "Two safeguards. First, every analysis shows a confidence level — low, medium, or high. Low-confidence results are flagged. Second, our engineers rate every analysis with thumbs up/down. Bad ratings with corrections feed into our LoRA fine-tuning pipeline. The model improves continuously from real production feedback."

### "Can you fake a ZK proof?"

> "No. The Groth16 protocol is cryptographically secure under the BN128 elliptic curve. The proving and verification keys are both public — they're committed in our repo. Groth16 soundness doesn't rely on key secrecy: even with the proving key, nobody — including us — can generate a valid proof for a trade that didn't happen with those exact parameters. The math won't allow it."

### "What's your uptime SLA?"

> "We target 99.9% availability — 43 minutes of error budget per month. We use Google's SRE multi-window burn rate alerting: if we're consuming our error budget 14x faster than sustainable, we get a critical alert within 2 minutes. If it's a slow burn at 6x, we get a warning within 15 minutes. We can show you the live burn rate right now in Grafana."

### "How does this scale?"

> "The architecture is microservices on Kubernetes with horizontal pod autoscaling. The tracing pipeline uses the OpenTelemetry Collector with tail-based sampling — we keep 100% of errors and slow traces, and sample 10% of normal traffic. This gives us 80–90% volume reduction while keeping every interesting trace. The ZK proofs are fire-and-forget — they never block the trading path."

### "What about compliance / regulatory?"

> "Our audit trail is immutable — OpenTelemetry traces in Jaeger, security events in PostgreSQL with hash chains for tamper detection, and ZK proofs that cryptographically anchor every trade to its execution details. We export security events to any SIEM via webhook. We have 48 alert rules in 11 groups covering everything from brute force detection to circuit breaker monitoring. And our transparency page gives regulators real-time visibility without needing access to our internal systems."

### "What's the team size?"

> *[Adjust to your actual team]* "We're a small team that punches above our weight because of our engineering philosophy: everything is tested (1,100+ passing automated tests: 1,088 in the main suite + 99 in otel-mcp-server), everything is instrumented (typically 17+ spans per trade path), and everything is automated (anomaly detection, AI diagnosis, ZK proof generation). Our observability infrastructure is itself observable."

---

## Demo Recovery Playbook

### If Landing Page Shows "0 Traces"

> Execute a trade first, then refresh. Say: "Let me warm up the pipeline with a live trade."

### If Jaeger Is Empty

> Traces can take 5–10 seconds to appear. Extend the time range in Jaeger. Say: "The trace is propagating through our collector pipeline."

### If LLM Analysis Is Slow

> First-time model load takes 1–2 minutes. Say: "The model is loading into memory — in production this is always warm, but cold starts take about a minute." Show cached analysis from history while waiting.

### If No Anomalies Exist

> This is actually good! Say: "The system is healthy right now — no anomalies detected. That's the baseline working correctly. Let me show you a historical analysis from our cache." Navigate to Monitor → Analysis History.

### If RabbitMQ Is Down

> Orders are rejected fast with a clear "Order matching service unavailable" error — there is no synchronous fallback, so don't claim one. The circuit breaker (opens after 3 consecutive failures) keeps rejections immediate instead of letting requests hang. Restart RabbitMQ, confirm a trade goes through, then continue. If a rejection happened on screen, say: "Notice the order failed fast with a clear error instead of hanging — fail-fast by design, so the failure is visible and diagnosable, not hidden."

### If ZK Proof Isn't Available Yet

> Proofs are generated asynchronously, moments after the fill (a 2026-07-05 benchmark measured 129–152 ms warm proving). Wait a few seconds and refresh. Say: "The proof is being generated in the background — on the order of 150 milliseconds. It never blocks the trading path."

### If the MCP Client Won't Connect (Act 8)

> Don't debug live. Switch to the extended playbook — [../MCP_TOP_20_QUESTIONS.md](../MCP_TOP_20_QUESTIONS.md) — and walk through the "Was my trade executed at a fair price?" transcript. Say: "Let me show you the transcript of exactly this conversation instead."

---

## Technical Reference Card

> Keep this card handy for quick lookups during Q&A.

| Component | Technology | Key Metric |
|-----------|-----------|------------|
| **API Gateway** | Kong | Rate limiting (300/min general, 60/min auth) |
| **Backend** | Express + TypeScript | P95 < 500ms SLO |
| **Frontend** | React 18 + Vite | Web Vitals (LCP, INP, CLS) |
| **Database** | PostgreSQL 15 | Port 5433, Drizzle schema |
| **Message Queue** | RabbitMQ 3.12 | Circuit breaker: opens after 3 consecutive failures, closes after 2 successes |
| **Tracing** | OpenTelemetry → Jaeger | Typically 17+ spans per trade path |
| **Metrics** | Prometheus + Grafana | 48 alert rules in 11 groups |
| **Anomaly Detection** | Two-pass baselines + Welford (amounts) | 168 buckets/span key, SEV1–5 at 3σ–8σ, whale 3–7σ |
| **AI/LLM** | Ollama + Llama 3.2:1B | Streaming RCA, LoRA fine-tuned (r=16/α=32) |
| **ZK Proofs** | Groth16 (snarkjs) | 129–152 ms warm proving (2026-07-05 benchmark), BN128 curve |
| **MCP** | otel-mcp-server v1.2.0 + embedded server | 32 tools / 7 skills standalone, 28 tools embedded |
| **Alerting** | Alertmanager → GoAlert | Multi-window burn rate (14.4x/6x/3x/1x) |
| **Deployment** | Kubernetes (3 nodes) | Helm charts, Cloudflare tunnel |
| **Tests** | Vitest + Playwright | 1,100+ passing automated tests (1,088 in the main suite + 99 in otel-mcp-server), API smoke + E2E |
| **Security** | bcrypt(12), JWT, 2FA/TOTP | 3-tier rate limiting, SIEM webhook |

---

## Key URLs for Live Demo

| What | URL |
|------|-----|
| Landing Page | `https://www.krystaline.io` |
| Register | `https://www.krystaline.io/register` |
| Portfolio | `https://www.krystaline.io/portfolio` |
| Trade | `https://www.krystaline.io/trade` |
| Transparency | `https://www.krystaline.io/transparency` |
| Monitor | `https://www.krystaline.io/monitor` |
| Jaeger | `https://www.krystaline.io/jaeger/` |
| Grafana | `https://www.krystaline.io/grafana/` |
| ZK Stats API | `https://www.krystaline.io/api/public/zk/stats` |
| Health API | `https://www.krystaline.io/api/v1/monitor/health` |
| SLO API | `https://www.krystaline.io/api/v1/monitor/slo` |

---

## Appendix: The Five Pillars of Proof of Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROOF OF OBSERVABILITY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────┐   │
│  │TRACING  │  │ANOMALY  │  │  LLM    │  │   ZK    │  │ SLO  │   │
│  │         │  │DETECTION│  │  RCA    │  │ PROOFS  │  │BUDGET│   │
│  │17 spans │  │Welford  │  │Llama3.2 │  │Groth16  │  │99.9% │   │
│  │per trade│  │168 hour │  │LoRA     │  │Poseidon │  │Burn  │   │
│  │W3C ctx  │  │buckets  │  │tuned    │  │hash     │  │rate  │   │
│  │exemplars│  │SEV 1-5  │  │streaming│  │BN128    │  │alerts│   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬──┘   │
│       │            │            │            │           │      │
│       └────────────┴─────┬──────┴────────────┴───────────┘      │
│                          │                                      │
│              ┌───────────┴───────────┐                          │
│              │   COMPLETE TRUST      │                          │
│              │   Verify, don't trust │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

**Pillar 1 — Tracing:** Every trade generates a complete distributed trace across all services, with W3C context propagation through HTTP and message queues. Exemplars bridge metrics to traces in one click.

**Pillar 2 — Anomaly Detection:** Time-aware baselines (168 hourly buckets per span key, two-pass Bessel-corrected variance) classify anomalies from SEV5 (3σ, unusual) to SEV1 (8σ, critical), with at least 10 samples required before any baseline can fire. Welford's online algorithm powers amount profiling, catching whale transactions on a 3–7σ ladder. All autonomous — no human thresholds.

**Pillar 3 — AI Diagnosis:** Locally-hosted Llama 3.2 (1B parameters) receives rich context — span attributes, system metrics, full trace — and streams structured root cause analysis in real-time via WebSocket. LoRA fine-tuning on production feedback creates a continuously improving model.

**Pillar 4 — ZK Proofs:** Groth16 zk-SNARKs commit every trade to its execution details (price, quantity, user, timestamp, trace ID) via Poseidon hashing. Trade-integrity proofs are publicly verifiable with the open-source `snarkjs` library; solvency proofs are generated every 60 seconds and verified server-side, with the Poseidon commitment published publicly.

**Pillar 5 — SLO Framework:** Google SRE multi-window burn rate alerting on 99.9% availability and P95 < 500ms latency targets. Error budgets track remaining tolerance. Burn rates trigger alerts before users notice degradation.

---

*Practice this script at least twice before the meeting. The power is in the live demo — let the technology speak for itself. Every claim is backed by real, running code.*

*Environment: Kubernetes cluster at `www.krystaline.io` — Updated July 2026*

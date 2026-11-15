# Docker Deployment Guide

**Version:** 2.0
**Last Updated:** July 5, 2026
**Scope:** Local development and demo deployment via Docker Compose. For Kubernetes, see [02_DEPLOYMENT_K8S.md](02_DEPLOYMENT_K8S.md). For post-deploy verification, see [04_RUNBOOK.md](04_RUNBOOK.md) Section 9.4.

---

## 1. Topology

Krystaline runs as a hybrid stack:

- **22 Docker Compose services** provide all infrastructure: gateway, databases, message broker, and the full observability stack ([docker-compose.yml](../../docker-compose.yml)).
- **3 Node.js processes run natively on the host** (see the note at the bottom of docker-compose.yml): the Express API (`kx-exchange`, port 5000), the order matcher (`kx-matcher`, `payment-processor/`, metrics on port 3001), and the Vite dev server for the React frontend (port 5173).

This split avoids Docker overhead for the code you iterate on while keeping infrastructure reproducible.

---

## 2. Prerequisites

- **Docker Desktop running** (or Docker Engine + Compose v2). `npm run dev` checks `docker info` and exits immediately if Docker is down.
- **Node.js + npm.** Install dependencies with:
  ```bash
  npm install --legacy-peer-deps
  ```
- **RAM:** budget several GB for the compose stack. The `ollama` service pulls the `llama3.2:1b` model on first start and reserves an NVIDIA GPU (`deploy.resources` block in docker-compose.yml) — on machines without an NVIDIA runtime, remove that block or skip the service.
- **Free host ports:** see the port map in Section 4. The most common conflict is a locally installed PostgreSQL on 5432 (used by `kong-database`; the app database deliberately maps to 5433).

### Required environment variables

Compose refuses to start without these (`${VAR:?...}` guards in docker-compose.yml):

| Variable | Used by |
|----------|---------|
| `DB_PASSWORD` | app-database, postgres-exporter |
| `KONG_PG_PASSWORD` | kong-database, kong-migrations, kong-gateway, kong-postgres-exporter |
| `RABBITMQ_PASSWORD` | rabbitmq |

Defaults exist for the rest but should be overridden anywhere beyond a laptop demo: `GOALERT_DB_PASSWORD`, `GOALERT_ENCRYPTION_KEY`, `GRAFANA_ADMIN_PASSWORD` (default `admin`), `NTFY_TOPIC`, `OLLAMA_MODEL` (default `llama3.2:1b`).

Provide them via a `.env` file in the repo root or exported shell variables:

```bash
export DB_PASSWORD=...
export KONG_PG_PASSWORD=...
export RABBITMQ_PASSWORD=...
```

---

## 3. Starting the Stack

### Option A: `npm run dev` (recommended)

One command runs [scripts/start-dev.js](../../scripts/start-dev.js), which in order:

1. Verifies Docker is running (exits with `❌ Docker is not running` otherwise)
2. Starts **21 of the 22 compose services** — everything except `bayesian-service`
3. Waits for Kong Admin, Kong proxy, RabbitMQ, and PostgreSQL health
4. Enables Kong's OpenTelemetry and CORS plugins (`scripts/enable-kong-otel.js`, `scripts/enable-kong-cors.js`)
5. Starts the API (`npm run dev:server`, port 5000) and waits for its `/health`
6. Starts the matcher (`npx tsx payment-processor/index.ts`)
7. Starts Vite (`npx vite --host`, port 5173)

Open **http://localhost:5173** when it prints the startup banner.

**The one service `npm run dev` does not start is `bayesian-service`** (Python FastAPI, port 8100, used for Bayesian anomaly inference and alert RCA). Start it separately when needed:

```bash
docker compose up -d bayesian-service
```

The API only connects to it when `ENABLE_BAYESIAN_INFERENCE=true` is set.

> **Do not use `npm run dev:compose`.** It references compose services (`kx-exchange`, `payment-processor`, `vite`) that are not defined in docker-compose.yml and currently fails.

### Option B: `docker compose up -d` (infrastructure only)

Starts all 22 services, including `bayesian-service`. You then start the three Node processes yourself:

```bash
docker compose up -d
npm run dev:server                    # API on :5000
npx tsx payment-processor/index.ts    # matcher, metrics on :3001
npx vite --host                       # frontend on :5173
```

On this path the Kong service/route is still registered automatically by the API at startup (`server/services/kong-client.ts`), but the OpenTelemetry and CORS plugins are not enabled — run `node scripts/enable-kong-otel.js` and `node scripts/enable-kong-cors.js` manually if you want Kong spans and browser calls through :8000.

---

## 4. Service and Port Map

### Host-run Node processes

| Process | Port(s) | Purpose |
|---------|---------|---------|
| kx-exchange (API) | **5000** | REST API, SPA, `/health`, `/ready`, `/metrics` |
| Vite dev server | **5173** | Frontend dev URL (proxies `/api` and `/ws` to :5000) |
| kx-matcher | 3001 | Matcher `/metrics` and `/health` |

### Docker Compose services (22)

| Service | Image | Host port(s) | Purpose |
|---------|-------|--------------|---------|
| kong-gateway | kong/kong-gateway | **8000** proxy, **8001** admin, **8002** manager GUI, 8003 dev portal (+ 8443/8444/8445/8446 SSL) | API gateway |
| kong-database | postgres:13 | 5432 | Kong config store |
| kong-migrations | kong/kong-gateway | — | One-shot migrations job |
| app-database | postgres:15 | **5433** → 5432 | Users, wallets, orders, trades (seeded from `db/init.sql`) |
| rabbitmq | rabbitmq:3.12-management | 5672 AMQP, **15672** UI, 15692 metrics | Order/response queues |
| redis | redis:7-alpine | 6379 | Cache + rate-limit store |
| jaeger | jaegertracing/all-in-one | **16686** UI, 4317/4318 OTLP, 14350 → 14250 gRPC | Trace storage and UI |
| otel-collector | otel/opentelemetry-collector-contrib | **4319** → 4318 | Browser-facing OTLP receiver with tail sampling |
| prometheus | prom/prometheus | **9090** | Metrics (12h/2GB retention, exemplar storage) |
| alertmanager | prom/alertmanager:v0.27.0 | **9093** | Alert routing (48 rules / 11 groups in [config/alerting-rules.yml](../../config/alerting-rules.yml)) |
| grafana | grafana/grafana | **3000** | Dashboards; login `admin` / `$GRAFANA_ADMIN_PASSWORD` (default `admin`) |
| loki | grafana/loki:3.0.0 | 3100 | Log aggregation |
| promtail | grafana/promtail:3.0.0 | — | Ships container logs to Loki |
| ollama | ollama/ollama | 11434 | Local LLM for anomaly analysis (GPU reservation) |
| goalert | goalert/goalert:v0.33.0 | **8081** | On-call and incident management |
| goalert-db | postgres:17-alpine | — | GoAlert database |
| maildev | maildev/maildev | **1080** UI, 1025 SMTP | Dev email (registration verification, alert email) |
| bayesian-service | built from `bayesian-service/` | **8100** | Bayesian inference FastAPI (not started by `npm run dev`) |
| postgres-exporter | postgres-exporter:v0.15.0 | 9187 | app-database metrics |
| kong-postgres-exporter | postgres-exporter:v0.15.0 | 9188 → 9187 | kong-database metrics |
| node-exporter | prom/node-exporter:v1.7.0 | 9100 | Host metrics |
| redis-exporter | redis_exporter:v1.66.0 | 9121 | Redis metrics |

---

## 5. Health Checks

```bash
# Application plane
curl http://localhost:5000/health     # API liveness
curl http://localhost:5000/ready      # API readiness
curl http://localhost:3001/health     # matcher

# Infrastructure
curl http://localhost:8001/status     # Kong admin
curl http://localhost:8081/health     # GoAlert
curl http://localhost:3000/api/health # Grafana

# Compose healthcheck status for all services
docker compose ps
```

Notes:

- **Loki** has no container healthcheck (the image is minimal, no wget/curl) — check `docker compose logs loki` instead.
- The **OTel collector**'s `health_check` extension listens on 13133 *inside* the container; that port is not published to the host. Use `docker compose ps otel-collector` to read its healthcheck status.

---

## 6. Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `❌ Docker is not running. Please start Docker and try again.` | `docker info` failed | Start Docker Desktop, rerun `npm run dev` |
| Compose exits with `KONG_PG_PASSWORD is required` (or `DB_PASSWORD` / `RABBITMQ_PASSWORD`) | Missing required env var | Export the variable or add it to `.env` |
| `port is already allocated` on 5432 | Local PostgreSQL install conflicts with kong-database | Stop the local instance or remap the port (the app DB already avoids this by using 5433) |
| Every API request returns 500 `"Connection is closed."` | Redis container not running — the rate limiter's Redis store exhausted retries | `docker compose up -d redis`. Since commit `f2b8c5d` (2026-06-12), `npm run dev` starts Redis and the rate limiter fails open (`passOnStoreError`), so requests pass unthrottled instead of erroring if Redis drops |
| `ollama` service fails to start with an NVIDIA/GPU error | Compose reserves an NVIDIA GPU for Ollama | Install the NVIDIA container toolkit, or remove the `deploy.resources` block from the `ollama` service |
| Requests to :8000 return 404 | Kong route (`/api` → host :5000) is registered by the API at startup | Start the API first, then retry through Kong |
| Bayesian endpoints/insights missing | `bayesian-service` is the one service `npm run dev` does not start | `docker compose up -d bayesian-service` and set `ENABLE_BAYESIAN_INFERENCE=true` |

---

## 7. Stopping, Resetting, Rolling Back

```bash
# Stop containers, keep data volumes
docker compose down

# Full reset — wipes Kong config, Grafana state, and the app database
# (re-seeded from db/init.sql on next start)
docker compose down -v
```

Rollback for a bad deploy on compose: `docker compose down`, then restart the previous known-good images; for the host-run app processes, check out the prior tag/commit and restart `npm run dev`.

---

## 8. Verifying a Deployment

After the stack is up, run the smoke test and soak gate in [04_RUNBOOK.md](04_RUNBOOK.md) Section 9.4 — health endpoints, one end-to-end trace in Jaeger, metrics increment, and a 10-minute soak with no critical alerts.

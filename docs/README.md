# Krystaline Documentation

Index of every active document in `docs/`. Everything listed here is [PUBLIC] — it describes code that ships in this repository, and claims carry evidence tags where they appear.

> **Excluded from this index:** [`archive/`](archive/README.md) holds superseded documents kept for history — do not cite them as current. `xgenDocs/` is documentation tooling (diagram sources), not product docs.

## Start here

- [Repository README](../README.md) — the front door: what ships, with evidence tags and measured numbers. [PUBLIC]
- [Getting Started](GETTING_STARTED.md) — five minutes from `git clone` to a trade you can watch in Jaeger (:16686) and verify cryptographically. [PUBLIC]
- [Anatomy of a Trade](ANATOMY_OF_A_TRADE.md) — the span-by-span source of truth for the "typically 17+ spans across 4 services" claim, quoted from instrumentation code. [PUBLIC]
- [Observability Whitepaper](OBSERVABILITY_WHITEPAPER.md) — the flagship narrative: thesis, dashboard evidence pack, and the AI SRE story over verified telemetry. [PUBLIC]

## Architecture

- [Architecture](architecture/01_ARCHITECTURE.md) — the four planes (exchange flow, telemetry, analysis, proof & agent access) with file-level evidence links. [PUBLIC]
- [Technical Assessment](architecture/04_TECHNICAL_ASSESSMENT.md) — measured health check: 1,100+ passing tests, 48 alert rules in 11 groups, 73-panel unified dashboard (re-verified 2026-07-05). [PUBLIC]

## Observability deep-dives

- [OpenTelemetry Tracing Guide](observability/01_OTEL_TRACING_GUIDE.md) — dual W3C context propagation over RabbitMQ, hop by hop, plus the failure modes actually hit in this repo. [PUBLIC]
- [Anomaly Detection Design](observability/02_ANOMALY_DETECTION_DESIGN.md) — time-aware adaptive thresholds: 168 time buckets per span key, empirical σ ladders, Welford whale detection. [PUBLIC]
- [LLM Monitoring Setup](observability/03_LLM_MONITORING_SETUP.md) — monitoring the AI that monitors you: five `kx_llm_*` metric families, a bounded queue, labeled load shedding. [PUBLIC]
- [Fine-Tuning Guide](observability/04_FINE_TUNING.md) — LoRA fine-tuning (r=16 / α=32 on Llama-3.2-1B-Instruct) from operator-rated anomaly analyses. [PUBLIC]
- [Bayesian Inference](observability/05_BAYESIAN_INFERENCE.md) — hierarchical PyMC latency model plus a Noisy-OR alert-correlation network, auto-trained by a background poller. [PUBLIC]
- [Chaos Injection](CHAOS_INJECTION.md) — on-demand failure injection: 5 server-side scenarios, 3 client-side attack patterns; baselines freeze during chaos. [PUBLIC]
- [MCP Top 20 Questions](MCP_TOP_20_QUESTIONS.md) — what AI agents can ask the observability stack over MCP, with example transcripts. [PUBLIC]

## Product & demos

- [Demo Script](DEMO.md) — condensed ~23-minute technical cue cards for presenters who already know the stack. [PUBLIC]
- [Demo Walkthrough](product/03_DEMO_WALKTHROUGH.md) — self-serve localhost tour of Proof of Observability; no presenter required. [PUBLIC]
- [Investor Demo Script](product/04_INVESTOR_DEMO_SCRIPT.md) — the canonical investor demo: full narration, Q&A prep, recovery playbook. [PUBLIC]
- [Roadmap](product/01_ROADMAP.md) — product phases and current status, re-verified against the codebase 2026-07-05. [PUBLIC]
- [User Journey](product/02_USER_JOURNEY.md) — the user-facing flows behind the Proof of Observability promise. [PUBLIC]
- [AI Ops in 2026 (blog)](blog/ai-ops-2026-article-with-practical-case-and-appendix.md) — long-form essay: the model is not the monitor, with a worked Krystaline case and a reproduce-it-yourself closer. [PUBLIC]

## Operations

- [Docker Deployment](operations/01_DEPLOYMENT_DOCKER.md) — local development and demo deployment via Docker Compose (22 services). [PUBLIC]
- [Kubernetes Deployment](operations/02_DEPLOYMENT_K8S.md) — cluster deployment guide (Docker Desktop, Minikube, or cloud-managed). [PUBLIC]
- [Backup & Restore](operations/03_BACKUP_RESTORE.md) — backup and recovery procedures for the platform's stateful services. [PUBLIC]
- [Operational Runbook](operations/04_RUNBOOK.md) — day-2 operations: health checks, common incidents, escalation. [PUBLIC]
- [Production Readiness Assessment](operations/05_PRODUCTION_READINESS_ASSESSMENT.md) — security-review-driven readiness findings and hardening status. [PUBLIC]
- [GoAlert Setup](operations/06_GOALERT_SETUP.md) — configuring on-call paging and phone notifications (GoAlert on :8081). [PUBLIC]
- [Tracing On-Call Quick Guide](observability/06_TRACING_ONCALL.md) — first-five-minutes triage for tracing and anomaly-monitoring incidents. [PUBLIC]

## Meta

- [Public Documentation Catalog](PUBLIC_DOCUMENTS.md) — what gets published vs. kept private, with per-document publication status. [PUBLIC]
- [Brand Positioning](BRAND_POSITIONING.md) — how Krystaline, Krystaline Observability Lab, and Krystaline Core relate. [PUBLIC]
- [Contributing](../CONTRIBUTING.md) — contribution workflow, including the evidence-first rules for doc changes. [PUBLIC]

## Subproject READMEs

- [otel-mcp-server](../otel-mcp-server/README.md) — standalone MCP server, vendored v1.2.0 snapshot: 32 read-only tools across 7 skills. [PUBLIC]
- [bayesian-service](../bayesian-service/README.md) — Python FastAPI inference microservice (:8100): hierarchical latency model + Noisy-OR alert correlator. [PUBLIC]
- [lora-anomaly-analyzer](../lora-anomaly-analyzer/README.md) — trained LoRA adapter card (PEFT, base Llama-3.2-1B-Instruct) produced by the fine-tuning pipeline. [PUBLIC]

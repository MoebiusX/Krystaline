# Public Documentation Catalog

This catalog lists documentation that can be shared in the open-source
Krystaline Observability Lab to explain what we are building in Krystaline Core
without revealing proprietary implementation details.

The rule of thumb: publish the user promise, architectural intent, public data
model, and operational philosophy. Keep source code internals, exact control
logic, credentials, private deployment values, provider-specific integrations,
and security-sensitive runbooks private.

## Recommended Publishing Set

Status verified against the repository on 2026-07-05: "Published" links to the
shipped document; "Planned" means no standalone public doc exists yet.

**Scope note:** the "Keep private" column refers to Krystaline Core — the
private product this Lab explains. The Lab itself is open source by design and
deliberately publishes its own equivalents of many of these items: detection
thresholds, detector source, ZK circuits, proving keys, and LoRA training data
all live in this repository. "Keep private" flags what must not carry over when
Core material is adapted for publication here.

| Priority | Document | Status | Audience | Public-safe angle | Keep private |
|---|---|---|---|---|---|
| P0 | Brand positioning | Published — [BRAND_POSITIONING.md](BRAND_POSITIONING.md) | Contributors, observability leaders, service managers | How Krystaline, Krystaline Observability Lab, Krystaline Core, AI SRE, and Proof of Observability fit together | Naming migration details that reveal private systems, unreleased product names, customer-specific positioning |
| P0 | Proof of Observability overview | Published — the repo [README](../README.md) serves as this overview | Users, operators, investors | Why an exchange should prove trades, health, and latency with live telemetry instead of status-page claims | Internal dashboards with sensitive labels, exact alert expressions, private environment details |
| P0 | Observability whitepaper | Published — [OBSERVABILITY_WHITEPAPER.md](OBSERVABILITY_WHITEPAPER.md) | Observability experts, service managers, senior technical leadership | Thesis, dashboard evidence pack, status map, and AI SRE story for service-manager RCA over verified telemetry | Exact prompts, private context-builder internals, model weights, provider credentials, incident history |
| P0 | Public MCP transparency guide | Published — [MCP_TOP_20_QUESTIONS.md](MCP_TOP_20_QUESTIONS.md) | AI-agent builders, users, developers | How Claude, ChatGPT, Copilot, Cursor, or other MCP clients can query public exchange health, volume, recent trades, trace summaries, and ZK proof status | Personal-account tools, private logs, internal MCP auth, raw user data |
| P0 | From Observability to Integrity | Planned — the material currently lives split across the [whitepaper](OBSERVABILITY_WHITEPAPER.md) and [ANATOMY_OF_A_TRADE.md](ANATOMY_OF_A_TRADE.md); no standalone essay yet | Crypto researchers, users, auditors | How OpenTelemetry and zero-knowledge proofs complement each other: traces show behavior; proofs show integrity | Circuit source, proving keys, exact witness construction, performance bottlenecks that could aid abuse |
| P0 | Trace-verified trade lifecycle | Published — [ANATOMY_OF_A_TRADE.md](ANATOMY_OF_A_TRADE.md) | Developers, prospective users | A conceptual walkthrough of a trade moving through gateway, exchange, matcher, settlement, trace, and public verification | Queue topology details, database schema internals, operational credentials |
| P1 | AI SRE concept note | Published — [AI Ops in 2026](blog/ai-ops-2026-article-with-practical-case-and-appendix.md) | SREs, platform teams, engineering leaders | A two-tier incident model: reliable paging plus AI-assisted triage over read-only telemetry | Prompt templates, incident history, private runbooks, mutating remediation actions |
| P1 | Adaptive anomaly detection explainer | Published — [02_ANOMALY_DETECTION_DESIGN.md](observability/02_ANOMALY_DETECTION_DESIGN.md) | Observability engineers, SREs | Why static thresholds are weak and how time-aware baselines reduce alert noise | Exact thresholds, training data, detector source, sensitive endpoint examples |
| P1 | Bayesian incident reasoning primer | Published — [05_BAYESIAN_INFERENCE.md](observability/05_BAYESIAN_INFERENCE.md) | SREs, AI/ML engineers | How probabilistic models can rank likely root causes during alert storms | Model parameters, training incidents, private alert history |
| P1 | Public transparency dashboard tour | Planned | Users, investors, analysts | What the public dashboard proves: service health, trade activity, proof counts, latency, traceability | Screenshots containing private tenant names, admin actions, raw infrastructure labels |
| P1 | Enterprise observability maturity model | Planned | CTOs, platform leaders, community | A capability ladder from basic telemetry to predictive and self-healing operations | Vendor contracts, internal maturity scoring, customer-specific gaps |
| P2 | One-click AI-agent connectivity roadmap | Planned | Users, AI ecosystem builders | Roadmap for user-controlled connections to personal transparency data through scoped tokens | Token generation internals, authorization edge cases, account-specific APIs until hardened |
| P2 | OpenTelemetry MCP upstream contribution notes | Planned — the server itself is published at [otel-mcp-server](../otel-mcp-server/README.md); the lessons-learned write-up is not | Open-source maintainers, ecosystem | Proposed public exchange skills, read-only tool surfaces, and lessons for upstream MCP servers | Private deployment topology, internal-only tools, private skills |
| P2 | Secure operational transparency principles | Planned | Security, compliance, platform teams | How to expose useful public operational data while excluding logs, PII, and mutable actions | Detection rules, bypass details, full security event taxonomy |
| P2 | Deployment provenance and drift narrative | Planned | DevOps, regulators, enterprise buyers | Why deploy auditability, image provenance, and drift checks matter for financial infrastructure | CI secrets, registry paths, cluster internals, remediation scripts |
| P3 | Chaos and resilience story | Published — [CHAOS_INJECTION.md](CHAOS_INJECTION.md) (this lab is open source, so the scenarios themselves are public; the "keep private" guidance applies to Core) | SREs, technical buyers | What failure injection proves about trace coverage, alerting, and recovery discipline | Exact chaos scripts, production toggles, exploitable failure modes |
| P3 | Engineering manifesto | Planned | Contributors, partners | The engineering principles behind transparency-first financial infrastructure | Internal staffing, private process notes |

## Suggested Public Doc Order

1. Publish the flagship narrative: **Proof of Observability overview**. *(done — repo README)*
2. Publish the technical leadership narrative: **Observability whitepaper** (`docs/OBSERVABILITY_WHITEPAPER.md`). *(done)*
3. Publish the hands-on trust surface: **Public MCP transparency guide**. *(done — MCP_TOP_20_QUESTIONS.md)*
4. Publish the cryptographic trust story: **From Observability to Integrity**. *(next up — see Status column)*
5. Publish the operational story: **AI SRE concept note** and **adaptive anomaly detection explainer**. *(done — blog article + 02_ANOMALY_DETECTION_DESIGN.md)*
6. Publish ecosystem-facing notes: **OpenTelemetry MCP upstream contribution notes** and **one-click AI-agent connectivity roadmap**. *(planned)*

This order gives readers a clean path: what Krystaline Observability Lab is, how
they can inspect it, why the integrity model is different, and where the
platform is going.

## Public-Safe Messaging

Use these phrases freely:

- "Proof of Observability": every important operation should leave a verifiable
  telemetry trail.
- "Public transparency by default": public health, volume, trade summaries,
  trace summaries, and proof status can be queried without an account.
- "AI-assisted operations": AI helps summarize and correlate telemetry, while
  critical paging and approvals remain deterministic and auditable.
- "Proof of Integrity": zero-knowledge proofs can verify claims without exposing
  private user data.
- "Read-only public agent access": public MCP tools expose transparency data;
  private account data and operator actions require separate authorization.

Avoid publishing (about Krystaline Core — the Lab's own algorithms, thresholds,
circuits, proving keys, and training data are already public in this repository):

- Private repository paths, branch names, or commit history that reveal delivery
  sequencing.
- Exact algorithms, thresholds, circuit constraints, proving keys, or detector
  tuning values.
- Raw traces, logs, screenshots, or dashboard exports containing IP addresses,
  user IDs, service internals, credentials, provider labels, or incident details.
- Security runbooks, bypass conditions, rate-limit internals, auth-token flows,
  or active remediation mechanics.
- Any statement implying production customer-funds readiness unless it is backed
  by the current public status page and approved release notes.

## Ready-To-Draft Titles

- "Proof of Observability: Why Crypto Infrastructure Should Be Inspectable"
- "GenAI Observability: AI-Assisted RCA Without Losing Operational Control"
- "Ask the Exchange: Public MCP Transparency for AI Agents"
- "From Observability to Integrity: Traces, Proofs, and Verifiable Trades"
- "The Trace-Verified Trade: A Public Walkthrough"
- "AI SRE for Exchanges: Paging Stays Deterministic, Triage Gets Smarter"
- "Adaptive Anomaly Detection Without Alert Fatigue"
- "Probabilistic RCA: Ranking Root Causes During Alert Storms"
- "Building Public Transparency Without Leaking Private Operations"
- "A Maturity Model for Enterprise Observability in 2026"
- "OpenTelemetry as a Trust Layer for Financial Infrastructure"

## Redaction Checklist

Before copying or adapting a Core document into this public repository, confirm:

- The document explains outcomes and architecture, not proprietary mechanics.
- All examples use synthetic IDs, synthetic amounts, and public endpoints only.
- Screenshots are sanitized or recreated for public viewing.
- API examples are unauthenticated public APIs, or clearly marked as planned.
- No secrets, provider account names, private hostnames, internal IPs, keys,
  tokens, or deploy logs are present.
- Security details are framed defensively and do not provide attack playbooks.
- Future-looking features are clearly labelled as roadmap, proposal, or concept.

# Public Documentation Catalog

This catalog lists documentation that can be shared in the open-source
Krystaline Observability Lab to explain what we are building in Krystaline Core
without revealing proprietary implementation details.

The rule of thumb: publish the user promise, architectural intent, public data
model, and operational philosophy. Keep source code internals, exact control
logic, credentials, private deployment values, provider-specific integrations,
and security-sensitive runbooks private.

## Recommended Publishing Set

| Priority | Document | Audience | Public-safe angle | Keep private |
|---|---|---|---|---|
| P0 | Brand positioning | Contributors, observability leaders, service managers | How Krystaline, Krystaline Observability Lab, Krystaline Core, AI SRE, and Proof of Observability fit together | Naming migration details that reveal private systems, unreleased product names, customer-specific positioning |
| P0 | AI Ops 2026 article draft | Observability leaders, service managers, CTO/CIO stakeholders | Shareable narrative for how GenAI monitoring, AI SRE dashboards, evidence packets, and governance work in modern AI-assisted operations | Private prompts, provider credentials, unreleased internal workflow details, customer-specific incidents |
| P0 | Proof of Observability overview | Users, operators, investors | Why an exchange should prove trades, health, and latency with live telemetry instead of status-page claims | Internal dashboards with sensitive labels, exact alert expressions, private environment details |
| P0 | GenAI observability solution | Observability experts, service managers, senior technical leadership | Thesis, dashboard evidence pack, status map, and AI SRE story for service-manager RCA over verified telemetry | Exact prompts, private context-builder internals, model weights, provider credentials, incident history |
| P0 | Public MCP transparency guide | AI-agent builders, users, developers | How Claude, ChatGPT, Copilot, Cursor, or other MCP clients can query public exchange health, volume, recent trades, trace summaries, and ZK proof status | Personal-account tools, private logs, internal MCP auth, raw user data |
| P0 | From Observability to Integrity | Crypto researchers, users, auditors | How OpenTelemetry and zero-knowledge proofs complement each other: traces show behavior; proofs show integrity | Circuit source, proving keys, exact witness construction, performance bottlenecks that could aid abuse |
| P0 | Trace-verified trade lifecycle | Developers, prospective users | A conceptual walkthrough of a trade moving through gateway, exchange, matcher, settlement, trace, and public verification | Queue topology details, database schema internals, operational credentials |
| P1 | AI SRE concept note | SREs, platform teams, engineering leaders | A two-tier incident model: reliable paging plus AI-assisted triage over read-only telemetry | Prompt templates, incident history, private runbooks, mutating remediation actions |
| P1 | Adaptive anomaly detection explainer | Observability engineers, SREs | Why static thresholds are weak and how time-aware baselines reduce alert noise | Exact thresholds, training data, detector source, sensitive endpoint examples |
| P1 | Bayesian incident reasoning primer | SREs, AI/ML engineers | How probabilistic models can rank likely root causes during alert storms | Model parameters, training incidents, private alert history |
| P1 | Public transparency dashboard tour | Users, investors, analysts | What the public dashboard proves: service health, trade activity, proof counts, latency, traceability | Screenshots containing private tenant names, admin actions, raw infrastructure labels |
| P1 | Enterprise observability maturity model | CTOs, platform leaders, community | A capability ladder from basic telemetry to predictive and self-healing operations | Vendor contracts, internal maturity scoring, customer-specific gaps |
| P2 | One-click AI-agent connectivity roadmap | Users, AI ecosystem builders | Roadmap for user-controlled connections to personal transparency data through scoped tokens | Token generation internals, authorization edge cases, account-specific APIs until hardened |
| P2 | OpenTelemetry MCP upstream contribution notes | Open-source maintainers, ecosystem | Proposed public exchange skills, read-only tool surfaces, and lessons for upstream MCP servers | Private deployment topology, internal-only tools, private skills |
| P2 | Secure operational transparency principles | Security, compliance, platform teams | How to expose useful public operational data while excluding logs, PII, and mutable actions | Detection rules, bypass details, full security event taxonomy |
| P2 | Deployment provenance and drift narrative | DevOps, regulators, enterprise buyers | Why deploy auditability, image provenance, and drift checks matter for financial infrastructure | CI secrets, registry paths, cluster internals, remediation scripts |
| P3 | Chaos and resilience story | SREs, technical buyers | What failure injection proves about trace coverage, alerting, and recovery discipline | Exact chaos scripts, production toggles, exploitable failure modes |
| P3 | Engineering manifesto | Contributors, partners | The engineering principles behind transparency-first financial infrastructure | Internal staffing, private process notes |

## Suggested Public Doc Order

1. Publish the flagship narrative: **Proof of Observability overview**.
2. Publish the technical leadership narrative: **GenAI observability solution**.
3. Publish the hands-on trust surface: **Public MCP transparency guide**.
4. Publish the cryptographic trust story: **From Observability to Integrity**.
5. Publish the operational story: **AI SRE concept note** and **adaptive anomaly detection explainer**.
6. Publish ecosystem-facing notes: **OpenTelemetry MCP upstream contribution notes** and **one-click AI-agent connectivity roadmap**.

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

Avoid publishing:

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

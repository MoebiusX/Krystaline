# Krystaline Brand Positioning

Status: Public  
Audience: contributors, technical reviewers, observability leaders, service managers  
Classification: Public-safe overview

## Brand Architecture

| Name | Use it for | Notes |
|---|---|---|
| **Krystaline** | The product family and public brand. | Use this instead of the legacy X-suffixed name in public prose. |
| **Krystaline Observability Lab** | This open-source repo, live demo environment, docs, and lab positioning. | The lab demonstrates observability-first crypto and DeFi operations. |
| **Krystaline Core** | The private research and innovation platform. | Public docs may describe the promise and architecture, not private implementation details. |
| **Proof of Observability** | The main thesis. | Every material operation should leave a verifiable telemetry trail. |
| **Krystaline AI SRE** | The GenAI operations layer. | AI assists RCA and service-manager briefings over evidence-backed telemetry. |
| **Legacy runtime IDs** | Existing code, dashboards, metrics, Helm names, and service labels. | Values such as `krystalinex`, `kx-exchange`, and `kx_*` can remain until a runtime migration is planned. |

## Positioning

Krystaline Observability Lab is an open-source crypto and DeFi observability
demonstrator. The exchange domain is not the brand gimmick; it is the stress
test. Matching engines, wallets, proofs, market data, queues, and service-level
promises create the kind of operational pressure where observability either
works or becomes theater.

The lab exists to show how modern observability should behave when the business
stakes are high:

- OpenTelemetry is the operational backbone, not an afterthought.
- Service managers get evidence-backed answers, not another wall of panels.
- AI RCA is governed by traces, metrics, alerts, topology, and runbook context.
- Public transparency can expose useful proof without leaking private data.
- Cryptographic proof and telemetry can reinforce each other.

## Short Description

Krystaline Observability Lab is an open-source crypto and DeFi observability
demo platform for OpenTelemetry-first tracing, statistical and Bayesian anomaly
reasoning, local-first LLM RCA, and zk-SNARK proof systems, built for
service-manager operations.

## One-Liner

Krystaline turns crypto and DeFi operations into an observability-first lab for
traceable, explainable, and verifiable financial infrastructure.

## Messaging Rules

Use:

- "Krystaline" for the family brand.
- "Krystaline Observability Lab" for the public repo and demo.
- "Krystaline Core" for the private research platform.
- "AI-assisted operations" or "AI SRE" for GenAI RCA.
- "Proof of Observability" for the thesis.

Avoid:

- The legacy X-suffixed project name in public-facing prose except when referencing migration history.
- Claims that AI replaces the pager, incident commander, or approval path.
- Claims that private Core functionality is fully present in the public repo.
- Claims about customer-funds production readiness unless separately approved.

## Migration Policy

This rebrand is intentionally two-speed:

1. Public prose, docs, screenshots, decks, and repository description should move
   to Krystaline and Krystaline Observability Lab now.
2. Runtime identifiers should remain stable until a planned migration covers
   service names, Kubernetes resources, metrics, dashboard queries, scripts, and
   external URLs together.

This prevents a cosmetic rename from breaking the lab while still giving the
project a stronger public identity.

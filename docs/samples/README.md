# Hardening Samples

Reference implementations that accompany the security-hardening docs. These are
illustrative, copy-and-adapt snippets — they live under `docs/` and are
deliberately **excluded from the application build** (they are not part of the
TypeScript `include`), so they are documentation, not wired-in code.

Where a pattern is already implemented in the running application, that is noted
below so you don't wire it twice.

| Sample | Pattern | See |
|---|---|---|
| [`jwt-options.ts`](jwt-options.ts) | Pin the accepted JWT algorithm set in one place | [Secure Operational Transparency §1](../SECURE_OPERATIONAL_TRANSPARENCY.md) |
| [`auth-constants.ts`](auth-constants.ts) | Single source of truth for the bcrypt work factor | [§ hardening changelog](../SECURITY_HARDENING_CHANGELOG.md) |
| [`crypto-box.ts`](crypto-box.ts) | AES-256-GCM seal/open for secrets at rest | [Secure Operational Transparency §4](../SECURE_OPERATIONAL_TRANSPARENCY.md) |
| [`redact-telemetry.ts`](redact-telemetry.ts) | Redact identifiers before they reach a telemetry sink | already live in `client/src/lib/trace-utils.ts` (`redactAddressForTelemetry`) |
| [`idempotency-key-pattern.md`](idempotency-key-pattern.md) | Exactly-once for money-moving endpoints | [Secure Operational Transparency §6](../SECURE_OPERATIONAL_TRANSPARENCY.md) |
| [`grafana-hardening.env.example`](grafana-hardening.env.example) | No anonymous admin, no default password | [Secure Operational Transparency §7](../SECURE_OPERATIONAL_TRANSPARENCY.md) |
| [`k8s-securityContext.yaml`](k8s-securityContext.yaml) | Non-root, least-privilege pods; digest-pinned images | [Deployment Provenance & Drift](../DEPLOYMENT_PROVENANCE_AND_DRIFT.md) |

Rename the placeholder env-var and secret names to your project's conventions
before adopting any of these.

# Security Hardening — Philosophy and Public Changelog

Status: Public
Audience: contributors, security reviewers, technical buyers
Classification: Public-safe overview

## Philosophy

We periodically run a structured security review across the platform's main
domains — authentication and session, money movement, HTTP API and
access-control, secrets and infrastructure, and the proof/telemetry surfaces —
and then harden against what we find. Two commitments shape how we talk about it:

- **We publish the pattern, not the postmortem.** The lab shares the generic
  hardening lessons (pin your token algorithm, encrypt seeds at rest, bound your
  public query surface). It does not publish the specific internal weakness, the
  exact thresholds, or anything that reads as an attack recipe against the live
  system.
- **Hardening is continuous, not a milestone.** A "we passed a security review"
  banner is not a product claim. The value is the discipline of reviewing,
  remediating, and re-verifying — repeatedly.

## What "hardened" means here, by category

The categories below are the durable ones; the list is a public-safe summary of
the *kinds* of improvements we make, not a live findings index.

**Authentication & session**
- Token verification pins its accepted algorithm set.
- Password/verification/recovery codes come from a CSPRNG.
- Per-account lockout complements per-IP rate limiting.
- Authenticator seeds are encrypted at rest; recovery codes are hashed.
- One bcrypt work factor, defined once.
- Sensitive verification endpoints are individually rate-limited.

**HTTP API & public surface**
- Every public route — including unversioned aliases — is rate-limited.
- Destructive maintenance operations require explicit, authenticated opt-in.
- Public pass-through queries are bounded (size, range, resolution, timeout).
- Lookups return exact matches, never bulk exports.
- Anonymous access is read-only and fails closed.

**Money movement**
- Value-moving operations are atomic and support idempotency keys.
- Demonstration/simulation endpoints are environment-gated and capped.

**Secrets & infrastructure**
- Observability tooling ships with no anonymous admin and no default password.
- Internal services authenticate their callers and bound their inputs.
- Local developer transports bind to loopback.
- Workloads run non-root with least privilege; images are digest-pinned.
- Base images are patched at build; dependencies are hash-locked.

**Proofs & telemetry**
- Public claims are only as strong as what is actually verifiable — copy is kept
  honest, and proofs are independently checkable by third parties.
- Client telemetry redacts directly-identifying values before they leave the
  authenticated boundary.
- In-memory caches are bounded (size + TTL).

---

See also: [Secure Operational Transparency Principles](SECURE_OPERATIONAL_TRANSPARENCY.md)
and [Deployment Provenance and Drift](DEPLOYMENT_PROVENANCE_AND_DRIFT.md).

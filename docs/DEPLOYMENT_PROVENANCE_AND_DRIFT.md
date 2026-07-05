# Deployment Provenance and Drift

Status: Public
Audience: DevOps, regulators, enterprise buyers
Classification: Public-safe overview

For financial infrastructure, "it's deployed" is not enough. You should be able
to answer, at any moment: *exactly which artifact is running, where it came from,
and whether it still matches what we intended to deploy.* This note describes the
provenance-and-drift discipline the lab treats as table stakes. It is a set of
practices, not a description of any private pipeline.

## 1. Pin artifacts by digest, not by tag

A floating tag (`:latest`, `:stable`) resolves to "whatever that name pointed at
when the node happened to pull." That is neither reproducible nor auditable — two
nodes can run different code under the same tag. Pin every production image by
content digest (`@sha256:…`) and resolve the digest at release time.

Benefit: the running artifact is exactly identifiable and cannot silently change
underneath you.

## 2. Provenance: know where the artifact came from

Every production artifact should be traceable to the commit and build that
produced it. Record the source revision, the build inputs, and (ideally) a signed
attestation, so a reviewer can walk from "this container is running" back to "this
reviewed change built it."

## 3. Patch the base, don't just build on it

A pinned base image is still only as safe as its last rebuild. Production image
builds should apply OS-level security updates as an explicit step, so a known-CVE
package in the base layer is patched rather than inherited indefinitely.

## 4. Lock dependencies with hashes

Application dependencies should be resolved through a lockfile with content
hashes, and version ranges kept to compatible bounds. Loose ranges mean a build
can quietly pull a newer, unreviewed version; hash-pinned locks make the
dependency set reproducible and tamper-evident.

## 5. Detect drift continuously

Deployed state drifts — someone hotfixes a running config, an operator edits a
resource by hand, a dependency gets bumped out of band. Drift detection compares
*what is actually running* against *what the source of truth declares* and flags
the delta. For regulated infrastructure this is the difference between "we think
prod matches main" and "we can prove it."

Operational note: the automation that performs drift checks needs credentials.
Source those from your secrets manager / CI secret store, never from a file left
on the runner.

## 6. Deploy behind a guard

A guided deploy should verify preconditions (image pinned, provenance present,
config validated, drift clean) before it touches production, and make rollback a
first-class, rehearsed step rather than an improvisation.

---

Why a public lab cares: provenance and drift are exactly what an external auditor,
regulator, or enterprise buyer asks about when they evaluate whether financial
infrastructure is operated responsibly. Publishing the *discipline* (not the
private pipeline) is part of the transparency promise.

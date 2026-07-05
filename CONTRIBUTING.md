# Contributing

Thanks for taking the time to contribute! Please follow these guidelines to keep changes smooth and safe.

## Getting Started
- Fork and clone the repo; create a feature branch from `develop`.
- Install dependencies: `npm install --legacy-peer-deps`.
- Run tests before changes: `npm test` (or targeted suites when applicable).

## Branch & Commit Hygiene
- Use small, focused PRs; prefer incremental changes.
- Commit messages: conventional style (e.g., `feat:`, `fix:`, `docs:`, `chore:`).
- Keep PR titles clear and scoped (problem + approach).

## Coding Standards
- TypeScript/JavaScript: follow existing patterns; prefer typed interfaces and Zod schemas for validation.
- Security: never commit secrets; keep `.env` local; run `npm run security:secrets`.
- Linting/formatting: match current style; run `npm run check` if in doubt.
- Tests: add/adjust tests for changed behavior; ensure `npm test` passes.

## Evidence-first contributions
The documentation's thesis is that every claim should be verifiable before it asks anyone to trust it. Contributions — especially doc changes — follow the same rule.

**The tag system.** Claims in docs carry evidence tags:
- `[PUBLIC]` — backed by code in this repository; link the file so a reader is one click from the evidence.
- `[CORE]` — implemented in the private Krystaline Core repo; describable but not independently verifiable here.
- `[BACKLOG]` — planned and tracked, not built.
- `[ASPIRATIONAL]` — directional intent, no committed work.
- `[NON-GOAL]` — explicitly out of scope.

Public claims need public evidence: if you write a number (test count, alert-rule count, latency), it must be measured or counted from this repo, ideally with the date it was verified. Never promote a `[CORE]`/`[BACKLOG]` claim to `[PUBLIC]` without the code landing here first. See [docs/PUBLIC_DOCUMENTS.md](docs/PUBLIC_DOCUMENTS.md) for what may be published at all.

**Before opening a PR**, run:
- `npm run ci:check-docs` — the confidential-marker scan (`scripts/check-confidential-docs.cjs`). Honest caveat: this ships as the `precommit` npm script but is currently a manual gate — it is not yet wired to a git hook or CI, so running it is on you.
- `npm run check` — TypeScript compilation.
- `npm test` — the full Vitest suite.

**Good first contributions:**
- Recapture the whitepaper and blog screenshots against the current UI (several predate the latest monitor redesign).
- Wire the confidential-doc scanner into CI or an installed git hook, so the gate above stops being manual.
- Pick up a `[BACKLOG]` item tagged in the docs — for example, the quantified fixed-vs-adaptive false-positive comparison flagged in [docs/observability/02_ANOMALY_DETECTION_DESIGN.md](docs/observability/02_ANOMALY_DETECTION_DESIGN.md).

## Pull Requests
- Describe the change, rationale, and user impact.
- Note any known limitations or follow-ups.
- Include screenshots for UI changes when relevant.
- Tag reviewers familiar with the area (API, frontend, infra, ops).

## Reporting Issues
- Use clear reproduction steps, expected vs actual behavior, and logs/traces if available.
- For security issues, **do not open an issue**—email security@krystaline.io (see SECURITY.md).

## Code of Conduct
Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

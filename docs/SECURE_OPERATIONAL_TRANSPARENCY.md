# Secure Operational Transparency Principles

Status: Public
Audience: security, compliance, and platform teams
Classification: Public-safe overview

Krystaline's thesis is that financial infrastructure should be inspectable. But
"inspectable" is not "unguarded" — exposing useful public operational data and
protecting the account, money, and secret surfaces are the *same* discipline
seen from two sides. This note collects the defensive principles the lab holds
itself to. Everything here is a generic, industry-standard pattern; none of it
describes a specific internal control value.

## 1. Token integrity — pin what a verifier will accept

A JWT (or any signed token) verifier must **pin the algorithm set it accepts**.
If it accepts "whatever the token header claims", an attacker can present a token
with `alg: none` (unsigned) or swap a symmetric/asymmetric algorithm to bypass
the signature check entirely (`alg` confusion).

Principle: centralize verify/sign options so the accepted algorithm is set in one
place and cannot drift between call sites. A call site that legitimately needs a
different algorithm gets its own explicit options object rather than widening the
shared one.

## 2. Throttling authentication — two layers, not one

Per-IP rate limiting alone does not stop distributed credential stuffing that
stays under any single IP's limit. Pair it with a **per-account** control: track
consecutive failed logins and temporarily lock the account after a threshold,
clearing on any successful auth.

Principle: the two layers cover different attackers (one noisy source vs. many
quiet ones). Keep the lock window short so the mechanism can't be weaponized into
a denial-of-service against a targeted user, and make thresholds deployment-tuned
rather than published.

## 3. Codes and tokens — use a CSPRNG

Anything a user must not guess — email verification codes, password-reset codes,
recovery codes — must come from a cryptographically secure RNG, never
`Math.random()`. `Math.random()` is a predictable PRNG; observing a few outputs
can let an attacker predict others and forge another user's code.

Principle: `crypto.randomInt` / `crypto.randomBytes` for anything security-bearing.

## 4. Secrets at rest — encrypt seeds, hash codes

Authenticator (TOTP) seeds should be encrypted at rest with authenticated
encryption (AES-256-GCM), so a database read alone yields no usable 2FA material.
Recovery/backup codes should be stored only as one-way hashes and shown to the
user exactly once.

Principle: seeds are secrets you must recover (encrypt); codes are secrets you
only need to *check* (hash). In production the encryption key is required — fail
closed if it is missing rather than falling back to a derived dev key.

## 5. Transport headers — minimize the attack surface

- **Content-Security-Policy:** production policy should not carry
  `script-src 'unsafe-inline'`. Inline-script allowances are a dev-server
  convenience; shipping them to production widens XSS impact.
- **CORS credentials:** send `Access-Control-Allow-Credentials: true` only for
  explicitly allow-listed origins, never unconditionally. Reflecting credentials
  back to arbitrary origins defeats the point of the allow-list.

## 6. The public surface fails closed

Public transparency endpoints are read-only by design. The safety properties
that keep them that way:

- **Read-only, enforced:** public/anonymous access must not be able to reach any
  mutating or destructive operation, even by route aliasing.
- **Fail closed:** if public exposure is misconfigured, the safe default is to
  deny, not to expose. Production should refuse to start (or refuse the request)
  rather than serve a privileged route anonymously.
- **Rate-limited everywhere:** every public alias — versioned and unversioned —
  carries the same limiter. An unrated alias of a rated route is a hole.
- **Bounded pass-through:** if a public endpoint proxies a query language
  (e.g. metrics queries), bound it — cap query size, time range, resolution, and
  add a timeout — so it can't be turned into a resource-exhaustion lever.
- **Exact lookups, not dumps:** a public or semi-public lookup returns the one
  record the caller asked for, never a bulk export of everyone's data.
- **Destructive operations are gated:** maintenance actions that delete or reset
  data require an explicit, non-default opt-in and authentication — never an open
  route.

## 7. Internal services are not "trusted" by default

A service being inside the cluster is not authentication. Internal ML/inference
or worker services should still require a credential from their callers and bound
their inputs (size, shape, rate). Local developer transports (e.g. a local MCP or
debug HTTP server) should bind to loopback and drop wildcard CORS, so they aren't
reachable from off-box.

---

These principles map directly onto the lab's public promise: *public health,
volume, and proof status by default; account data, money movement, and operator
actions behind explicit authorization.* Transparency and safety are the same
engineering habit.

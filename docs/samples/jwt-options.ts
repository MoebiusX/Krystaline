/**
 * Centralized JWT algorithm options.
 *
 * Pin `algorithms` on every jwt.verify() call so a verifier cannot be steered
 * into an unexpected algorithm (alg-confusion) or into accepting an unsigned
 * token (`alg: none`). Signing is symmetric HS256 with a single shared secret;
 * pinning here makes that guarantee explicit and centralized so it cannot drift
 * between call sites.
 *
 * Cascade note (public lab): keep this as the single import point for JWT
 * options. If a call site legitimately needs a different (e.g. asymmetric)
 * algorithm for an external API, give it its own explicit options object rather
 * than widening this one.
 */
import type { SignOptions, VerifyOptions } from 'jsonwebtoken';

export const JWT_ALG = 'HS256' as const;
export const JWT_VERIFY_OPTS: VerifyOptions = { algorithms: [JWT_ALG] };
export const JWT_SIGN_OPTS: SignOptions = { algorithm: JWT_ALG };

// Usage:
//   jwt.sign(payload, SECRET, { ...JWT_SIGN_OPTS, expiresIn: '15m' })
//   jwt.verify(token, SECRET, JWT_VERIFY_OPTS)

/**
 * Authenticated symmetric encryption for secrets at rest (AES-256-GCM).
 *
 * Use this to encrypt sensitive material — e.g. TOTP/authenticator seeds — so a
 * database read alone (leaked backup, injection elsewhere, an over-privileged
 * job) does not yield usable secrets. Backup/recovery codes should NOT be
 * encrypted with this; store those only as one-way hashes and show them once.
 *
 * Key resolution (lazy, on first use):
 *   - A 32-byte key (64 hex chars) from an app-encryption env var is used when set.
 *   - In production the key is REQUIRED — throw rather than fall back.
 *   - In dev/test a stable key is derived from an existing app secret so local
 *     flows work without extra configuration. NEVER used in production.
 *
 * Sealed format: `${ivBase64}.${tagBase64}.${ctBase64}` — a single string.
 * Callers can detect sealed-vs-legacy values by the presence of two `.`
 * separators (see isSealed()), which lets you migrate a column in place.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Rename these to your project's conventions before cascading.
const APP_ENCRYPTION_KEY_ENV = 'APP_ENCRYPTION_KEY';
const DEV_FALLBACK_SECRET_ENV = 'APP_SECRET';

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
    if (cachedKey) return cachedKey;

    const hex = process.env[APP_ENCRYPTION_KEY_ENV];
    if (hex) {
        const buf = Buffer.from(hex, 'hex');
        if (buf.length !== 32) {
            throw new Error(`${APP_ENCRYPTION_KEY_ENV} must be 32 bytes (64 hex characters)`);
        }
        cachedKey = buf;
        return buf;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(`${APP_ENCRYPTION_KEY_ENV} is required in production (encrypts secrets at rest)`);
    }

    // Dev/test only: derive a stable 32-byte key so local flows work without
    // extra configuration. The production guard above ensures this never runs live.
    const seed = process.env[DEV_FALLBACK_SECRET_ENV] || 'dev';
    cachedKey = createHash('sha256').update(`app-enc:${seed}`).digest();
    return cachedKey;
}

/** True if `value` is in the sealed `iv.tag.ct` format produced by seal(). */
export function isSealed(value: string): boolean {
    return typeof value === 'string' && value.split('.').length === 3;
}

export function seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', resolveKey(), iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

export function open(sealed: string): string {
    const parts = sealed.split('.');
    if (parts.length !== 3) throw new Error('Malformed sealed value');
    const [ivB64, tagB64, ctB64] = parts;
    const decipher = createDecipheriv('aes-256-gcm', resolveKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

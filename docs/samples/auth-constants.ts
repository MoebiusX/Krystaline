/**
 * Shared authentication constants.
 *
 * Single source of truth for the bcrypt work factor. When hashing cost is
 * duplicated across call sites it tends to drift (e.g. registration uses one
 * value, the token hash another). Centralizing it removes the drift and makes a
 * future cost bump a one-line change. Existing hashes keep verifying because
 * bcrypt encodes the cost in the hash itself.
 */
export const BCRYPT_COST = 12;

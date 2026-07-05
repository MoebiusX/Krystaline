# Exactly-once for money-moving endpoints: the Idempotency-Key pattern

A retried POST must never apply an effect twice. Networks retry; users
double-click; clients time out and resend. For anything that moves value, "at
least once" delivery plus a non-idempotent handler equals double-spend.

The pattern (storage-agnostic, opt-in, non-breaking):

1. The client sends an `Idempotency-Key` header (a UUID it generates per logical
   operation). Callers that don't care about exactly-once simply omit it and the
   endpoint behaves as before.
2. The server claims a unique `(user_id, endpoint, key)` record **before**
   running the operation, using an atomic insert-if-absent (e.g. `INSERT …
   ON CONFLICT DO NOTHING`, or the equivalent conditional write in your store).
3. If the claim succeeds, run the operation, then store its response against the
   key and mark it complete.
4. If the claim fails (the key already exists), do **not** run the operation —
   replay the stored response, or return `409` if the first attempt is still in
   flight.

```
POST /transfer
Idempotency-Key: 4f1c…  →  claim (user, endpoint, key)
                            ├─ new?      run once, store result, return 200
                            └─ existing? replay stored result (or 409 if pending)
```

Notes:

- Bind the key to the request body hash so a client reusing a key with a
  *different* payload is rejected rather than silently replaying the wrong result.
- If the process dies after the operation commits but before the record is
  marked complete, leave the key `in_progress` and let a retry get `409` — never
  a second effect. Reap stale `in_progress` records with a background job.
- This is a good fit for deposits, transfers, and trade/convert submissions.

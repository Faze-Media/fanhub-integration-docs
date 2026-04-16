# External Actions MVP Runnables

This folder contains a small PNPM + TypeScript proof of concept for generating and validating HMAC-signed webhook payloads that match the canonical contract in `../README.md`.

## Prerequisites

- `pnpm`
- `node` 24+ recommended

## Install

From this folder:

```bash
pnpm install
```

## Scripts

### Generate a signed payload

```bash
pnpm generate
```

This prints a demo webhook payload containing:

- the parsed JSON body
- the exact `rawBody` string that must be signed
- headers with:
  - `x-partner-id`
  - `x-signature-timestamp`
  - `x-signature`

### Validate a payload

```bash
pnpm validate
```

This validates a generated payload using the shared secret and prints the parsed validated body.

By default, the script generates a demo payload internally before validating it.
Nullable webhook fields are canonicalized so `null` and omission are treated the same, with omission preferred to keep the signed payload smaller.

### Run the full end-to-end demo

```bash
pnpm demo
```

This script:

1. Generates a signed webhook payload
2. Validates it successfully
3. Modifies the body
4. Proves the tampered payload is rejected

### Typecheck

```bash
pnpm typecheck
```

This runs TypeScript in strict mode with Node typings enabled.

## Files

- `generate-webhook-payload.ts`
  - Creates the demo webhook body and HMAC signature
- `validate-webhook-payload.ts`
  - Verifies the signature against the exact raw body
- `generations-validation.ts`
  - Runs the happy path and tamper-detection demo

## Notes For Integrators

- The signature is computed over the exact string `${timestamp}.${rawBody}`.
- Validation must use the raw request body before any JSON parsing or reformatting.
- The demo body shape matches the canonical inbound webhook contract in `../README.md`, including `partnerActionKey`, `userIdToken`/`email`, and string-based `amount`.
- Nullable webhook fields may be omitted instead of sent as `null`; the generator and validator treat both forms as equivalent.

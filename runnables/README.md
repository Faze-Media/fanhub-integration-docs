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

It also prints the default live webhook URL that matches the current phase-1 API stub.

### Send a real webhook call

```bash
pnpm send
```

This sends the generated payload to the live webhook stub at:

```text
https://pr-531-preview.incdev.dev/api/external-actions/webhooks/:partnerId
```

If the preview URL changes, override it with:

```bash
EXTERNAL_ACTIONS_API_BASE_URL=https://your-api.example.com/api pnpm send
```

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
- `send-test-webhook-call.ts`
  - Sends the generated payload to the live webhook stub and prints the response

## Notes For Integrators

- The signature is computed over the exact string `${timestamp}.${rawBody}`.
- Validation must use the raw request body before any JSON parsing or reformatting.
- The demo body shape matches the canonical inbound webhook contract in `../README.md`, including `partnerActionKey`, `userIdToken`/`email`, and string-based `amount`.
- Nullable webhook fields may be omitted instead of sent as `null`; the generator and validator treat both forms as equivalent.
- The default partner credentials and target URL in these scripts are aligned with the current phase-1 API stub implementation.

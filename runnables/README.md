# External Actions MVP Runnables

This folder contains a small PNPM + TypeScript proof of concept for generating and validating HMAC-signed webhook payloads that match the canonical contract in `../README.md`.

## Prerequisites

- `node` 24+ recommended
  - Installation Instructions: [here](https://github.com/nvm-sh/nvm)
  - If that doesn't work, try [here](https://nodejs.org/en/download)
- `pnpm`
  - Installation Instructions: [here](https://pnpm.io/installation)

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

This reads `configuration.json`, signs the configured payload with the configured shared secret, and sends it to:

```text
https://dev.incention.io/api/external-actions/webhooks/:partnerId
```

The script builds the final webhook URL from:

- `url`: the API base URL, such as `https://dev.incention.io/api`
- `partnerId`: appended to `/external-actions/webhooks/:partnerId`
- `secret`: used to compute `x-signature`
- `payload`: serialized from the configured payload object and used as the request body

The same `partnerId` is also sent in the `x-partner-id` header.

Example configuration:

```json
{
  "url": "https://dev.incention.io/api",
  "partnerId": "7e846326-2ec3-4df4-b4c1-9780d05a010b",
  "secret": "replace-with-your-shared-secret",
  "payload": {
    "partnerActionKey": "purchase_completed",
    "partnerEventId": "purchase_12345",
    "occurredAt": "2026-04-15T14:00:00.000Z",
    "userIdToken": "uidtok_demo_user_123",
    "partnerUserId": "user_9981",
    "amount": "50.00",
    "metadata": {
      "orderId": "ord_12345",
      "sku": "john-wick-claw-pull"
    }
  }
}
```

If you want to use a different config file path, pass it as the first argument:

```bash
pnpm send ./my-webhook-config.json
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
  - Reads `configuration.json`, signs the configured payload, sends it to the live webhook stub, and prints the response
- `configuration.json`
  - Stores the target API base URL, partner ID, shared secret, and payload used by `pnpm send`

## Notes For Integrators

- The signature is computed over the exact string `${timestamp}.${rawBody}`.
- Validation must use the raw request body before any JSON parsing or reformatting.
- The demo body shape matches the canonical inbound webhook contract in `../README.md`, including `partnerActionKey`, `userIdToken`/`email`, and string-based `amount`.
- Nullable webhook fields may be omitted instead of sent as `null`; the generator and validator treat both forms as equivalent.
- The default partner credentials and target URL in these scripts are aligned with the current phase-1 API stub implementation.

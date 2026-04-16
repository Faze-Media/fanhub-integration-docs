import { createHmac } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const DEFAULT_PARTNER_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'
export const DEFAULT_SHARED_SECRET = 'external-actions-phase-one-secret'
export const DEFAULT_API_BASE_URL = 'https://pr-531-preview.incdev.dev/api'

export type WebhookBody = {
  partnerActionKey: string
  partnerEventId: string
  occurredAt: string
  userIdToken?: string | null
  email?: string | null
  partnerUserId?: string | null
  amount?: string | null
  metadata: Record<string, string>
}

export type WebhookHeaders = {
  'x-partner-id': string
  'x-signature-timestamp': string
  'x-signature': string
}

export type GeneratedWebhookPayload = {
  partnerId: string
  timestamp: string
  rawBody: string
  body: WebhookBody
  headers: WebhookHeaders
}

export type GenerateWebhookPayloadInput = {
  partnerId?: string
  sharedSecret?: string
  timestamp?: string
  body?: Partial<WebhookBody>
}

const DEFAULT_WEBHOOK_BODY: WebhookBody = {
  partnerActionKey: 'purchase_completed',
  partnerEventId: 'purchase_12345',
  occurredAt: '2026-04-15T14:00:00.000Z',
  userIdToken: 'uidtok_demo_user_123',
  // Omit nullable fields when they are not needed so the signed payload stays compact.
  partnerUserId: 'user_9981',
  amount: '50.00',
  metadata: {
    orderId: 'ord_12345',
    sku: 'john-wick-claw-pull',
  },
}

const normalizeWebhookBody = (body: WebhookBody): WebhookBody => {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null && value !== undefined),
  ) as WebhookBody
}

export const createWebhookSignature = (input: { rawBody: string; timestamp: string; sharedSecret: string }): string => {
  const signedPayload = `${input.timestamp}.${input.rawBody}`
  const signature = createHmac('sha256', input.sharedSecret).update(signedPayload).digest('hex')

  return `sha256=${signature}`
}

export const createWebhookUrl = (
  partnerId: string = DEFAULT_PARTNER_ID,
  apiBaseUrl: string = DEFAULT_API_BASE_URL,
): string => {
  return `${apiBaseUrl}/external-actions/webhooks/${encodeURIComponent(partnerId)}`
}

export const generateWebhookPayload = (input: GenerateWebhookPayloadInput = {}): GeneratedWebhookPayload => {
  const partnerId = input.partnerId ?? DEFAULT_PARTNER_ID
  const sharedSecret = input.sharedSecret ?? DEFAULT_SHARED_SECRET
  const timestamp = input.timestamp ?? Date.now().toString()
  const body = normalizeWebhookBody({
    ...DEFAULT_WEBHOOK_BODY,
    ...input.body,
  })
  const rawBody = JSON.stringify(body)
  const signature = createWebhookSignature({
    rawBody,
    timestamp,
    sharedSecret,
  })

  return {
    partnerId,
    timestamp,
    rawBody,
    body,
    headers: {
      'x-partner-id': partnerId,
      'x-signature-timestamp': timestamp,
      'x-signature': signature,
    },
  }
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const generated = generateWebhookPayload()

  console.log('Generated webhook payload:\n')
  console.log(JSON.stringify(generated, null, 2))
}

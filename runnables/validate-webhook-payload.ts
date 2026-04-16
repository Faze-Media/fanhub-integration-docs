import { timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_SHARED_SECRET,
  createWebhookSignature,
  generateWebhookPayload,
  type GeneratedWebhookPayload,
  type WebhookBody,
  type WebhookHeaders,
} from './generate-webhook-payload.ts'

export type ValidateWebhookPayloadInput = {
  rawBody: string
  headers: Partial<WebhookHeaders>
  sharedSecret: string
  expectedPartnerId?: string
  maxAgeMs?: number
  nowMs?: number
}

export type ValidatedWebhookPayload = {
  partnerId: string
  timestamp: string
  body: WebhookBody
}

const assertIsStringRecord = (value: unknown, label: string): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }

  const entries = Object.entries(value)
  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== 'string') {
      throw new Error(`${label}.${key} must be a string`)
    }
  }

  return Object.fromEntries(entries)
}

const assertOptionalNullableString = (value: unknown, label: string): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string, null, or omitted`)
  }

  return value
}

const parseWebhookBody = (rawBody: string): WebhookBody => {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawBody)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error'
    throw new Error(`Invalid JSON body: ${message}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Webhook body must be a JSON object')
  }

  const body = parsed as Partial<WebhookBody>

  if (typeof body.partnerActionKey !== 'string') {
    throw new Error('body.partnerActionKey must be a string')
  }
  if (typeof body.partnerEventId !== 'string') {
    throw new Error('body.partnerEventId must be a string')
  }
  if (typeof body.occurredAt !== 'string') throw new Error('body.occurredAt must be a string')
  const userIdToken = assertOptionalNullableString(body.userIdToken, 'body.userIdToken')
  const email = assertOptionalNullableString(body.email, 'body.email')
  const partnerUserId = assertOptionalNullableString(body.partnerUserId, 'body.partnerUserId')
  const amount = assertOptionalNullableString(body.amount, 'body.amount')

  if (!userIdToken && !email) {
    throw new Error('body.userIdToken or body.email must be provided')
  }

  const result: WebhookBody = {
    partnerActionKey: body.partnerActionKey,
    partnerEventId: body.partnerEventId,
    occurredAt: body.occurredAt,
    metadata: assertIsStringRecord(body.metadata, 'body.metadata'),
  }

  if (userIdToken !== undefined && userIdToken !== null) {
    result.userIdToken = userIdToken
  }

  if (email !== undefined && email !== null) {
    result.email = email
  }

  if (partnerUserId !== undefined && partnerUserId !== null) {
    result.partnerUserId = partnerUserId
  }

  if (amount !== undefined && amount !== null) {
    result.amount = amount
  }

  return result
}

const compareSignatures = (received: string, expected: string): boolean => {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

const requireHeader = (headers: Partial<WebhookHeaders>, headerName: keyof WebhookHeaders): string => {
  const value = headers[headerName]

  if (!value) {
    throw new Error(`Missing required header: ${headerName}`)
  }

  return value
}

export const validateWebhookPayload = (input: ValidateWebhookPayloadInput): ValidatedWebhookPayload => {
  const partnerId = requireHeader(input.headers, 'x-partner-id')
  const timestamp = requireHeader(input.headers, 'x-signature-timestamp')
  const receivedSignature = requireHeader(input.headers, 'x-signature')

  if (input.expectedPartnerId && partnerId !== input.expectedPartnerId) {
    throw new Error(`Partner mismatch: expected "${input.expectedPartnerId}" but received "${partnerId}"`)
  }

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs)) {
    throw new Error('x-signature-timestamp must be a unix epoch in milliseconds')
  }

  if (typeof input.maxAgeMs === 'number') {
    const nowMs = input.nowMs ?? Date.now()
    if (Math.abs(nowMs - timestampMs) > input.maxAgeMs) {
      throw new Error('Webhook signature timestamp is outside the allowed age window')
    }
  }

  const expectedSignature = createWebhookSignature({
    rawBody: input.rawBody,
    timestamp,
    sharedSecret: input.sharedSecret,
  })

  if (!compareSignatures(receivedSignature, expectedSignature)) {
    throw new Error('Invalid webhook signature')
  }

  return {
    partnerId,
    timestamp,
    body: parseWebhookBody(input.rawBody),
  }
}

const isGeneratedWebhookPayload = (value: unknown): value is GeneratedWebhookPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<GeneratedWebhookPayload>
  return (
    typeof candidate.partnerId === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.rawBody === 'string' &&
    !!candidate.headers
  )
}

const parseInputArgument = (): GeneratedWebhookPayload => {
  const inputArgument = process.argv[2]

  if (!inputArgument) {
    return generateWebhookPayload()
  }

  const parsed = JSON.parse(inputArgument) as unknown
  if (!isGeneratedWebhookPayload(parsed)) {
    throw new Error('Expected a JSON-serialized GeneratedWebhookPayload as the first CLI argument')
  }

  return parsed
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const generated = parseInputArgument()
  const validated = validateWebhookPayload({
    rawBody: generated.rawBody,
    headers: generated.headers,
    sharedSecret: DEFAULT_SHARED_SECRET,
    expectedPartnerId: generated.partnerId,
  })

  console.log('Webhook payload validated successfully:\n')
  console.log(JSON.stringify(validated, null, 2))
}

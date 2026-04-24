import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  createWebhookUrl,
  createWebhookSignature,
  type GeneratedWebhookPayload,
  type WebhookBody,
} from './generate-webhook-payload.ts'

export type SendTestWebhookCallConfig = {
  url: string
  partnerId: string
  secret: string
  payload: WebhookBody
}

export type SendTestWebhookCallInput = {
  configPath?: string
  timestamp?: string
}

export type SendTestWebhookCallResult = {
  url: string
  request: GeneratedWebhookPayload
  response: {
    ok: boolean
    status: number
    headers: Record<string, string>
    body: unknown
  }
}

const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('./configuration.json', import.meta.url))

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const assertNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected "${fieldName}" to be a non-empty string in configuration.json.`)
  }

  return value
}

const assertOptionalNullableString = (value: unknown, fieldName: string): string | null | undefined => {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected "${fieldName}" to be a string, null, or omitted in configuration.json.`)
  }

  return value
}

const assertMetadata = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    throw new Error('Expected "payload.metadata" to be an object of string values in configuration.json.')
  }

  const invalidEntry = Object.entries(value).find(([, entryValue]) => typeof entryValue !== 'string')

  if (invalidEntry) {
    throw new Error(`Expected "payload.metadata.${invalidEntry[0]}" to be a string in configuration.json.`)
  }

  return value as Record<string, string>
}

const parseWebhookBody = (value: unknown): WebhookBody => {
  if (!isRecord(value)) {
    throw new Error('Expected "payload" to be an object in configuration.json.')
  }

  return {
    partnerActionKey: assertNonEmptyString(value.partnerActionKey, 'payload.partnerActionKey'),
    partnerEventId: assertNonEmptyString(value.partnerEventId, 'payload.partnerEventId'),
    occurredAt: assertNonEmptyString(value.occurredAt, 'payload.occurredAt'),
    userIdToken: assertOptionalNullableString(value.userIdToken, 'payload.userIdToken'),
    email: assertOptionalNullableString(value.email, 'payload.email'),
    partnerUserId: assertOptionalNullableString(value.partnerUserId, 'payload.partnerUserId'),
    amount: assertOptionalNullableString(value.amount, 'payload.amount'),
    metadata: assertMetadata(value.metadata),
  }
}

const parseSendTestWebhookCallConfig = (value: unknown): SendTestWebhookCallConfig => {
  if (!isRecord(value)) {
    throw new Error('Expected configuration.json to contain a JSON object.')
  }

  return {
    url: assertNonEmptyString(value.url, 'url').replace(/\/+$/, ''),
    partnerId: assertNonEmptyString(value.partnerId, 'partnerId'),
    secret: assertNonEmptyString(value.secret, 'secret'),
    payload: parseWebhookBody(value.payload),
  }
}

const readSendTestWebhookCallConfig = async (configPath: string = DEFAULT_CONFIG_PATH): Promise<SendTestWebhookCallConfig> => {
  const rawConfig = await readFile(configPath, 'utf8')

  try {
    return parseSendTestWebhookCallConfig(JSON.parse(rawConfig))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse configuration JSON at "${configPath}": ${error.message}`)
    }

    throw error
  }
}

const buildSignedWebhookRequest = (
  config: SendTestWebhookCallConfig,
  timestamp: string = Date.now().toString(),
): GeneratedWebhookPayload => {
  const rawBody = JSON.stringify(config.payload)
  const signature = createWebhookSignature({
    rawBody,
    timestamp,
    sharedSecret: config.secret,
  })

  return {
    partnerId: config.partnerId,
    timestamp,
    rawBody,
    body: config.payload,
    headers: {
      'x-partner-id': config.partnerId,
      'x-signature-timestamp': timestamp,
      'x-signature': signature,
    },
  }
}

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const bodyText = await response.text()

  if (!bodyText) {
    return null
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return bodyText
  }
}

export const sendTestWebhookCall = async (
  input: SendTestWebhookCallInput = {},
): Promise<SendTestWebhookCallResult> => {
  const config = await readSendTestWebhookCallConfig(input.configPath)
  const request = buildSignedWebhookRequest(config, input.timestamp)
  const url = createWebhookUrl(config.partnerId, config.url)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...request.headers,
    },
    body: request.rawBody,
  })

  return {
    url,
    request,
    response: {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await parseResponseBody(response),
    },
  }
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  sendTestWebhookCall({
    configPath: process.argv[2],
  })
    .then((result) => {
      console.log('Sent webhook request to:\n')
      console.log(result.url)
      console.log('\nRequest headers:\n')
      console.log(JSON.stringify(result.request.headers, null, 2))
      console.log('\nRequest raw body:\n')
      console.log(result.request.rawBody)
      console.log('\nResponse:\n')
      console.log(
        JSON.stringify(
          {
            status: result.response.status,
            ok: result.response.ok,
            headers: result.response.headers,
            body: result.response.body,
          },
          null,
          2,
        ),
      )

      if (!result.response.ok) {
        process.exitCode = 1
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error)
      console.error('Failed to send webhook request:\n')
      console.error(message)
      process.exitCode = 1
    })
}

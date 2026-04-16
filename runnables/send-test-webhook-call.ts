import { fileURLToPath } from 'node:url'
import {
  createWebhookUrl,
  DEFAULT_API_BASE_URL,
  generateWebhookPayload,
  type GenerateWebhookPayloadInput,
} from './generate-webhook-payload.ts'

export type SendTestWebhookCallInput = GenerateWebhookPayloadInput & {
  apiBaseUrl?: string
}

export type SendTestWebhookCallResult = {
  url: string
  request: ReturnType<typeof generateWebhookPayload>
  response: {
    ok: boolean
    status: number
    headers: Record<string, string>
    body: unknown
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
  const request = generateWebhookPayload(input)
  const apiBaseUrl = input.apiBaseUrl ?? process.env.EXTERNAL_ACTIONS_API_BASE_URL ?? DEFAULT_API_BASE_URL
  const url = createWebhookUrl(request.partnerId, apiBaseUrl)

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
  sendTestWebhookCall()
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

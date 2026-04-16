import { fileURLToPath } from 'node:url'
import {
  createWebhookUrl,
  DEFAULT_SHARED_SECRET,
  generateWebhookPayload,
} from './generate-webhook-payload.ts'
import { validateWebhookPayload } from './validate-webhook-payload.ts'

const markFailure = (message: string) => {
  console.error(`❌ ${message}`)
  process.exitCode = 1
}

const markSuccess = (message: string) => {
  console.log(`✅ ${message}`)
}

export const runGenerationValidation = () => {
  const generated = generateWebhookPayload()
  const wrongSharedSecret = `${DEFAULT_SHARED_SECRET}-wrong`

  console.log('1. Generating signed webhook payload...\n')
  console.log(JSON.stringify(generated, null, 2))
  console.log('\nDefault webhook URL:\n')
  console.log(createWebhookUrl(generated.partnerId))

  console.log('\n2. Validating generated payload...\n')
  const validated = validateWebhookPayload({
    rawBody: generated.rawBody,
    headers: generated.headers,
    sharedSecret: DEFAULT_SHARED_SECRET,
    expectedPartnerId: generated.partnerId,
    maxAgeMs: 5 * 60 * 1000,
    nowMs: Number(generated.timestamp) + 1_000,
  })
  console.log('✅ Validated payload:\n', JSON.stringify(validated, null, 2))

  console.log('\n3. Proving tamper detection...\n')
  const tamperedBody = JSON.stringify({
    ...generated.body,
    amount: '500.00',
  })

  try {
    validateWebhookPayload({
      rawBody: tamperedBody,
      headers: generated.headers,
      sharedSecret: DEFAULT_SHARED_SECRET,
      expectedPartnerId: generated.partnerId,
      maxAgeMs: 5 * 60 * 1000,
      nowMs: Number(generated.timestamp) + 1_000,
    })
    markFailure('Tampered payload unexpectedly validated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown validation error'
    markSuccess(`Tampered payload rejected as expected: ${message}`)
  }

  console.log('\n4. Proving wrong-key rejection...\n')
  const generatedWithWrongKey = generateWebhookPayload({
    sharedSecret: wrongSharedSecret,
  })

  try {
    validateWebhookPayload({
      rawBody: generatedWithWrongKey.rawBody,
      headers: generatedWithWrongKey.headers,
      sharedSecret: DEFAULT_SHARED_SECRET,
      expectedPartnerId: generatedWithWrongKey.partnerId,
      maxAgeMs: 5 * 60 * 1000,
      nowMs: Number(generatedWithWrongKey.timestamp) + 1_000,
    })
    markFailure('Wrong-key payload unexpectedly validated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown validation error'
    markSuccess(`Wrong-key payload rejected as expected: ${message}`)
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\n❌ PoC completed with failures.')
    return
  }

  console.log('\n✅ PoC complete: generation and validation are working end-to-end.')
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  runGenerationValidation()
}

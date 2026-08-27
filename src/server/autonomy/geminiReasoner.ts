import { createCanonicalGeminiRuntime, type CanonicalGeminiRuntime } from '../ai/runtime.ts'
import { AUTONOMY_SYSTEM_PROMPT, buildAutonomyUserPrompt } from './prompts.ts'
import { validateAutonomyDecision } from './schema.ts'
import type { AutonomyReasonerContext, AutonomyReasonerDecision, IAutonomyReasoner } from './types.ts'

export class GeminiAutonomyReasoner implements IAutonomyReasoner {
  private readonly runtime: CanonicalGeminiRuntime

  constructor(runtime: CanonicalGeminiRuntime = createCanonicalGeminiRuntime()) {
    this.runtime = runtime
  }

  async reason(context: AutonomyReasonerContext): Promise<AutonomyReasonerDecision> {
    const userPrompt = buildAutonomyUserPrompt(context)
    const allowedMissionIds = context.availableMissions.map((m) => m.id)

    let lastError: unknown = null
    const maxRetries = 4

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.runtime.generateContent({
          model: this.runtime.model,
          contents: userPrompt,
          config: {
            systemInstruction: AUTONOMY_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })

        const rawText = response.text
        if (!rawText) {
          throw new Error('Empty response received from Gemini')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(rawText)
        } catch (err: unknown) {
          throw new Error(`Model output could not be parsed as JSON: ${err instanceof Error ? err.message : String(err)}`)
        }

        return validateAutonomyDecision(parsed, allowedMissionIds)
      } catch (err: unknown) {
        lastError = err
        const errStatus =
          (err as { status?: number; statusCode?: number })?.status ||
          (err as { status?: number; statusCode?: number })?.statusCode
        const message = err instanceof Error ? err.message : String(err)
        const isTransient =
          errStatus === 429 ||
          errStatus === 503 ||
          message.includes('503') ||
          message.includes('UNAVAILABLE') ||
          message.includes('429') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('quota') ||
          message.includes('rate limit')

        if (attempt < maxRetries && isTransient) {
          let delayMs = Math.pow(2, attempt) * 1500
          const delayMatch =
            message.match(/retry in ([0-9.]+)s/i) || message.match(/retryDelay[":\s]+([0-9]+)s/i)
          if (delayMatch && delayMatch[1]) {
            const requestedSeconds = parseFloat(delayMatch[1])
            if (!isNaN(requestedSeconds)) {
              delayMs = Math.max(delayMs, Math.ceil(requestedSeconds * 1000) + 600)
            }
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
        break
      }
    }

    throw lastError || new Error('Failed to reason autonomy decision with Gemini')
  }
}

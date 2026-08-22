import type { NextActionProposal } from '../../domain/course.ts'
import {
  COMPANION_NEXT_ACTION_SYSTEM_PROMPT,
  buildNextActionUserPrompt,
} from './prompts.ts'
import type { INextActionProposer, NextActionContext, NextActionLatencyTrace } from './types.ts'
import { createCanonicalGeminiRuntime, type CanonicalGeminiRuntime } from '../ai/runtime.ts'

export class GeminiNextActionProposer implements INextActionProposer {
  private readonly runtime: CanonicalGeminiRuntime

  constructor(runtime: CanonicalGeminiRuntime = createCanonicalGeminiRuntime()) {
    this.runtime = runtime
  }

  async proposeNextAction(context: NextActionContext): Promise<NextActionProposal> {
    const promptStartedAt = performance.now()
    const userPrompt = buildNextActionUserPrompt(context)
    const promptBuildMs = performance.now() - promptStartedAt

    let lastError: unknown = null
    const maxRetries = 4
    let vertexMs = 0

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const vertexStartedAt = performance.now()
        const response = await this.runtime.generateContent({
          model: this.runtime.model,
          contents: userPrompt,
          config: {
            systemInstruction: COMPANION_NEXT_ACTION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })
        vertexMs += performance.now() - vertexStartedAt

        const validationStartedAt = performance.now()
        const rawText = response.text || ''
        const parsed = JSON.parse(rawText) as NextActionProposal

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Model returned non-object JSON')
        }

        if (parsed.type === 'ASK_CLARIFICATION') {
          if (!parsed.question?.trim()) {
            throw new Error('ASK_CLARIFICATION requires non-empty question')
          }
          const proposal: NextActionProposal = {
            type: 'ASK_CLARIFICATION',
            question: parsed.question.trim(),
            rationale: parsed.rationale?.trim() || 'Aclarar preferencia de formato.',
          }
          this.emitLatencyTrace(context, {
            attempts: attempt,
            promptBuildMs,
            vertexMs,
            validationMs: performance.now() - validationStartedAt,
            promptCharacters: COMPANION_NEXT_ACTION_SYSTEM_PROMPT.length + userPrompt.length,
            outputCharacters: rawText.length,
          }, response)
          return proposal
        }

        if (parsed.type === 'RECOMMEND_MISSION') {
          if (!parsed.missionId?.trim()) {
            throw new Error('RECOMMEND_MISSION requires non-empty missionId')
          }
          const proposal: NextActionProposal = {
            type: 'RECOMMEND_MISSION',
            missionId: parsed.missionId.trim(),
            rationale: parsed.rationale?.trim() || 'Ruta recomendada.',
          }
          this.emitLatencyTrace(context, {
            attempts: attempt,
            promptBuildMs,
            vertexMs,
            validationMs: performance.now() - validationStartedAt,
            promptCharacters: COMPANION_NEXT_ACTION_SYSTEM_PROMPT.length + userPrompt.length,
            outputCharacters: rawText.length,
          }, response)
          return proposal
        }

        throw new Error(`Unknown proposal type: ${(parsed as any).type}`)
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

    throw lastError || new Error('Failed to propose next action with Gemini')
  }

  private emitLatencyTrace(
    context: NextActionContext,
    trace: NextActionLatencyTrace,
    response: unknown,
  ) {
    const usage = (response as {
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        thoughtsTokenCount?: number
        totalTokenCount?: number
      }
    }).usageMetadata

    context.onLatencyTrace?.({
      ...trace,
      promptTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      thoughtsTokens: usage?.thoughtsTokenCount,
      totalTokens: usage?.totalTokenCount,
    })
  }
}

import type {
  ImplementationArtifact,
  Mission,
  MissionInteractionTurn,
  ProgressState,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../../domain/course.ts'
import { COMPANION_SYSTEM_INSTRUCTION, buildCompanionUserPrompt } from './prompts.ts'
import { validateEvidenceEvaluation } from './schema.ts'
import type { IEvidenceInterpreter } from './types.ts'
import { createCanonicalGeminiRuntime, type CanonicalGeminiRuntime } from '../ai/runtime.ts'

export class GeminiEvidenceInterpreter implements IEvidenceInterpreter {
  private readonly runtime: CanonicalGeminiRuntime

  constructor(runtime: CanonicalGeminiRuntime = createCanonicalGeminiRuntime()) {
    this.runtime = runtime
  }

  async interpret(params: {
    mission: Mission
    evidence: string
    consumedArtifacts?: Record<string, ImplementationArtifact>
    currentProgress?: ProgressState
    recentInteraction?: MissionInteractionTurn[]
    learnerHelpPreference?: 'DIRECT' | 'QUESTIONS' | 'EXAMPLE' | 'ADAPTIVE'
    rubric?: Rubric
  }): Promise<StructuredEvidenceEvaluation> {
    const {
      mission,
      evidence,
      consumedArtifacts,
      currentProgress,
      recentInteraction,
      learnerHelpPreference,
      rubric,
    } = params
    const userPrompt = buildCompanionUserPrompt(
      mission,
      evidence,
      consumedArtifacts,
      currentProgress,
      recentInteraction,
      learnerHelpPreference,
      rubric,
    )

    let lastError: unknown
    const maxRetries = 4

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.runtime.generateContent({
          model: this.runtime.model,
          contents: userPrompt,
          config: {
            systemInstruction: COMPANION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 0,
            },
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
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(`Model output could not be parsed as JSON: ${message}`)
        }

        return validateEvidenceEvaluation(parsed, rubric || mission.rubric)
      } catch (err: unknown) {
        lastError = err
        const errStatus =
          (err as { status?: number; statusCode?: number })?.status ||
          (err as { status?: number; statusCode?: number })?.statusCode
        const errMsg = err instanceof Error ? err.message : String(err)
        const isTransient =
          errStatus === 429 ||
          errStatus === 503 ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('rate limit')

        if (isTransient && attempt < maxRetries) {
          let waitMs = attempt * 3000
          const delayMatch =
            errMsg.match(/retry in ([0-9.]+)s/i) || errMsg.match(/retryDelay[":\s]+([0-9]+)s/i)
          if (delayMatch && delayMatch[1]) {
            const requestedSeconds = parseFloat(delayMatch[1])
            if (!isNaN(requestedSeconds)) {
              waitMs = Math.max(waitMs, Math.ceil(requestedSeconds * 1000) + 600)
            }
          }
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          continue
        }
        break
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

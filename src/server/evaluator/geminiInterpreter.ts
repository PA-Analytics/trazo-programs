import { GoogleGenAI } from '@google/genai'
import type { Mission, StructuredEvidenceEvaluation } from '../../domain/course.ts'
import { COMPANION_SYSTEM_INSTRUCTION, buildCompanionUserPrompt } from './prompts.ts'
import { validateEvidenceEvaluation } from './schema.ts'
import type { IEvidenceInterpreter } from './types.ts'

/**
 * Google Gen AI SDK Evidence Interpreter.
 * Evaluates untrusted learner evidence using the Google Gen AI SDK (@google/genai)
 * with a Gemini 3.5+ model (e.g. gemini-3.7-flash).
 */
export class GeminiEvidenceInterpreter implements IEvidenceInterpreter {
  private ai: GoogleGenAI
  private model: string

  constructor(apiKey?: string, model?: string) {
    const rawKey = apiKey || process.env.GEMINI_API_KEY
    const key = rawKey?.trim()
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY is not set. Live evaluation requires a valid Google Gemini API key.',
      )
    }
    this.ai = new GoogleGenAI({ apiKey: key })

    // Require Gemini 3.5+ model; default to gemini-3.7-flash (no older 2.5 fallbacks)
    const configuredModel = (model || process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim()
    this.model = configuredModel
  }

  async interpret(params: {
    mission: Mission
    evidence: string
  }): Promise<StructuredEvidenceEvaluation> {
    const { mission, evidence } = params
    if (!mission.rubric) {
      throw new Error(`Mission '${mission.id}' has no configured rubric`)
    }

    const userPrompt = buildCompanionUserPrompt(mission, evidence)

    let lastError: unknown
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: userPrompt,
          config: {
            systemInstruction: COMPANION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
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

        return validateEvidenceEvaluation(parsed, mission.rubric)
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
          const backoffMs = attempt * 2000
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
          continue
        }
        break
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

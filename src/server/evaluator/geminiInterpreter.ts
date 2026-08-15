import { GoogleGenAI } from '@google/genai'
import type { Mission, StructuredEvidenceEvaluation } from '../../domain/course.ts'
import { COMPANION_SYSTEM_INSTRUCTION, buildCompanionUserPrompt } from './prompts.ts'
import { validateEvidenceEvaluation } from './schema.ts'
import type { IEvidenceInterpreter } from './types.ts'

export interface GeminiEvidenceInterpreterOptions {
  apiKey?: string
  model?: string
  project?: string
  location?: string
}

/**
 * Google Gen AI SDK Evidence Interpreter.
 * Evaluates untrusted learner evidence using the Google Gen AI SDK (@google/genai)
 * with a Gemini 3.5+ model (e.g. gemini-3.7-flash) on Vertex AI or Google AI.
 */
export class GeminiEvidenceInterpreter implements IEvidenceInterpreter {
  private ai: GoogleGenAI
  private model: string

  constructor(optionsOrApiKey?: string | GeminiEvidenceInterpreterOptions, model?: string) {
    let opts: GeminiEvidenceInterpreterOptions = {}
    if (typeof optionsOrApiKey === 'string') {
      opts = { apiKey: optionsOrApiKey, model }
    } else if (optionsOrApiKey) {
      opts = optionsOrApiKey
    }

    this.model = (opts.model || model || process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim()

    const rawKey = opts.apiKey || process.env.GEMINI_API_KEY
    const explicitProject = opts.project || process.env.GOOGLE_CLOUD_PROJECT
    const location = opts.location || process.env.GOOGLE_CLOUD_LOCATION || 'global'

    if (opts.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: opts.apiKey.trim() })
    } else if (rawKey && !explicitProject) {
      this.ai = new GoogleGenAI({ apiKey: rawKey.trim() })
    } else {
      const project = explicitProject || 'trazo-agentic-2026'
      this.ai = new GoogleGenAI({
        vertexai: true,
        project,
        location,
      })
    }
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
    const maxRetries = 4

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

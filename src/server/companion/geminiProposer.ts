import { GoogleGenAI } from '@google/genai'
import type { NextActionProposal } from '../../domain/course.ts'
import {
  COMPANION_NEXT_ACTION_SYSTEM_PROMPT,
  buildNextActionUserPrompt,
} from './prompts.ts'
import type { INextActionProposer, NextActionContext } from './types.ts'

export interface GeminiNextActionProposerOptions {
  apiKey?: string
  modelName?: string
  project?: string
  location?: string
}

export class GeminiNextActionProposer implements INextActionProposer {
  private ai: GoogleGenAI
  private modelName: string

  constructor(optionsOrApiKey?: string | GeminiNextActionProposerOptions, modelName?: string) {
    let opts: GeminiNextActionProposerOptions = {}
    if (typeof optionsOrApiKey === 'string') {
      opts = { apiKey: optionsOrApiKey, modelName }
    } else if (optionsOrApiKey) {
      opts = optionsOrApiKey
    }

    this.modelName = (opts.modelName || modelName || process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim()

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

  async proposeNextAction(context: NextActionContext): Promise<NextActionProposal> {
    const systemPrompt = COMPANION_NEXT_ACTION_SYSTEM_PROMPT
    const userPrompt = buildNextActionUserPrompt(context)

    let lastError: unknown = null
    const maxRetries = 4

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })

        const rawText = response.text || ''
        const parsed = JSON.parse(rawText) as NextActionProposal

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Model returned non-object JSON')
        }

        if (parsed.type === 'ASK_CLARIFICATION') {
          if (!parsed.question?.trim()) {
            throw new Error('ASK_CLARIFICATION requires non-empty question')
          }
          return {
            type: 'ASK_CLARIFICATION',
            question: parsed.question.trim(),
            rationale: parsed.rationale?.trim() || 'Aclarar preferencia de formato.',
          }
        }

        if (parsed.type === 'RECOMMEND_MISSION') {
          if (!parsed.missionId?.trim()) {
            throw new Error('RECOMMEND_MISSION requires non-empty missionId')
          }
          return {
            type: 'RECOMMEND_MISSION',
            missionId: parsed.missionId.trim(),
            rationale: parsed.rationale?.trim() || 'Ruta recomendada.',
          }
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
}

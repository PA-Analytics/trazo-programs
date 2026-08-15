import { GoogleGenAI } from '@google/genai'
import type { NextActionProposal } from '../../domain/course.ts'
import {
  COMPANION_NEXT_ACTION_SYSTEM_PROMPT,
  buildNextActionUserPrompt,
} from './prompts.ts'
import type { INextActionProposer, NextActionContext } from './types.ts'

export class GeminiNextActionProposer implements INextActionProposer {
  private ai: GoogleGenAI
  private modelName: string

  constructor(apiKey?: string, modelName?: string) {
    const rawKey = apiKey || process.env.GEMINI_API_KEY
    const key = rawKey?.trim()
    if (!key) {
      throw new Error(
        'GeminiNextActionProposer requires GEMINI_API_KEY environment variable or explicit apiKey',
      )
    }

    this.ai = new GoogleGenAI({ apiKey: key })
    this.modelName = (modelName || process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim()
  }

  async proposeNextAction(context: NextActionContext): Promise<NextActionProposal> {
    const systemPrompt = COMPANION_NEXT_ACTION_SYSTEM_PROMPT
    const userPrompt = buildNextActionUserPrompt(context)

    let lastError: unknown = null
    const maxRetries = 3

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
          const delayMs = Math.pow(2, attempt) * 1500
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
        break
      }
    }

    throw lastError || new Error('Failed to propose next action with Gemini')
  }
}

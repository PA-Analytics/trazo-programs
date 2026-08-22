import { GoogleGenAI } from '@google/genai'

export interface GeminiGenerateRequest {
  model: string
  contents: string
  config?: Record<string, unknown>
}

export interface GeminiGenerateResponse {
  text?: string
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    totalTokenCount?: number
  }
}

export interface GeminiClient {
  models: {
    generateContent(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse>
  }
}

export interface CanonicalGeminiRuntime {
  readonly model: string
  readonly project: string
  readonly location: string
  readonly authMode: 'vertex-adc' | 'explicit-local-api-key' | 'injected-test-client'
  generateContent(request: Omit<GeminiGenerateRequest, 'model'> & { model?: string }): Promise<GeminiGenerateResponse>
}

const DEFAULT_PROJECT = 'trazo-agentic-2026'
const DEFAULT_LOCATION = 'global'
const DEFAULT_MODEL = 'gemini-3.7-flash'

function resolveConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.GCLOUD_PROJECT?.trim() || DEFAULT_PROJECT
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || DEFAULT_LOCATION
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
  return { project, location, model }
}

class CanonicalRuntime implements CanonicalGeminiRuntime {
  private readonly client: GeminiClient
  readonly project: string
  readonly location: string
  readonly model: string
  readonly authMode: CanonicalGeminiRuntime['authMode']

  constructor(
    client: GeminiClient,
    project: string,
    location: string,
    model: string,
    authMode: CanonicalGeminiRuntime['authMode'],
  ) {
    this.client = client
    this.project = project
    this.location = location
    this.model = model
    this.authMode = authMode
  }

  generateContent(request: Omit<GeminiGenerateRequest, 'model'> & { model?: string }) {
    return this.client.models.generateContent({
      ...request,
      model: request.model?.trim() || this.model,
    })
  }
}

export function createCanonicalGeminiRuntime(options: { client?: GeminiClient } = {}): CanonicalGeminiRuntime {
  const config = resolveConfig()
  if (options.client) {
    return new CanonicalRuntime(options.client, config.project, config.location, config.model, 'injected-test-client')
  }

  const explicitLocalApiKey = process.env.TRAZO_LOCAL_AI_AUTH === 'api-key'
  if (process.env.NODE_ENV === 'production' && explicitLocalApiKey) {
    throw new Error('Production runtime only supports Vertex AI through service identity')
  }

  if (explicitLocalApiKey) {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new Error('TRAZO_LOCAL_AI_AUTH=api-key requires GEMINI_API_KEY')
    const client = new GoogleGenAI({ apiKey })
    return new CanonicalRuntime(client, config.project, config.location, config.model, 'explicit-local-api-key')
  }

  const client = new GoogleGenAI({
    vertexai: true,
    project: config.project,
    location: config.location,
  })
  return new CanonicalRuntime(client, config.project, config.location, config.model, 'vertex-adc')
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Mission, NextActionProposal } from '../domain/course'

interface CompanionNextActionProps {
  implementationId: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onSelectMission: (missionId: string) => void
  onRecommendationChange: (missionId: string | null) => void
}

export function CompanionNextAction({
  implementationId,
  availableMissions,
  onStartMission,
  onSelectMission,
  onRecommendationChange,
}: CompanionNextActionProps) {
  const [proposal, setProposal] = useState<NextActionProposal | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  const fetchNextAction = useCallback(
    async (clarification?: string) => {
      requestControllerRef.current?.abort()
      const controller = new AbortController()
      requestControllerRef.current = controller
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/v1/implementations/${implementationId}/next-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarification: clarification || null }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `Error del servidor (${response.status})`)
        }

        const nextProposal: NextActionProposal = await response.json()
        if (controller.signal.aborted) return
        setProposal(nextProposal)
        onRecommendationChange(
          nextProposal.type === 'RECOMMEND_MISSION' ? nextProposal.missionId : null,
        )
      } catch (caught) {
        if (controller.signal.aborted) return
        const message = caught instanceof Error ? caught.message : 'Error al consultar la siguiente ruta'
        setError(message)
        onRecommendationChange(null)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    },
    [implementationId, onRecommendationChange],
  )

  useEffect(
    () => () => {
      requestControllerRef.current?.abort()
      onRecommendationChange(null)
    },
    [onRecommendationChange],
  )

  useEffect(() => {
    if (availableMissions.length > 1 && !proposal && !isLoading && !error) {
      void fetchNextAction()
    }
  }, [availableMissions.length, error, fetchNextAction, isLoading, proposal])

  async function handleClarificationSubmit(event: FormEvent) {
    event.preventDefault()
    if (!clarificationAnswer.trim() || isLoading) return
    await fetchNextAction(clarificationAnswer.trim())
  }

  async function handleStartMission(missionId: string) {
    setIsStarting(true)
    try {
      await onStartMission(missionId)
      onRecommendationChange(null)
      onSelectMission(missionId)
    } finally {
      setIsStarting(false)
    }
  }

  if (availableMissions.length <= 1) return null

  return (
    <section className="companion-next-action-bar" aria-labelledby="companion-next-action-title">
      <div className="companion-next-action-card">
        <div className="companion-next-action-header">
          <span className="companion-next-action-tag">Siguiente ruta</span>
          <h3 id="companion-next-action-title">
            {proposal?.type === 'ASK_CLARIFICATION'
              ? 'Elige cómo avanzar'
              : proposal?.type === 'RECOMMEND_MISSION'
                ? 'Ruta sugerida'
                : 'Preparando opciones'}
          </h3>
        </div>

        {isLoading && (
          <p className="companion-next-action-loading">
            Revisando las rutas disponibles para tu siguiente acción.
          </p>
        )}

        {error && (
          <div className="companion-next-action-error">
            <p>{error}</p>
            <button type="button" className="companion-retry-btn" onClick={() => void fetchNextAction(clarificationAnswer)}>
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && proposal?.type === 'ASK_CLARIFICATION' && (
          <div className="companion-clarification-block">
            <p className="companion-question">“{proposal.question}”</p>
            <p className="companion-rationale">{proposal.rationale}</p>

            <div className="companion-quick-chips" role="group" aria-label="Opciones rápidas de formato">
              <button
                type="button"
                className="companion-chip"
                onClick={() => {
                  const answer = 'Quiero que se entienda rápido y sea muy directa.'
                  setClarificationAnswer(answer)
                  void fetchNextAction(answer)
                }}
              >
                Directa y concisa
              </button>
              <button
                type="button"
                className="companion-chip"
                onClick={() => {
                  const answer = 'Quiero conectar a través de una historia y narrativa.'
                  setClarificationAnswer(answer)
                  void fetchNextAction(answer)
                }}
              >
                Narrativa con historia
              </button>
            </div>

            <form onSubmit={handleClarificationSubmit} className="companion-clarification-form">
              <input
                type="text"
                className="companion-clarification-input"
                placeholder="O escribe tu preferencia específica…"
                value={clarificationAnswer}
                onChange={(event) => setClarificationAnswer(event.target.value)}
              />
              <button
                type="submit"
                className="companion-clarification-btn"
                disabled={!clarificationAnswer.trim() || isLoading}
              >
                Responder →
              </button>
            </form>
          </div>
        )}

        {!isLoading && proposal?.type === 'RECOMMEND_MISSION' && (
          <div className="companion-recommendation-block">
            <div className="companion-recommendation-content">
              <strong>
                {availableMissions.find((mission) => mission.id === proposal.missionId)?.title || proposal.missionId}
              </strong>
              <p>“{proposal.rationale}”</p>
            </div>
            <div className="companion-recommendation-actions">
              <button
                type="button"
                className="companion-start-btn"
                disabled={isStarting}
                onClick={() => void handleStartMission(proposal.missionId)}
              >
                {isStarting ? 'Iniciando misión…' : 'Empezar esta misión →'}
              </button>
              <button
                type="button"
                className="companion-switch-btn"
                onClick={() => {
                  setProposal(null)
                  setClarificationAnswer('')
                  onRecommendationChange(null)
                }}
              >
                Cambiar preferencia
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

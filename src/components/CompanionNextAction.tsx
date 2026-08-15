import { useCallback, useEffect, useState } from 'react'
import type { Mission, NextActionProposal } from '../domain/course'

interface CompanionNextActionProps {
  implementationId: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onSelectMission: (missionId: string) => void
}

export function CompanionNextAction({
  implementationId,
  availableMissions,
  onStartMission,
  onSelectMission,
}: CompanionNextActionProps) {
  const [proposal, setProposal] = useState<NextActionProposal | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNextAction = useCallback(
    async (clarification?: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/implementations/${implementationId}/next-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarification: clarification || null }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Error del servidor (${res.status})`)
        }

        const data: NextActionProposal = await res.json()
        setProposal(data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al consultar al Acompañante'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [implementationId],
  )

  // Automatically request next action if multiple branches are available and no proposal has been loaded
  useEffect(() => {
    if (availableMissions.length > 1 && !proposal && !isLoading && !error) {
      void fetchNextAction()
    }
  }, [availableMissions.length, error, fetchNextAction, isLoading, proposal])

  const handleClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clarificationAnswer.trim() || isLoading) return
    await fetchNextAction(clarificationAnswer.trim())
  }

  const handleStartMission = async (missionId: string) => {
    setIsStarting(true)
    try {
      await onStartMission(missionId)
      onSelectMission(missionId)
    } finally {
      setIsStarting(false)
    }
  }

  if (availableMissions.length <= 1) {
    return null
  }

  return (
    <section className="companion-next-action-bar" aria-labelledby="companion-next-action-title">
      <div className="companion-next-action-card">
        <div className="companion-next-action-header">
          <span className="companion-next-action-tag">Acompañante de Implementación</span>
          <h3 id="companion-next-action-title">
            {proposal?.type === 'ASK_CLARIFICATION'
              ? 'Decisión de Ruta Metodológica'
              : proposal?.type === 'RECOMMEND_MISSION'
                ? 'Ruta Sugerida para tu Pieza'
                : 'Explorando siguientes pasos…'}
          </h3>
        </div>

        {isLoading && (
          <p className="companion-next-action-loading">
            El Acompañante está evaluando el estado de tu implementación y opciones disponibles…
          </p>
        )}

        {error && (
          <div className="companion-next-action-error">
            <p>{error}</p>
            <button
              type="button"
              className="companion-retry-btn"
              onClick={() => void fetchNextAction(clarificationAnswer)}
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && proposal?.type === 'ASK_CLARIFICATION' && (
          <div className="companion-clarification-block">
            <p className="companion-question">"{proposal.question}"</p>
            <p className="companion-rationale">{proposal.rationale}</p>
            
            <div className="companion-quick-chips" role="group" aria-label="Opciones rápidas de formato">
              <button
                type="button"
                className="companion-chip"
                onClick={() => {
                  setClarificationAnswer('Quiero que se entienda rápido y sea muy directa.')
                  void fetchNextAction('Quiero que se entienda rápido y sea muy directa.')
                }}
              >
                🎯 Directa y concisa
              </button>
              <button
                type="button"
                className="companion-chip"
                onClick={() => {
                  setClarificationAnswer('Quiero conectar a través de una historia y narrativa.')
                  void fetchNextAction('Quiero conectar a través de una historia y narrativa.')
                }}
              >
                📖 Narrativa con historia
              </button>
            </div>

            <form onSubmit={handleClarificationSubmit} className="companion-clarification-form">
              <input
                type="text"
                className="companion-clarification-input"
                placeholder="O escribe tu preferencia específica…"
                value={clarificationAnswer}
                onChange={(e) => setClarificationAnswer(e.target.value)}
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
                Recomendación: {availableMissions.find((m) => m.id === proposal.missionId)?.title || proposal.missionId}
              </strong>
              <p>"{proposal.rationale}"</p>
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

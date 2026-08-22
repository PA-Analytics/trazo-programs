import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Mission, NextActionProposal, NextActionTurn } from '../domain/course'

interface CompanionNextActionProps {
  userId: string
  implementationId: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onSelectMission: (missionId: string) => void
  onRecommendationChange: (missionId: string | null) => void
}

function proposalTurn(proposal: NextActionProposal): NextActionTurn | null {
  return proposal.type === 'ASK_CLARIFICATION'
    ? { role: 'companion', content: proposal.question }
    : null
}

export function CompanionNextAction({
  implementationId,
  userId,
  availableMissions,
  onStartMission,
  onSelectMission,
  onRecommendationChange,
}: CompanionNextActionProps) {
  const [proposal, setProposal] = useState<NextActionProposal | null>(null)
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [decisionTurns, setDecisionTurns] = useState<NextActionTurn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const initialRequestTimerRef = useRef<number | null>(null)
  const initialRequestScheduledRef = useRef(false)

  const fetchNextAction = useCallback(
    async (learnerMessage?: string, previousTurns: NextActionTurn[] = []) => {
      requestControllerRef.current?.abort()
      const controller = new AbortController()
      requestControllerRef.current = controller
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/v1/implementations/${implementationId}/next-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': userId },
          body: JSON.stringify({
            clarification: learnerMessage || null,
            recentDecisionTurns: previousTurns.slice(-6),
          }),
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Next action request failed')

        const nextProposal: NextActionProposal = await response.json()
        if (controller.signal.aborted) return

        setProposal(nextProposal)
        onRecommendationChange(
          nextProposal.type === 'RECOMMEND_MISSION' ? nextProposal.missionId : null,
        )

        const companionTurn = proposalTurn(nextProposal)
        setDecisionTurns(
          [
            ...previousTurns,
            ...(learnerMessage ? [{ role: 'learner' as const, content: learnerMessage }] : []),
            ...(companionTurn ? [companionTurn] : []),
          ].slice(-6),
        )
        setClarificationAnswer('')
      } catch {
        if (controller.signal.aborted) return
        setError('Ahora no pude mirar las rutas. Intenta otra vez.')
        onRecommendationChange(null)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    },
    [implementationId, onRecommendationChange, userId],
  )

  useEffect(() => {
    requestControllerRef.current?.abort()
    setProposal(null)
    setClarificationAnswer('')
    setDecisionTurns([])
    setError(null)
    initialRequestScheduledRef.current = false
  }, [implementationId])

  useEffect(() => {
    if (
      availableMissions.length <= 1 ||
      proposal ||
      isLoading ||
      error ||
      initialRequestScheduledRef.current
    ) {
      return
    }

    // StrictMode rehearses effects in development. Deferring the request lets the rehearsal
    // clean up before a network call reaches Vertex.
    initialRequestTimerRef.current = window.setTimeout(() => {
      initialRequestScheduledRef.current = true
      void fetchNextAction()
    }, 0)

    return () => {
      if (initialRequestTimerRef.current !== null) {
        window.clearTimeout(initialRequestTimerRef.current)
        initialRequestTimerRef.current = null
      }
    }
  }, [availableMissions.length, error, fetchNextAction, isLoading, proposal])

  useEffect(
    () => () => {
      requestControllerRef.current?.abort()
      onRecommendationChange(null)
    },
    [onRecommendationChange],
  )

  async function submitClarification(answer: string) {
    const learnerMessage = answer.trim()
    if (!learnerMessage || isLoading) return
    await fetchNextAction(learnerMessage, decisionTurns)
  }

  async function handleClarificationSubmit(event: FormEvent) {
    event.preventDefault()
    await submitClarification(clarificationAnswer)
  }

  async function handleStartMission(missionId: string) {
    setIsStarting(true)
    try {
      await onStartMission(missionId)
      setDecisionTurns([])
      onRecommendationChange(null)
      onSelectMission(missionId)
    } finally {
      setIsStarting(false)
    }
  }

  function restartDecision() {
    setProposal(null)
    setClarificationAnswer('')
    setDecisionTurns([])
    setError(null)
    onRecommendationChange(null)
    initialRequestScheduledRef.current = false
  }

  if (availableMissions.length <= 1) return null

  const priorTurns = decisionTurns.filter(
    (turn, index) =>
      !(
        index === decisionTurns.length - 1 &&
        turn.role === 'companion' &&
        proposal?.type === 'ASK_CLARIFICATION' &&
        turn.content === proposal.question
      ),
  )

  return (
    <section className="companion-next-action-bar" aria-labelledby="companion-next-action-title">
      <div className="companion-next-action-card">
        <div className="companion-next-action-header">
          <span className="companion-next-action-tag">Siguiente ruta</span>
          <h3 id="companion-next-action-title">
            {proposal?.type === 'RECOMMEND_MISSION' ? 'Vamos por aqui' : 'TRAZO'}
          </h3>
        </div>

        {priorTurns.length > 0 && (
          <ol className="companion-decision-thread" aria-label="Conversacion reciente sobre la ruta">
            {priorTurns.map((turn, index) => (
              <li key={`${turn.role}-${index}`} data-role={turn.role}>
                <span>{turn.role === 'companion' ? 'TRAZO' : 'Tu'}</span>
                <p>{turn.content}</p>
              </li>
            ))}
          </ol>
        )}

        {isLoading && (
          <p className="companion-next-action-loading" aria-live="polite">
            Dejame ver cual ruta te queda mejor...
          </p>
        )}

        {error && (
          <div className="companion-next-action-error">
            <p>{error}</p>
            <button
              type="button"
              className="companion-retry-btn"
              onClick={() =>
                clarificationAnswer.trim()
                  ? void submitClarification(clarificationAnswer)
                  : void fetchNextAction(undefined, decisionTurns)
              }
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && proposal?.type === 'ASK_CLARIFICATION' && (
          <div className="companion-clarification-block">
            <p className="companion-question">{proposal.question}</p>

            <div className="companion-quick-chips" role="group" aria-label="Opciones rapidas de formato">
              <button
                type="button"
                className="companion-chip"
                onClick={() => void submitClarification('Quiero que se entienda rapido y sea muy directa.')}
              >
                Directa y concisa
              </button>
              <button
                type="button"
                className="companion-chip"
                onClick={() => void submitClarification('Quiero conectar a traves de una historia y narrativa.')}
              >
                Narrativa con historia
              </button>
            </div>

            <form onSubmit={handleClarificationSubmit} className="companion-clarification-form">
              <label className="visually-hidden" htmlFor="next-action-clarification">
                Responde a TRAZO sobre la ruta que prefieres
              </label>
              <input
                id="next-action-clarification"
                type="text"
                className="companion-clarification-input"
                placeholder="O dime que buscas..."
                value={clarificationAnswer}
                onChange={(event) => setClarificationAnswer(event.target.value)}
              />
              <button
                type="submit"
                className="companion-clarification-btn"
                disabled={!clarificationAnswer.trim() || isLoading}
              >
                Enviar -&gt;
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
              <p>{proposal.rationale}</p>
            </div>
            <div className="companion-recommendation-actions">
              <button
                type="button"
                className="companion-start-btn"
                disabled={isStarting}
                onClick={() => void handleStartMission(proposal.missionId)}
              >
                {isStarting ? 'Entrando...' : 'Ir a esta ruta ->'}
              </button>
              <button type="button" className="companion-switch-btn" onClick={restartDecision}>
                Cambiar rumbo
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

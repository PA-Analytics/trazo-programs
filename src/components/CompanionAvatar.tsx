import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { CompassDirection8, CompanionState } from '../domain/companion'
import type { MapPosition, Mission, NextActionProposal, NextActionTurn } from '../domain/course'
import { useCompanionTraveler } from '../hooks/useCompanionTraveler'
import { TrazzCharacter, type TrazzEmotion, type TrazzFacing } from './TrazzCharacter'

export interface CompanionHandle {
  moveToNode: (svgPathData: string, targetMissionId: string) => void
  teleportTo: (pos: MapPosition, direction?: CompassDirection8) => void
  cancelTravel: () => void
  setState: (state: CompanionState) => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
}

export interface CompanionAvatarProps {
  initialPosition: MapPosition
  userId: string
  implementationId: string
  activeMissionId?: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onSelectMission: (missionId: string) => void
  onRecommendationChange: (missionId: string | null) => void
  onTravelStart?: (targetMissionId: string) => void
  onTravelComplete?: (targetMissionId: string) => void
  isEvaluating?: boolean
  isVerifiedAction?: boolean
  proposalOverride?: NextActionProposal | null
}

function proposalTurn(proposal: NextActionProposal): NextActionTurn | null {
  return proposal.type === 'ASK_CLARIFICATION'
    ? { role: 'companion', content: proposal.question }
    : null
}

// Cost guard for automatic next-action fetching. Scoped at module level (not per
// component instance) so React StrictMode double-mounts and parent remounts cannot
// reset it: after one failed automatic request the gate is held until the learner
// explicitly retries, and while a request is in flight no other instance refires.
interface CompanionAutoFetchGate {
  inFlight: boolean
  held: boolean
}

const autoFetchGates = new Map<string, CompanionAutoFetchGate>()

function autoFetchGateFor(key: string): CompanionAutoFetchGate {
  let gate = autoFetchGates.get(key)
  if (!gate) {
    gate = { inFlight: false, held: false }
    autoFetchGates.set(key, gate)
  }
  return gate
}

export const CompanionAvatar = forwardRef<CompanionHandle, CompanionAvatarProps>(
  function CompanionAvatar(
    {
      initialPosition,
      userId,
      implementationId,
      activeMissionId,
      availableMissions,
      onStartMission,
      onSelectMission,
      onRecommendationChange,
      onTravelStart,
      onTravelComplete,
      isEvaluating = false,
      isVerifiedAction = false,
      proposalOverride = null,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mascotBtnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLElement>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [tapCount, setTapCount] = useState(0)
    const [isSquished, setIsSquished] = useState(false)
    const [tapReaction, setTapReaction] = useState<string | null>(null)
    const [verifiedCueActive, setVerifiedCueActive] = useState(false)
    const [stateOverride, setStateOverride] = useState<CompanionState | null>(null)
    const [isMoving, setIsMoving] = useState(false)
    const [facing, setFacing] = useState<TrazzFacing>('left')
    const lastTapTimeRef = useRef<number>(0)
    const tapTimeoutRef = useRef<number | null>(null)
    const verifiedTimeoutRef = useRef<number | null>(null)

    // Estado del diálogo con TRAZO
    const [proposal, setProposal] = useState<NextActionProposal | null>(proposalOverride)
    const [clarificationAnswer, setClarificationAnswer] = useState('')
    const [decisionTurns, setDecisionTurns] = useState<NextActionTurn[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [error, setError] = useState<string | null>(
      autoFetchGateFor(`${userId}:${implementationId}`).held
        ? 'Ahora no pude mirar las rutas. Intenta otra vez.'
        : null,
    )
    const requestControllerRef = useRef<AbortController | null>(null)
    const autoFetchGateKey = `${userId}:${implementationId}`

    // Sincronizar proposalOverride si se pasa externamente
    useEffect(() => {
      if (proposalOverride) {
        setProposal(proposalOverride)
      }
    }, [proposalOverride])

    const handleTravelStart = useCallback(
      (targetMissionId: string) => {
        setIsOpen(false)
        setIsMoving(true)
        onTravelStart?.(targetMissionId)
      },
      [onTravelStart],
    )

    const handleTravelArrival = useCallback(
      (targetMissionId: string) => {
        setIsMoving(false)
        setFacing('left')
        onTravelComplete?.(targetMissionId)
        onSelectMission(targetMissionId)
      },
      [onSelectMission, onTravelComplete],
    )

    const handleDirectionChange = useCallback((newFacing: TrazzFacing) => {
      setFacing(newFacing)
    }, [])

    const handleMovingChange = useCallback((moving: boolean) => {
      setIsMoving(moving)
    }, [])

    const { travelAlongPath, teleportTo, cancelTravel } = useCompanionTraveler({
      containerRef,
      onTravelStart: handleTravelStart,
      onTravelComplete: handleTravelArrival,
      onDirectionChange: handleDirectionChange,
      onMovingChange: handleMovingChange,
    })

    // Exponer métodos imperativos vía ref
    useImperativeHandle(ref, () => ({
      moveToNode: (svgPathData: string, targetMissionId: string) => {
        setIsOpen(false)
        travelAlongPath(svgPathData, targetMissionId)
      },
      teleportTo: (pos: MapPosition, direction: CompassDirection8 = 'SE') => {
        teleportTo(pos, direction)
      },
      cancelTravel: () => cancelTravel(),
      setState: (state: CompanionState) => {
        setStateOverride(state)
        if (containerRef.current) {
          containerRef.current.dataset.state = state
        }
      },
      openPanel: () => setIsOpen(true),
      closePanel: () => setIsOpen(false),
      togglePanel: () => setIsOpen((prev) => !prev),
    }))

    // Consultar próxima acción / recomendación
    const fetchNextAction = useCallback(
      async (learnerMessage?: string, previousTurns: NextActionTurn[] = []) => {
        requestControllerRef.current?.abort()
        const controller = new AbortController()
        requestControllerRef.current = controller
        const gate = autoFetchGateFor(autoFetchGateKey)
        gate.inFlight = true
        setIsLoading(true)
        setError(null)

        try {
          const response = await fetch(
            `/api/v1/implementations/${implementationId}/next-action`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': userId },
              body: JSON.stringify({
                clarification: learnerMessage || null,
                recentDecisionTurns: previousTurns.slice(-6),
              }),
              signal: controller.signal,
            },
          )

          if (!response.ok) throw new Error('Next action request failed')

          const nextProposal: NextActionProposal = await response.json()
          if (controller.signal.aborted) return

          gate.inFlight = false
          gate.held = false

          setError(null)
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
          gate.inFlight = false
          gate.held = true
          setError('Ahora no pude mirar las rutas. Intenta otra vez.')
          onRecommendationChange(null)
        } finally {
          if (!controller.signal.aborted) setIsLoading(false)
        }
      },
    [autoFetchGateKey, implementationId, onRecommendationChange, userId],
    )

    useEffect(() => {
      const gate = autoFetchGateFor(autoFetchGateKey)
      if (
        availableMissions.length > 1 &&
        !proposal &&
        !isLoading &&
        !gate.held &&
        !gate.inFlight
      ) {
        void fetchNextAction()
      }
    }, [availableMissions.length, autoFetchGateKey, fetchNextAction, isLoading, proposal])

    // Modo TRAZO / Verificación
    useEffect(() => {
      if (isVerifiedAction) {
        setVerifiedCueActive(true)
        if (verifiedTimeoutRef.current) window.clearTimeout(verifiedTimeoutRef.current)
        verifiedTimeoutRef.current = window.setTimeout(() => {
          setVerifiedCueActive(false)
        }, 3000)
      }
    }, [isVerifiedAction])

    // Determinar el estado visual y la emoción de Trazz
    const visualState: CompanionState =
      stateOverride ??
      (verifiedCueActive
        ? 'verified'
        : isEvaluating || isLoading
          ? 'thinking'
          : proposal?.type === 'ASK_CLARIFICATION' || proposal?.type === 'RECOMMEND_MISSION'
            ? 'attention'
            : 'idle')

    const characterEmotion: TrazzEmotion =
      isMoving
        ? 'walking'
        : isSquished
          ? 'surprised'
          : verifiedCueActive || visualState === 'verified'
            ? 'celebrate'
            : isEvaluating
              ? 'annotating'
              : visualState === 'thinking' || isLoading
                ? 'thinking'
                : 'idle'

    // Sincronizar dataset del estado cuando no está en movimiento
    useEffect(() => {
      if (containerRef.current && containerRef.current.dataset.state !== 'moving') {
        containerRef.current.dataset.state = visualState
      }
    }, [visualState])

    // Auto-dismissal listeners: Escape key and click outside
    useEffect(() => {
      if (!isOpen) return

      function handleKeyDown(event: globalThis.KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
          mascotBtnRef.current?.focus()
        }
      }

      function handlePointerDownOutside(event: globalThis.PointerEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as globalThis.Node)
        ) {
          setIsOpen(false)
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('pointerdown', handlePointerDownOutside)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('pointerdown', handlePointerDownOutside)
      }
    }, [isOpen])

    // Manejar toques / clics y micro-reacciones
    function handleMascotClick(event: MouseEvent) {
      event.stopPropagation()
      const now = Date.now()
      const timeSinceLastTap = now - lastTapTimeRef.current
      lastTapTimeRef.current = now

      if (timeSinceLastTap < 350) {
        const nextTap = tapCount + 1
        setTapCount(nextTap)

        if (nextTap >= 3) {
          setIsSquished(true)
          setTapReaction('¡Oye! Estoy aquí concentrado jaja')
          if (tapTimeoutRef.current) window.clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = window.setTimeout(() => {
            setTapReaction(null)
            setIsSquished(false)
            setTapCount(0)
          }, 2400)
        }
      } else {
        setTapCount(1)
        setIsOpen((prev) => {
          if (!prev) {
            const gate = autoFetchGateFor(autoFetchGateKey)
            if (gate.held) {
              setError('Ahora no pude mirar las rutas. Intenta otra vez.')
            }
          }
          return !prev
        })
      }
    }

    function stopPointerEvent(event: PointerEvent | MouseEvent) {
      event.stopPropagation()
    }

    async function handleClarificationSubmit(event: FormEvent) {
      event.preventDefault()
      const msg = clarificationAnswer.trim()
      if (!msg || isLoading) return
      await fetchNextAction(msg, decisionTurns)
    }

    async function handleStartMission(missionId: string) {
      setIsStarting(true)
      try {
        await onStartMission(missionId)
        setDecisionTurns([])
        onRecommendationChange(null)
        onSelectMission(missionId)
        setIsOpen(false)
      } finally {
        setIsStarting(false)
      }
    }

    const stateLabelMap: Record<CompanionState, string> = {
      idle: 'Reposo',
      attention: 'Atención (sugerencia de ruta o duda)',
      thinking: 'Analizando',
      moving: 'En camino',
      verified: 'Modo TRAZO (Verificado)',
    }
    const contextMission =
      availableMissions.find((mission) => mission.id === activeMissionId) ?? availableMissions[0]

    const isInitializedRef = useRef(false)

    useEffect(() => {
      if (!isInitializedRef.current && containerRef.current) {
        isInitializedRef.current = true
        containerRef.current.style.transform = `translate3d(${initialPosition.x}px, ${initialPosition.y}px, 0)`
        containerRef.current.style.zIndex = `${Math.floor(initialPosition.y / 10) + 15}`
      }
    }, [initialPosition])

    return (
      <div
        ref={containerRef}
        className="trazo-companion-root nodrag nopan"
        data-state={visualState}
        data-direction="SE"
        data-open={isOpen}
        data-motion-phase="settled"
        data-contact="settled"
        onClick={stopPointerEvent}
        onPointerDown={stopPointerEvent}
        onMouseDown={stopPointerEvent}
      >
        {/* Sombra desacoplada en el plano del suelo */}
        <div className="trazo-companion-shadow" aria-hidden="true" />

        {/* Botón físico interactivo de la Mascota */}
        <button
          ref={mascotBtnRef}
          type="button"
          className={`trazo-companion-body-btn nodrag nopan ${isSquished ? 'trazo-squish' : ''}`}
          onClick={handleMascotClick}
          aria-label={`Acompañante TRAZO: ${stateLabelMap[visualState]}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          {/* Anillo exterior Modo TRAZO */}
          <div className="trazo-companion-halo" aria-hidden="true" />

          {/* Personaje Animado Oficial de TRAZO */}
          <TrazzCharacter state={characterEmotion} facing={facing} />

          {/* Cue de Atención ("Tengo una duda" / "Vamos por aquí") */}
          {visualState === 'attention' && !isOpen && (
            <div className="trazo-attention-pill" role="status">
              <span>
                {proposal?.type === 'ASK_CLARIFICATION' ? 'Tengo una duda' : 'Vamos por aquí'}
              </span>
            </div>
          )}

          {/* Sello de Modo TRAZO verificado ("yep. eso sí") */}
          {visualState === 'verified' && !isOpen && (
            <div className="trazo-verified-badge" role="status">
              <span>yep. eso sí</span>
            </div>
          )}

          {/* Micro-reacción de toque rápido */}
          {tapReaction && (
            <div className="trazo-reaction-bubble" role="status">
              {tapReaction}
            </div>
          )}
        </button>

        {isOpen && (
          <aside
            ref={panelRef}
            className="trazo-anchored-panel nodrag nopan"
            role="dialog"
            aria-label="Diálogo con Acompañante TRAZO"
            onClick={stopPointerEvent}
            onPointerDown={stopPointerEvent}
            onMouseDown={stopPointerEvent}
          >
            <div className="trazo-thought-bubble__signature">
              <span>TRAZZ</span>
              <button
                type="button"
                className="trazo-panel-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar panel de conversación"
              >
                ✕
              </button>
            </div>

            <div className="trazo-panel-body">
              {decisionTurns.length > 0 && (
                <ol className="trazo-panel-turns">
                  {decisionTurns.map((turn, index) => (
                    <li key={`${turn.role}-${index}`} data-role={turn.role}>
                      <span className="trazo-turn-speaker">
                        {turn.role === 'companion' ? 'TRAZZ' : 'Tú'}
                      </span>
                      <p>{turn.content}</p>
                    </li>
                  ))}
                </ol>
              )}

              {isLoading && (
                <p className="trazo-panel-status" aria-live="polite">
                  Examinando el mapa y tus opciones...
                </p>
              )}

              {error && (
                <div className="trazo-panel-error">
                  <p>{error}</p>
                  <button
                    type="button"
                    className="trazo-panel-retry"
                    onClick={() => {
                      autoFetchGateFor(autoFetchGateKey).held = false
                      void fetchNextAction(undefined, decisionTurns)
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!isLoading && !error && !proposal && contextMission && (
                <div className="trazo-panel-wayfinder">
                  <span>En ruta</span>
                  <strong>{contextMission.title}</strong>
                  <p>
                    {activeMissionId
                      ? 'Este es tu trabajo actual. Abre la misión para continuar con la evidencia.'
                      : 'Esta misión está disponible. Ábrela para revisar el trabajo requerido.'}
                  </p>
                  <button
                    type="button"
                    className="trazo-panel-route-btn"
                    onClick={() => {
                      onSelectMission(contextMission.id)
                      setIsOpen(false)
                    }}
                  >
                    Abrir misión →
                  </button>
                </div>
              )}

              {!isLoading && proposal?.type === 'ASK_CLARIFICATION' && (
                <div className="trazo-panel-clarification">
                  <p className="trazo-clarification-prompt">{proposal.question}</p>
                </div>
              )}

              {!isLoading && proposal?.type === 'RECOMMEND_MISSION' && (
                <div className="trazo-panel-recommendation">
                  <div className="trazo-recommendation-info">
                    <strong>
                      {availableMissions.find((m) => m.id === proposal.missionId)?.title ||
                        proposal.missionId}
                    </strong>
                    <p>{proposal.rationale}</p>
                  </div>
                  <button
                    type="button"
                    className="trazo-start-mission-btn"
                    disabled={isStarting}
                    onClick={() => void handleStartMission(proposal.missionId)}
                  >
                    {isStarting ? 'Entrando...' : 'Ir a esta ruta →'}
                  </button>
                </div>
              )}

              {!isLoading && !error && (
                <form onSubmit={handleClarificationSubmit} className="trazo-clarification-form trazo-thought-question">
                  <label className="visually-hidden" htmlFor="trazz-question">
                    Pregunta a Trazz
                  </label>
                  <input
                    id="trazz-question"
                    type="text"
                    className="trazo-clarification-input"
                    placeholder={
                      proposal?.type === 'ASK_CLARIFICATION'
                        ? 'Responde a Trazz…'
                        : 'Pregúntame sobre este paso…'
                    }
                    value={clarificationAnswer}
                    onChange={(event) => setClarificationAnswer(event.target.value)}
                    autoFocus={proposal?.type === 'ASK_CLARIFICATION'}
                  />
                  <button
                    type="submit"
                    className="trazo-clarification-submit"
                    disabled={!clarificationAnswer.trim()}
                  >
                    Preguntar
                  </button>
                </form>
              )}
            </div>
          </aside>
        )}
      </div>
    )
  },
)

import { useState } from 'react'
import type { Course, ImplementationState } from '../domain/course'
import { ProductRouteFrame } from './ProductRouteFrame'
import { TrazzSlot } from './TrazzSlot'

interface LearnerQuickSetupProps {
  userId: string
  displayName?: string
  implementationId: string
  course?: Course
  onComplete: (state: ImplementationState) => void
}

interface RouteOption {
  id: string
  index: string
  title: string
  detail: string
}

function resolveBranchOptions(course?: Course): RouteOption[] {
  const chapter = course?.chapters[0]
  if (!chapter) {
    return []
  }

  // Detect branch targets from forks in chapter 1
  const outgoingBySource = new Map<string, string[]>()
  for (const edge of chapter.edges) {
    const list = outgoingBySource.get(edge.source) ?? []
    list.push(edge.target)
    outgoingBySource.set(edge.source, list)
  }

  const fork = [...outgoingBySource.entries()].find(([, targets]) => targets.length > 1)
  if (fork) {
    const [, targets] = fork
    const missionById = new Map(chapter.missions.map((m) => [m.id, m]))
    const branchLetters = ['A', 'B', 'C', 'D']

    return targets
      .map((targetId, idx) => {
        const mission = missionById.get(targetId)
        if (!mission) return null
        const letter = branchLetters[idx] ?? String(idx + 1)

        return {
          id: targetId,
          index: `03${letter}`,
          title: mission.title,
          detail: mission.description || mission.mapSubtitle || 'Ruta de entrega del programa.',
        }
      })
      .filter((opt): opt is RouteOption => opt !== null)
  }

  // Linear pack fallback
  const firstMission = chapter.missions[0]
  if (!firstMission) return []

  return [
    {
      id: firstMission.id,
      index: '03',
      title: course.title,
      detail: chapter.mapPromise ?? firstMission.description ?? 'Recorrido estándar del programa.',
    },
  ]
}

export function LearnerQuickSetup({
  userId,
  displayName = 'Alumno',
  implementationId,
  course,
  onComplete,
}: LearnerQuickSetupProps) {
  const options = resolveBranchOptions(course)
  const [selectedRouteId, setSelectedRouteId] = useState<string>(options[0]?.id ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep selection synchronized when options load
  const effectiveRouteId = selectedRouteId || options[0]?.id || ''

  async function confirmRoute() {
    if (!effectiveRouteId) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/implementations/${encodeURIComponent(implementationId)}/learner-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': userId },
        body: JSON.stringify({
          preferredRouteId: effectiveRouteId,
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu preferencia de ruta.')
      onComplete((await response.json()) as ImplementationState)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu preferencia de ruta.')
    } finally {
      setIsSaving(false)
    }
  }

  if (options.length === 0) {
    return (
      <ProductRouteFrame
        variant="branch"
        stages={[
          { label: 'Identidad', state: 'complete' },
          { label: 'Rol: Alumno', state: 'complete' },
          { label: 'Enfoque de ruta', state: 'current' },
          { label: 'Mapa y misiones', state: 'future' },
        ]}
      >
        <section className="role-branch learner-route-setup" aria-labelledby="first-run-route-title">
          <header className="role-branch__header">
            <span className="setup-eyebrow">TRAZO · {displayName}</span>
            <h1 id="first-run-route-title">Cargando recorrido…</h1>
            <p>Obteniendo la estructura metodológica del programa.</p>
          </header>
          <div className="role-branch__wayfinder">
            <TrazzSlot />
          </div>
        </section>
      </ProductRouteFrame>
    )
  }

  const activeOption = options.find((opt) => opt.id === effectiveRouteId) ?? options[0]

  return (
    <ProductRouteFrame
      variant="branch"
      stages={[
        { label: 'Identidad', state: 'complete' },
        { label: 'Rol: Alumno', state: 'complete' },
        { label: 'Enfoque de ruta', state: 'current' },
        { label: 'Mapa y misiones', state: 'future' },
      ]}
    >
      <section className="role-branch learner-route-setup" aria-labelledby="first-run-route-title">
        <header className="role-branch__header">
          <span className="setup-eyebrow">TRAZO · {displayName}</span>
          <h1 id="first-run-route-title">Elige el enfoque de tu recorrido.</h1>
          <p>
            Partimos de la metodología del coach ({course?.title ?? 'Programa'}), pero tú decides qué estructura se adapta mejor a tu primera entrega.
          </p>
        </header>
        <div className="role-branch__wayfinder">
          <TrazzSlot />
        </div>

        <div className="role-branch__origin">
          <span aria-hidden="true">01</span>
          <div>
            <strong>Punto de partida · {course?.chapters[0]?.missions[0]?.title ?? 'Premisa'}</strong>
            <small>Comenzarás definiendo tu idea central; después la ruta se abrirá según tu elección.</small>
          </div>
        </div>

        <div className="role-choice-list" role="radiogroup" aria-label="Opciones de enfoque metodológico">
          {options.map((option) => {
            const isSelected = effectiveRouteId === option.id
            return (
              <button
                key={option.id}
                type="button"
                className="role-choice learner-route-choice"
                data-selected={isSelected}
                data-route={option.id}
                disabled={isSaving}
                onClick={() => setSelectedRouteId(option.id)}
                aria-checked={isSelected}
                role="radio"
              >
                <span className="role-choice__index">{option.index}</span>
                <span className="role-choice__body">
                  <strong>{option.title}</strong>
                  <small>{option.detail}</small>
                </span>
                <span className="role-choice__selector" aria-hidden="true">
                  {isSelected ? '●' : '○'}
                </span>
              </button>
            )
          })}
        </div>

        {activeOption && (
          <div className="learner-route-corridor-preview" aria-live="polite">
            <span className="corridor-preview-tag">Ruta seleccionada</span>
            <p>
              Tu mapa iluminará el corredor de <strong>{activeOption.title}</strong>. La otra alternativa seguirá disponible si decides cambiar de camino más adelante.
            </p>
          </div>
        )}

        {error && <p className="setup-error" role="alert">{error}</p>}

        <div className="learner-route-actions">
          <button
            type="button"
            className="setup-primary entry-submit"
            disabled={!effectiveRouteId || isSaving}
            onClick={() => void confirmRoute()}
          >
            {isSaving ? 'Configurando mapa…' : 'Comenzar mi recorrido →'}
          </button>
        </div>
      </section>
    </ProductRouteFrame>
  )
}

import { useEffect, useState } from 'react'
import type { AvailableTime, Course, HelpPreference, ImplementationState } from '../domain/course'
import { ProductRouteFrame } from './ProductRouteFrame'
import trazzPensandoIzquierda from '../assets/mascota-estados/pensando-izquierda/pensando-izquierda.png'
import trazzCoachEvaluador from '../assets/mascota-estados/coach-evaluador/coach-evaluador.png'

interface LearnerQuickSetupProps {
  userId: string
  displayName?: string
  implementationId: string
  course?: Course
  onComplete: (state: ImplementationState) => void
}

interface RouteOption {
  id: string
  letter: string
  title: string
  detail: string
}

function resolveBranchOptions(course?: Course): RouteOption[] {
  const chapter = course?.chapters[0]
  if (!chapter) return []

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
        const letter = branchLetters[idx] ?? String.fromCharCode(65 + idx)

        const defaultDetail =
          idx === 0
            ? 'Tesis, puntos clave y llamada a la acción. Rápida de escribir y sin rodeos.'
            : 'Conflicto, descubrimiento y desenlace. Ideal para conectar y generar recordación.'

        return {
          id: targetId,
          letter,
          title: mission.title,
          detail: defaultDetail,
        }
      })
      .filter((opt): opt is RouteOption => opt !== null)
  }

  const firstMission = chapter.missions[0]
  if (!firstMission) return []

  return [
    {
      id: firstMission.id,
      letter: 'A',
      title: course.title,
      detail: 'Tesis, puntos clave y llamada a la acción. Rápida de escribir y sin rodeos.',
    },
  ]
}

export function LearnerQuickSetup({
  userId,
  implementationId,
  course,
  onComplete,
}: LearnerQuickSetupProps) {
  const routeOptions = resolveBranchOptions(course)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routeOptions[0]?.id ?? '')
  const [helpPreference, setHelpPreference] = useState<HelpPreference>('DIRECT')
  const [availableTime, setAvailableTime] = useState<AvailableTime>('30_60_MIN')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveRouteId = selectedRouteId || routeOptions[0]?.id || ''

  const companionBriefing = {
    step1: 'La directa va al grano con datos duros. La narrativa cuenta una historia para enganchar a tu audiencia.',
    step2: 'Puedo darte el veredicto directo, hacerte preguntas guía o mostrarte ejemplos modelo.',
    step3: 'Tranquilo: no hay prisa, siempre podrás ajustar tu ritmo o pausar cuando quieras.',
  }

  async function finishSetup() {
    if (!effectiveRouteId || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/implementations/${encodeURIComponent(implementationId)}/learner-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': userId },
        body: JSON.stringify({
          preferredRouteId: effectiveRouteId,
          helpPreference,
          availableTime,
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu calibración.')
      onComplete((await response.json()) as ImplementationState)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu calibración.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleNext() {
    if (step === 1) setStep(2)
    else if (step === 2) setStep(3)
    else void finishSetup()
  }

  function handleBack() {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  // Keyboard shortcut listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isSaving) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const key = e.key.toUpperCase()

      if (step === 1) {
        if ((key === 'A' || key === '1') && routeOptions[0]) setSelectedRouteId(routeOptions[0].id)
        if ((key === 'B' || key === '2') && routeOptions[1]) setSelectedRouteId(routeOptions[1].id)
      } else if (step === 2) {
        if (key === '1' || key === 'A' || key === 'ARROWLEFT') setHelpPreference('DIRECT')
        if (key === '2' || key === 'B') setHelpPreference('QUESTIONS')
        if (key === '3' || key === 'C' || key === 'ARROWRIGHT') setHelpPreference('EXAMPLE')
      } else if (step === 3) {
        if (key === '1' || key === 'A') setAvailableTime('15_30_MIN')
        if (key === '2' || key === 'B') setAvailableTime('30_60_MIN')
        if (key === '3' || key === 'C') setAvailableTime('1_2_HOURS')
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, effectiveRouteId, helpPreference, availableTime, isSaving, routeOptions])

  return (
    <ProductRouteFrame variant="branch" hideRail>
      <section className="role-branch calibration-shell-v3" aria-labelledby="calibration-title">
        {/* Calibrator Phase Tracker Header */}
        <div className="calibrator-tracker" aria-label={`Paso ${step} de 3`}>
          <div className={`calibrator-phase ${step >= 1 ? 'calibrator-phase--active' : ''}`}>
            <span className="calibrator-phase__dot">{step > 1 ? '✓' : '01'}</span>
            <span className="calibrator-phase__label">FORMATO</span>
          </div>
          <span className="calibrator-tracker__line" />
          <div className={`calibrator-phase ${step >= 2 ? 'calibrator-phase--active' : ''}`}>
            <span className="calibrator-phase__dot">{step > 2 ? '✓' : '02'}</span>
            <span className="calibrator-phase__label">FEEDBACK</span>
          </div>
          <span className="calibrator-tracker__line" />
          <div className={`calibrator-phase ${step >= 3 ? 'calibrator-phase--active' : ''}`}>
            <span className="calibrator-phase__dot">03</span>
            <span className="calibrator-phase__label">RITMO</span>
          </div>
        </div>

        {/* Clean Editorial Header */}
        <header className="calibration-header-v3">
          <div className="calibration-header-v3__content">
            <span className="quiz-eyebrow-stamp">
              CALIBRACIÓN · PASO {step} DE 3
            </span>
            <h1 id="calibration-title" className="calibration-header-v3__title">
              {step === 1 && (
                <>
                  <span>ELIGE TU</span>
                  <span>FORMATO <span className="calibration-title__accent">INICIAL</span></span>
                </>
              )}
              {step === 2 && (
                <>
                  <span>DEFINE EL</span>
                  <span>ESTILO DE <span className="calibration-title__accent">FEEDBACK</span></span>
                </>
              )}
              {step === 3 && (
                <>
                  <span>¿CUÁNTO TIEMPO</span>
                  <span>TIENES POR <span className="calibration-title__accent">SESIÓN?</span></span>
                </>
              )}
            </h1>
            <p className="calibration-header-v3__subtitle">
              {step === 1 && 'Define cómo quieres construir y presentar tu primera entrega.'}
              {step === 2 && '¿Cómo prefieres que revise y evalúe tus entregas en cada misión?'}
              {step === 3 && 'Adaptamos la exigencia de las misiones a tu disponibilidad real.'}
            </p>
          </div>

          {/* Companion box on the right with Trazz */}
          <div className="calibration-companion-box" aria-live="polite">
            <div className="companion-bubble">
              <span className="companion-bubble__author">trazz</span>
              <p className="companion-bubble__text">
                {step === 1 && companionBriefing.step1}
                {step === 2 && companionBriefing.step2}
                {step === 3 && companionBriefing.step3}
              </p>
            </div>
            <div className="companion-avatar-slot">
              <img
                src={step === 2 ? trazzCoachEvaluador : trazzPensandoIzquierda}
                alt=""
                className={`calibration-trazz-img ${step === 2 ? 'calibration-trazz-img--writing' : ''}`}
              />
            </div>
          </div>
        </header>

        {/* PATTERN 1: THE ROUTE FORK (STEP 1) */}
        {step === 1 && (
          <div className="pattern-fork" key="pattern-1">
            <div className="fork-slabs" role="radiogroup" aria-label="Formato de entrega">
              {routeOptions.map((option) => {
                const isSelected = effectiveRouteId === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="fork-slab"
                    data-selected={isSelected}
                    onClick={() => setSelectedRouteId(option.id)}
                    onDoubleClick={handleNext}
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isSaving}
                  >
                    <div className="fork-slab__header">
                      <span className="fork-slab__keycap">{option.letter}</span>
                      <span className="fork-slab__radio" aria-hidden="true">
                        {isSelected ? '●' : '○'}
                      </span>
                    </div>
                    <strong className="fork-slab__title">{option.title}</strong>
                    <p className="fork-slab__desc">{option.detail}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PATTERN 2: FEEDBACK SLABS (STEP 2) */}
        {step === 2 && (
          <div className="pattern-spectrum" key="pattern-2">
            <div className="feedback-slabs-grid" role="radiogroup" aria-label="Estilo de feedback">
              <button
                type="button"
                className="feedback-slab"
                data-selected={helpPreference === 'DIRECT'}
                onClick={() => setHelpPreference('DIRECT')}
                onDoubleClick={handleNext}
                role="radio"
                aria-checked={helpPreference === 'DIRECT'}
                disabled={isSaving}
              >
                <div className="feedback-slab__header">
                  <span className="feedback-slab__keycap">1</span>
                  <span className="feedback-slab__badge">✦ DIRECTO</span>
                  <span className="feedback-slab__radio" aria-hidden="true">
                    {helpPreference === 'DIRECT' ? '●' : '○'}
                  </span>
                </div>
                <strong className="feedback-slab__title">AL GRANO</strong>
                <p className="feedback-slab__desc">
                  Evaluaciones enfocadas estrictamente en el cumplimiento de criterios, señalando puntos de mejora directos sin rodeos.
                </p>
              </button>

              <button
                type="button"
                className="feedback-slab"
                data-selected={helpPreference === 'QUESTIONS'}
                onClick={() => setHelpPreference('QUESTIONS')}
                onDoubleClick={handleNext}
                role="radio"
                aria-checked={helpPreference === 'QUESTIONS'}
                disabled={isSaving}
              >
                <div className="feedback-slab__header">
                  <span className="feedback-slab__keycap">2</span>
                  <span className="feedback-slab__badge">✦ MAYÉUTICA</span>
                  <span className="feedback-slab__radio" aria-hidden="true">
                    {helpPreference === 'QUESTIONS' ? '●' : '○'}
                  </span>
                </div>
                <strong className="feedback-slab__title">PREGUNTAS GUÍA</strong>
                <p className="feedback-slab__desc">
                  Trazz no te dará la solución masticada; te planteará preguntas clave para desbloquear tu propio razonamiento.
                </p>
              </button>

              <button
                type="button"
                className="feedback-slab"
                data-selected={helpPreference === 'EXAMPLE'}
                onClick={() => setHelpPreference('EXAMPLE')}
                onDoubleClick={handleNext}
                role="radio"
                aria-checked={helpPreference === 'EXAMPLE'}
                disabled={isSaving}
              >
                <div className="feedback-slab__header">
                  <span className="feedback-slab__keycap">3</span>
                  <span className="feedback-slab__badge">✦ COMPARATIVA</span>
                  <span className="feedback-slab__radio" aria-hidden="true">
                    {helpPreference === 'EXAMPLE' ? '●' : '○'}
                  </span>
                </div>
                <strong className="feedback-slab__title">CASOS MODELO</strong>
                <p className="feedback-slab__desc">
                  Cada misión incluirá ejemplos y referencias de entregas reales para calibrar tu trabajo contra el estándar.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* PATTERN 3: INTENSITY CHIPS (STEP 3) */}
        {step === 3 && (
          <div className="pattern-intensity" key="pattern-3">
            <div className="intensity-chips-grid" role="radiogroup" aria-label="Tiempo disponible">
              <button
                type="button"
                className="intensity-chip-card"
                data-selected={availableTime === '15_30_MIN'}
                onClick={() => setAvailableTime('15_30_MIN')}
                onDoubleClick={() => void finishSetup()}
                role="radio"
                aria-checked={availableTime === '15_30_MIN'}
              >
                <span className="intensity-chip-card__tag">ÁGIL</span>
                <strong className="intensity-chip-card__title">15 - 30 MIN</strong>
                <span className="intensity-chip-card__desc">Sprint rápido para validar ideas inmediatas.</span>
                <span className="intensity-chip-card__radio" aria-hidden="true">
                  {availableTime === '15_30_MIN' ? '●' : '○'}
                </span>
              </button>

              <button
                type="button"
                className="intensity-chip-card"
                data-selected={availableTime === '30_60_MIN'}
                onClick={() => setAvailableTime('30_60_MIN')}
                onDoubleClick={() => void finishSetup()}
                role="radio"
                aria-checked={availableTime === '30_60_MIN'}
              >
                <span className="intensity-chip-card__tag">EQUILIBRADO</span>
                <strong className="intensity-chip-card__title">30 - 60 MIN</strong>
                <span className="intensity-chip-card__desc">Sesión moderada para construir y pulir con calma.</span>
                <span className="intensity-chip-card__radio" aria-hidden="true">
                  {availableTime === '30_60_MIN' ? '●' : '○'}
                </span>
              </button>

              <button
                type="button"
                className="intensity-chip-card"
                data-selected={availableTime === '1_2_HOURS'}
                onClick={() => setAvailableTime('1_2_HOURS')}
                onDoubleClick={() => void finishSetup()}
                role="radio"
                aria-checked={availableTime === '1_2_HOURS'}
              >
                <span className="intensity-chip-card__tag">A FONDO</span>
                <strong className="intensity-chip-card__title">1 - 2 HORAS</strong>
                <span className="intensity-chip-card__desc">Inmersión profunda en proyectos más complejos.</span>
                <span className="intensity-chip-card__radio" aria-hidden="true">
                  {availableTime === '1_2_HOURS' ? '●' : '○'}
                </span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="setup-error role-branch__error" role="alert">
            {error}
          </p>
        )}

        {/* Footer Navigation */}
        <footer className="calibration-footer-v3">
          {step > 1 && (
            <button
              type="button"
              className="setup-secondary quiz-back-btn"
              disabled={isSaving}
              onClick={handleBack}
            >
              ← Anterior
            </button>
          )}

          <button
            type="button"
            className="setup-primary quiz-submit-btn"
            disabled={isSaving}
            onClick={handleNext}
          >
            {isSaving
              ? 'Materializando mapa…'
              : step < 3
                ? 'Siguiente paso →'
                : 'Materializar mi mapa →'}
          </button>

          <span className="quiz-step-hint" aria-hidden="true">
            {step === 1 && 'Selecciona con A / B o presiona Enter ↵'}
            {step === 2 && 'Usa 1, 2, 3 o flechas ← → y Enter ↵'}
            {step === 3 && 'Selecciona tu ritmo y presiona Enter ↵'}
          </span>
        </footer>
      </section>
    </ProductRouteFrame>
  )
}





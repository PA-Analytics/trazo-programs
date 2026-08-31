import { useEffect, useLayoutEffect, useState } from 'react'
import type { CalibrationMode, CoachSubmissionType, UserProfile } from '../domain/identity'
import trazoLogoFullWhite from '../../trazo-logo-full-white.png'
import { trazzCoachEvaluador } from '../assets/mascota-estados'

interface CoachIntroProps {
  profile: UserProfile
  onComplete: (profile: UserProfile) => void
}

type CoachStep = 1 | 2 | 3 | 4

interface StepMeta {
  eyebrow: string
  titleLines: [string, string, string]
  lead: string
  decisionIndex: string
  decisionHeading: string
  trazzCopy: string
}

const STEP_METAS: Record<CoachStep, StepMeta> = {
  1: {
    eyebrow: 'TRAZO · MODO COACH',
    titleLines: ['¿QUÉ CAMBIO', 'QUIERES', 'PROVOCAR?'],
    lead: 'Define el resultado transformador que tus alumnos deben ser capaces de demostrar.',
    decisionIndex: 'ETAPA 01 / 04 · RESULTADO',
    decisionHeading: 'RESULTADO QUE GUÍAS',
    trazzCopy:
      'El motor no evalúa intenciones. Define el artefacto o decisión concreta que separa a un novato de un competente.',
  },
  2: {
    eyebrow: 'TRAZO · MODO COACH',
    titleLines: ['¿QUÉ VAN A', 'ENTREGAR', 'PARA PROBARLO?'],
    lead: 'Selecciona las evidencias tangibles que TRAZO recibirá y auditará.',
    decisionIndex: 'ETAPA 02 / 04 · EVIDENCIA',
    decisionHeading: 'TIPOS DE ENTREGA ACEPTADOS',
    trazzCopy:
      'Cada formato activa un parser distinto. Elige señales con suficiente densidad técnica para calificar.',
  },
  3: {
    eyebrow: 'TRAZO · MODO COACH',
    titleLines: ['¿DÓNDE NACE', 'TU ESTÁNDAR', 'DE EVALUACIÓN?'],
    lead: 'Selecciona de dónde saldrán los casos para calibrar los límites entre PASS, REWORK y CLARIFY.',
    decisionIndex: 'ETAPA 03 / 04 · CRITERIO',
    decisionHeading: 'FUENTE DEL ESTÁNDAR',
    trazzCopy:
      'Para calibrar la exigencia, revisaremos una ronda rápida de casos de prueba.',
  },
  4: {
    eyebrow: 'TRAZO · MODO COACH',
    titleLines: ['MARCA EL', 'LÍMITE', 'DEL BUEN TRABAJO'],
    lead: 'Inspecciona el pliego consolidado antes de iniciar la sesión de calibración.',
    decisionIndex: 'ETAPA 04 / 04 · REVISIÓN',
    decisionHeading: 'PLIEGO CONSOLIDADO',
    trazzCopy:
      'Pliego consolidado. Ningún alumno recibirá un PASS sin superar este estándar.',
  },
}

const SUBMISSION_OPTIONS: Array<{
  value: CoachSubmissionType
  label: string
  detail: string
  waypoint: string
  key: string
}> = [
  { value: 'text', label: 'Texto / Guion', detail: 'Respuestas técnicas, guiones o especificaciones.', waypoint: '01', key: '1' },
  { value: 'document', label: 'Documento / Archivo', detail: 'PDF, hojas de cálculo o reportes descargables.', waypoint: '02', key: '2' },
  { value: 'link', label: 'Enlace / Deploy', detail: 'URLs públicas, repositorios Git o demos activas.', waypoint: '03', key: '3' },
  { value: 'image', label: 'Diseño / Imagen', detail: 'Wireframes, layouts o capturas de terminal.', waypoint: '04', key: '4' },
  { value: 'combination', label: 'Combinada', detail: 'Entregables coordinados (ej. código + enlace).', waypoint: '05', key: '5' },
  { value: 'other', label: 'Evidencia Especial', detail: 'Formatos a la medida bajo rúbrica ad-hoc.', waypoint: '06', key: '6' },
]

const MODE_OPTIONS: Array<{
  value: CalibrationMode
  label: string
  detail: string
  badge: string
  waypoint: string
  key: string
}> = [
  {
    value: 'own_examples',
    label: 'Usar mis propios ejemplos',
    detail: 'Calibras casos reales de tu autoría para fijar el umbral exacto.',
    badge: 'MÁXIMA PRECISIÓN',
    waypoint: '01',
    key: '1',
  },
  {
    value: 'generated_examples',
    label: 'Generar ejemplos con TRAZO',
    detail: 'El motor propone casos límite sintéticos y tú emites el veredicto en vivo.',
    badge: 'INICIO RÁPIDO',
    waypoint: '02',
    key: '2',
  },
  {
    value: 'mixed_examples',
    label: 'Combinar propios y asistidos',
    detail: 'Aportas entregas ancla y TRAZO genera variaciones sintéticas adversariales.',
    badge: 'HÍBRIDO SUGERIDO',
    waypoint: '03',
    key: '3',
  },
]

export function CoachIntro({ profile, onComplete }: CoachIntroProps) {
  const [step, setStep] = useState<CoachStep>(1)
  const [transformationContext, setTransformationContext] = useState('')
  const [submissionTypes, setSubmissionTypes] = useState<CoachSubmissionType[]>([])
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [step])

  function toggleSubmissionType(value: CoachSubmissionType) {
    setSubmissionTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  function handleContinue() {
    if (step === 1 && !transformationContext.trim()) return
    if (step === 2 && submissionTypes.length === 0) return
    if (step === 3 && !calibrationMode) return
    setError(null)
    setStep((current) => Math.min(4, current + 1) as CoachStep)
  }

  function handleBack() {
    setError(null)
    setStep((current) => Math.max(1, current - 1) as CoachStep)
  }

  async function handleSaveSetup() {
    if (!transformationContext.trim() || submissionTypes.length === 0 || !calibrationMode) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(profile.userId)}/coach-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile.userId },
        body: JSON.stringify({
          transformationContext: transformationContext.trim(),
          submissionTypes,
          calibrationMode,
        }),
      })
      if (!response.ok) throw new Error('No se pudo guardar la configuración del programa.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración del programa.')
    } finally {
      setIsSaving(false)
    }
  }

  // Keyboard shortcut listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isSaving) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const key = e.key.toUpperCase()

      if (step === 2) {
        const option = SUBMISSION_OPTIONS.find((o) => o.key === key || o.waypoint.endsWith(key))
        if (option) toggleSubmissionType(option.value)
      } else if (step === 3) {
        if (key === '1' || key === 'A') setCalibrationMode('own_examples')
        if (key === '2' || key === 'B') setCalibrationMode('generated_examples')
        if (key === '3' || key === 'C') setCalibrationMode('mixed_examples')
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (step < 4) handleContinue()
        else void handleSaveSetup()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        if (step > 1) {
          e.preventDefault()
          handleBack()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, transformationContext, submissionTypes, calibrationMode, isSaving])

  const currentMeta = STEP_METAS[step]

  return (
    <main className="entry-shell coach-workbench-shell" aria-labelledby="coach-workbench-title">
      <div className="coach-workbench" data-testid="coach-workbench">
        {/* COLUMNA IZQUIERDA: Hero Editorial, Orientación y Trazz Copilot Compacto */}
        <aside className="coach-step-hero">
          <div className="coach-step-hero__brand">
            <img className="coach-step-hero__logo" src={trazoLogoFullWhite} alt="TRAZO" />
            <span className="coach-step-hero__tag">ESTUDIO DE CONTROL</span>
          </div>

          <div className="coach-step-hero__center">
            <span className="setup-eyebrow">{currentMeta.eyebrow}</span>

            <h1 id="coach-workbench-title" className="coach-step-hero__title">
              <span>{currentMeta.titleLines[0]}</span>
              <span>{currentMeta.titleLines[1]}</span>
              <span className="coach-step-hero__title-accent">{currentMeta.titleLines[2]}</span>
            </h1>

            <p className="coach-step-hero__desc">{currentMeta.lead}</p>
          </div>

          {/* Micro-briefing lateral de Trazz */}
          <div className="coach-trazz-brief" aria-live="polite">
            <img
              src={trazzCoachEvaluador}
              alt="Trazz Copiloto"
              className="coach-trazz-brief__avatar"
            />
            <div className="coach-trazz-brief__text">
              <strong>TRAZZ // COPILOTO</strong>
              <p>{currentMeta.trazzCopy}</p>
            </div>
          </div>
        </aside>

        {/* COLUMNA DERECHA: Superficie Operativa Decisional */}
        <section className="coach-workbench__content" aria-label="Área de decisión del coach">
          <div className="coach-workbench__header">
            <span className="coach-workbench__index">{currentMeta.decisionIndex}</span>
            <h2 className="coach-workbench__heading">{currentMeta.decisionHeading}</h2>
          </div>

          {/* STEP 1: RESULTADO (Textarea de Alto Contraste) */}
          {step === 1 && (
            <div className="coach-workbench__body">
              <div className="coach-input-block">
                <label htmlFor="transformation-context" className="coach-input-block__label">
                  Describe la capacidad demostrable final
                </label>
                <textarea
                  id="transformation-context"
                  className="coach-textarea"
                  rows={4}
                  maxLength={500}
                  value={transformationContext}
                  onChange={(e) => setTransformationContext(e.target.value)}
                  placeholder="Ejemplo: Ayudar a diseñadores freelance a estructurar y cerrar su primera propuesta de diseño con cobro por valor."
                  autoFocus
                />
                <div className="coach-input-block__footer">
                  <span className="coach-input-block__hint">Sé concreto: ancla para calibrar la rúbrica.</span>
                  <span className="coach-input-block__counter">{transformationContext.length} / 500</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: EVIDENCIA (Multiselección con .coach-decision-row) */}
          {step === 2 && (
            <div className="coach-workbench__body">
              <fieldset className="coach-fieldset">
                <legend className="sr-only">Selecciona los tipos de evidencia válidos</legend>
                <div className="coach-decision-list" role="group" aria-label="Tipos de entrega">
                  {SUBMISSION_OPTIONS.map((option) => {
                    const isSelected = submissionTypes.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="coach-decision-row"
                        data-selected={isSelected}
                        aria-pressed={isSelected}
                        onClick={() => toggleSubmissionType(option.value)}
                      >
                        <span className="coach-decision-row__waypoint" aria-hidden="true">
                          {isSelected ? '✓' : option.waypoint}
                        </span>
                        <span className="coach-decision-row__identity">
                          <strong>{option.label}</strong>
                          <small>{option.detail}</small>
                        </span>
                        <span className="coach-decision-row__action">
                          <span>{isSelected ? 'Seleccionado' : 'Seleccionar'}</span>
                          <span aria-hidden="true">{isSelected ? '●' : '+'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {/* STEP 3: CRITERIO (Selección Única con .coach-keycap-switch) */}
          {step === 3 && (
            <div className="coach-workbench__body">
              <fieldset className="coach-fieldset">
                <legend className="sr-only">Selecciona la fuente para fijar el estándar</legend>
                <div className="coach-decision-list" role="radiogroup" aria-label="Fuente del estándar">
                  {MODE_OPTIONS.map((option) => {
                    const isSelected = calibrationMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        className="coach-decision-row coach-decision-row--radio"
                        data-selected={isSelected}
                        aria-checked={isSelected}
                        onClick={() => setCalibrationMode(option.value)}
                      >
                        <span className="coach-decision-row__waypoint" aria-hidden="true">
                          {isSelected ? '✓' : option.waypoint}
                        </span>
                        <span className="coach-decision-row__identity">
                          <div className="coach-decision-row__title-line">
                            <strong>{option.label}</strong>
                            <span className="coach-keycap-switch">{option.badge}</span>
                          </div>
                          <small>{option.detail}</small>
                        </span>
                        <span className="coach-decision-row__action">
                          <span>{isSelected ? 'Activo' : 'Elegir'}</span>
                          <span aria-hidden="true">→</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {/* STEP 4: JUICIO (Resumen Canónico) */}
          {step === 4 && (
            <div className="coach-workbench__body">
              <div className="coach-summary-grid" aria-label="Resumen de calibración configurada">
                <div className="coach-summary-card">
                  <span className="coach-summary-card__tag">01 · TRANSFORMACIÓN NUCLEAR</span>
                  <strong className="coach-summary-card__value">"{transformationContext}"</strong>
                </div>
                <div className="coach-summary-card">
                  <span className="coach-summary-card__tag">02 · EVIDENCIAS ACEPTADAS</span>
                  <div className="coach-summary-card__chips">
                    {submissionTypes.map((type) => {
                      const opt = SUBMISSION_OPTIONS.find((o) => o.value === type)
                      return <span key={type} className="coach-summary-chip">✦ {opt?.label}</span>
                    })}
                  </div>
                </div>
                <div className="coach-summary-card">
                  <span className="coach-summary-card__tag">03 · ESTRATEGIA DE CRITERIO</span>
                  <strong className="coach-summary-card__value">
                    {MODE_OPTIONS.find((o) => o.value === calibrationMode)?.label}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="setup-error" role="alert">
              {error}
            </div>
          )}

          {/* DOCK DE ACCIONES INFERIOR */}
          <footer className="coach-workbench__actions">
            {step > 1 && (
              <button
                type="button"
                className="setup-secondary coach-action-btn"
                onClick={handleBack}
                disabled={isSaving}
              >
                ← Atrás
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                className="setup-primary coach-action-btn"
                disabled={
                  isSaving ||
                  (step === 1 && !transformationContext.trim()) ||
                  (step === 2 && submissionTypes.length === 0) ||
                  (step === 3 && !calibrationMode)
                }
                onClick={handleContinue}
              >
                Continuar →
              </button>
            ) : (
              <button
                type="button"
                className="setup-primary coach-action-btn"
                disabled={isSaving}
                onClick={() => void handleSaveSetup()}
              >
                {isSaving ? 'Guardando pliego…' : 'Entrar a Calibración →'}
              </button>
            )}
          </footer>
        </section>
      </div>
    </main>
  )
}

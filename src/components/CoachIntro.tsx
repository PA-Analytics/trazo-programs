import { useLayoutEffect, useState } from 'react'
import type { CalibrationMode, CoachSubmissionType, UserProfile } from '../domain/identity'
import { ProductRouteFrame } from './ProductRouteFrame'
import type { RouteStage } from './RouteRail'

interface CoachIntroProps {
  profile: UserProfile
  onComplete: (profile: UserProfile) => void
}

type CoachStep = 1 | 2 | 3 | 4

const stageLabels = ['Resultado', 'Evidencia', 'Criterio', 'Juicio'] as const

const submissionOptions: Array<{ value: CoachSubmissionType; label: string; detail: string }> = [
  { value: 'text', label: 'Texto', detail: 'Una respuesta escrita o guion.' },
  { value: 'document', label: 'Documento / archivo', detail: 'Un archivo que se pueda revisar.' },
  { value: 'link', label: 'Enlace', detail: 'Una pieza publicada o compartida.' },
  { value: 'image', label: 'Imagen', detail: 'Una captura, diseño o referencia visual.' },
  { value: 'combination', label: 'Combinación', detail: 'Más de un tipo de entrega.' },
  { value: 'other', label: 'Otro', detail: 'Una evidencia distinta y explicable.' },
]

const modeOptions: Array<{ value: CalibrationMode; label: string; detail: string }> = [
  { value: 'own_examples', label: 'Usar mis ejemplos', detail: 'Yo marco casos que ya conozco.' },
  { value: 'generated_examples', label: 'Generar ejemplos', detail: 'TRAZO propone casos para juzgar.' },
  { value: 'mixed_examples', label: 'Mezclar ambos', detail: 'Combinamos ejemplos propios y propuestos.' },
]

function stageState(index: number, current: CoachStep): RouteStage['state'] {
  const currentIndex = current - 1
  return index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future'
}

export function CoachIntro({ profile, onComplete }: CoachIntroProps) {
  const [step, setStep] = useState<CoachStep>(1)
  const [transformationContext, setTransformationContext] = useState('')
  const [submissionTypes, setSubmissionTypes] = useState<CoachSubmissionType[]>([])
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>('.product-route')?.scrollTo({ top: 0, left: 0 })
  }, [step])

  function toggleSubmissionType(value: CoachSubmissionType) {
    setSubmissionTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  function continueToNextStep() {
    if (step === 1 && !transformationContext.trim()) return
    if (step === 2 && submissionTypes.length === 0) return
    if (step === 3 && !calibrationMode) return
    setError(null)
    setStep((current) => Math.min(4, current + 1) as CoachStep)
  }

  function goBack() {
    setError(null)
    setStep((current) => Math.max(1, current - 1) as CoachStep)
  }

  async function saveSetup() {
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
      if (!response.ok) throw new Error('No se pudo guardar el contexto del programa.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el contexto del programa.')
    } finally {
      setIsSaving(false)
    }
  }

  const stages = stageLabels.map((label, index) => ({
    label,
    state: stageState(index, step),
  }))

  return (
    <ProductRouteFrame variant="calibration" stages={stages}>
      <section key={`coach-step-${step}`} className={`sequential-scene coach-sequence coach-sequence--step-${step}`} aria-labelledby="coach-sequence-title">
        <header className="sequential-scene__header">
          <span className="setup-eyebrow">TRAZO · MODO COACH</span>
          <span className="sequential-scene__stage">0{step} / {stageLabels[step - 1]}</span>
          <h1 id="coach-sequence-title">
            {step === 1 && '¿Qué cambio quieres provocar?'}
            {step === 2 && '¿Qué van a entregar para demostrarlo?'}
            {step === 3 && '¿Cómo quieres enseñarle a TRAZO qué cuenta como buen trabajo?'}
            {step === 4 && 'Marca el límite del buen trabajo.'}
          </h1>
          <p>
            {step === 1 && 'Define el resultado que tus alumnos deberían poder demostrar.'}
            {step === 2 && 'Elige las señales que TRAZO podrá recibir y revisar.'}
            {step === 3 && 'Selecciona de dónde saldrán los casos que ayuden a fijar tu estándar.'}
            {step === 4 && 'Antes de evaluar, TRAZO necesita saber dónde empieza un PASS, un REWORK o un CLARIFY.'}
          </p>
        </header>

        <div className="sequential-scene__body">
          {step === 1 && (
            <div className="sequential-scene__field">
              <label htmlFor="transformation-context">Resultado que guías</label>
              <textarea
                id="transformation-context"
                rows={5}
                value={transformationContext}
                onChange={(event) => setTransformationContext(event.target.value)}
                placeholder="Por ejemplo: ayudar a freelancers a conseguir su primer cliente digital."
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <fieldset className="sequential-choice-fieldset">
              <legend>Tipo de evidencia</legend>
              <div className="sequential-choice-grid sequential-choice-grid--evidence">
                {submissionOptions.map((option) => {
                  const selected = submissionTypes.includes(option.value)
                  return (
                    <label className="sequential-choice" data-selected={selected} key={option.value}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSubmissionType(option.value)}
                      />
                      <span className="sequential-choice__marker" aria-hidden="true">{selected ? '✓' : ''}</span>
                      <span className="sequential-choice__copy">
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="sequential-choice-fieldset">
              <legend>Fuente del estándar</legend>
              <div className="sequential-choice-grid sequential-choice-grid--modes">
                {modeOptions.map((option) => {
                  const selected = calibrationMode === option.value
                  return (
                    <label className="sequential-choice" data-selected={selected} key={option.value}>
                      <input
                        type="radio"
                        name="calibration-mode"
                        checked={selected}
                        onChange={() => setCalibrationMode(option.value)}
                      />
                      <span className="sequential-choice__marker" aria-hidden="true">{selected ? '✓' : ''}</span>
                      <span className="sequential-choice__copy">
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <div className="sequential-summary" aria-label="Resumen de configuración">
              <div>
                <span>Resultado</span>
                <strong>{transformationContext}</strong>
              </div>
              <div>
                <span>Evidencia</span>
                <strong>{submissionTypes.map((value) => submissionOptions.find((option) => option.value === value)?.label).join(' · ')}</strong>
              </div>
              <div>
                <span>Criterio</span>
                <strong>{modeOptions.find((option) => option.value === calibrationMode)?.label}</strong>
              </div>
            </div>
          )}

          {error && <p className="setup-error" role="alert">{error}</p>}

          <div className="sequential-scene__actions">
            {step > 1 && (
              <button type="button" className="setup-secondary" onClick={goBack} disabled={isSaving}>
                ← Atrás
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                className="setup-primary sequential-scene__submit"
                disabled={
                  isSaving ||
                  (step === 1 && !transformationContext.trim()) ||
                  (step === 2 && submissionTypes.length === 0) ||
                  (step === 3 && !calibrationMode)
                }
                onClick={continueToNextStep}
              >
                Continuar →
              </button>
            ) : (
              <button
                type="button"
                className="setup-primary sequential-scene__submit"
                disabled={isSaving}
                onClick={() => void saveSetup()}
              >
                {isSaving ? 'Guardando…' : 'Ir a calibración →'}
              </button>
            )}
          </div>
        </div>
      </section>
    </ProductRouteFrame>
  )
}

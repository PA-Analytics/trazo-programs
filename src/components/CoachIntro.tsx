import { useState } from 'react'
import type { UserProfile } from '../domain/identity'
import type { CalibrationMode, CoachSubmissionType } from '../domain/identity'

interface CoachIntroProps {
  profile: UserProfile
  onComplete: (profile: UserProfile) => void
}

const submissionOptions: Array<{ value: CoachSubmissionType; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'document', label: 'Documento / archivo' },
  { value: 'link', label: 'Enlace' },
  { value: 'image', label: 'Imagen' },
  { value: 'combination', label: 'Combinación' },
  { value: 'other', label: 'Otro' },
]

const modeOptions: Array<{ value: CalibrationMode; label: string; detail: string }> = [
  { value: 'own_examples', label: 'Usar mis ejemplos', detail: 'Yo marco casos que ya conozco.' },
  { value: 'generated_examples', label: 'Generar ejemplos', detail: 'TRAZO propone casos para juzgar.' },
  { value: 'mixed_examples', label: 'Mezclar ambos', detail: 'Combinamos ejemplos propios y propuestos.' },
]

export function CoachIntro({ profile, onComplete }: CoachIntroProps) {
  const [transformationContext, setTransformationContext] = useState('')
  const [submissionTypes, setSubmissionTypes] = useState<CoachSubmissionType[]>([])
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>('mixed_examples')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSubmissionType(value: CoachSubmissionType) {
    setSubmissionTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  async function submit() {
    if (!transformationContext.trim() || submissionTypes.length === 0) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(profile.userId)}/coach-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile.userId },
        body: JSON.stringify({ transformationContext, submissionTypes, calibrationMode }),
      })
      if (!response.ok) throw new Error('No se pudo guardar el contexto del programa.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el contexto del programa.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="coach-entry-shell" aria-labelledby="coach-entry-title">
      <header className="coach-entry-header">
        <span className="setup-eyebrow">TRAZO · MODO COACH</span>
        <h1 id="coach-entry-title">Enséñale a TRAZO cómo evalúas.</h1>
        <p>Los alumnos hacen el trabajo. Tú defines qué cuenta como buen trabajo.</p>
      </header>
      <section className="coach-context-card" aria-label="Contexto del programa">
        <label htmlFor="transformation-context">¿Qué estás ayudando a conseguir?</label>
        <textarea id="transformation-context" rows={3} value={transformationContext} onChange={(event) => setTransformationContext(event.target.value)} placeholder="Por ejemplo: ayudar a freelancers a conseguir su primer cliente digital." />
        <fieldset>
          <legend>¿Qué suelen entregar tus alumnos?</legend>
          <div className="coach-chip-list">
            {submissionOptions.map((option) => (
              <label className="coach-chip" data-selected={submissionTypes.includes(option.value)} key={option.value}>
                <input type="checkbox" checked={submissionTypes.includes(option.value)} onChange={() => toggleSubmissionType(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>¿Cómo quieres enseñarle tus criterios?</legend>
          <div className="coach-mode-list">
            {modeOptions.map((option) => (
              <label className="coach-mode" data-selected={calibrationMode === option.value} key={option.value}>
                <input type="radio" name="calibration-mode" checked={calibrationMode === option.value} onChange={() => setCalibrationMode(option.value)} />
                <span><strong>{option.label}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="setup-error" role="alert">{error}</p>}
        <button type="button" className="setup-primary" disabled={!transformationContext.trim() || submissionTypes.length === 0 || isSaving} onClick={() => void submit()}>
          {isSaving ? 'Guardando…' : 'Ir a calibración →'}
        </button>
      </section>
    </main>
  )
}

import { useState } from 'react'
import type { AvailableTime, HelpPreference, ImplementationState } from '../domain/course'

interface LearnerQuickSetupProps {
  userId: string
  implementationId: string
  onComplete: (state: ImplementationState) => void
}

const goals: Array<{ value: string; label: string; detail: string }> = [
  {
    value: 'Publicar mi primera pieza estratégica',
    label: 'Publicar mi primera pieza estratégica',
    detail: 'Tener una publicación terminada, validada y lista para salir.',
  },
  {
    value: 'Validar una idea con una señal real',
    label: 'Validar una idea con una señal real',
    detail: 'Comprobar tracción con feedback concreto antes de construir más.',
  },
  {
    value: 'Construir un sistema de contenido repetible',
    label: 'Construir un sistema de contenido repetible',
    detail: 'Establecer una rutina sostenible y estructurada de producción.',
  },
]

const timeOptions: Array<{ value: AvailableTime; label: string; detail: string }> = [
  { value: '15_30_MIN', label: '15–30 min', detail: 'Bloques rápidos de enfoque directo' },
  { value: '30_60_MIN', label: '30–60 min', detail: 'Ritmo estándar para una misión' },
  { value: '1_2_HOURS', label: '1–2 horas', detail: 'Sesiones profundas de desarrollo' },
  { value: 'VARIES', label: 'Varía mucho', detail: 'Horarios flexibles según mi semana' },
]

const helpOptions: Array<{ value: HelpPreference; label: string; detail: string }> = [
  { value: 'DIRECT', label: 'Dímelo directo', detail: 'Señala qué falta sin rodeos ni preámbulos.' },
  { value: 'QUESTIONS', label: 'Hazme preguntas', detail: 'Ayúdame a descubrirlo por mí mismo con preguntas guía.' },
  { value: 'EXAMPLE', label: 'Muéstrame un ejemplo', detail: 'Aterrízalo con un caso o referencia concreta similar.' },
  { value: 'ADAPTIVE', label: 'Depende, tú decide', detail: 'Elige la ayuda que convenga según la complejidad del reto.' },
]

const stepMeta = [
  { label: '01 · Tu meta', title: '¿Qué quieres conseguir con este programa?', hint: 'Elige el resultado principal que orientará tus misiones.' },
  { label: '02 · Tu tiempo', title: 'Cuando trabajas en el programa, ¿cuánto tiempo sueles tener?', hint: 'Lo guardaré como contexto para futuras recomendaciones; no cambia el estándar ni desbloquea misiones.' },
  { label: '03 · Modo de ayuda', title: 'Cuando te atoras, ¿cómo prefieres que te ayude TRAZO?', hint: 'Ajusta el estilo de coaching que recibirás en tus revisiones de evidencia.' },
]

export function LearnerQuickSetup({ userId, implementationId, onComplete }: LearnerQuickSetupProps) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState('')
  const [availableTime, setAvailableTime] = useState<AvailableTime | ''>('')
  const [helpPreference, setHelpPreference] = useState<HelpPreference | ''>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    if (!goal || !availableTime || !helpPreference) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/implementations/${encodeURIComponent(implementationId)}/learner-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': userId },
        body: JSON.stringify({ goal, availableTime, helpPreference }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu contexto.')
      onComplete((await response.json()) as ImplementationState)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu contexto.')
    } finally {
      setIsSaving(false)
    }
  }

  const canContinue = step === 0 ? Boolean(goal) : step === 1 ? Boolean(availableTime) : Boolean(helpPreference)

  return (
    <main className="setup-shell" aria-labelledby="setup-title">
      <div className="setup-intro">
        <span className="setup-eyebrow">TRAZO · Configuración de Acompañamiento</span>
        <h1 id="setup-title">Cuéntame cómo quieres recorrerlo.</h1>
        <p>Son tres decisiones rápidas. No cambian el estándar de tus misiones; me ayudan a acompañarte mejor.</p>
      </div>

      <div
        className="setup-progress"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Paso ${step + 1} de 3: ${stepMeta[step].label}`}
      >
        <div className="setup-progress__header">
          <span className="setup-progress__step-badge">{stepMeta[step].label}</span>
          <span className="setup-progress__counter">{String(step + 1).padStart(2, '0')} / 03</span>
        </div>
        <div className="setup-progress__track">
          <div className="setup-progress__fill" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
      </div>

      <section className="setup-question" aria-live="polite">
        {step === 0 && (
          <fieldset>
            <legend>{stepMeta[0].title}</legend>
            <p className="setup-hint">{stepMeta[0].hint}</p>
            <div className="setup-choice-list" role="radiogroup" aria-label={stepMeta[0].title}>
              {goals.map((option) => (
                <label className="setup-choice setup-choice--stacked" key={option.value} data-selected={goal === option.value}>
                  <input
                    type="radio"
                    name="goal"
                    value={option.value}
                    checked={goal === option.value}
                    onChange={() => setGoal(option.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && goal === option.value) {
                        setStep(1)
                      }
                    }}
                  />
                  <span className="setup-choice__marker" aria-hidden="true" />
                  <span className="setup-choice__content">
                    <strong className="setup-choice__title">{option.label}</strong>
                    <small className="setup-choice__detail">{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend>{stepMeta[1].title}</legend>
            <p className="setup-hint">{stepMeta[1].hint}</p>
            <div className="setup-choice-grid" role="radiogroup" aria-label={stepMeta[1].title}>
              {timeOptions.map((option) => (
                <label className="setup-choice setup-choice--grid-item" key={option.value} data-selected={availableTime === option.value}>
                  <input
                    type="radio"
                    name="available-time"
                    value={option.value}
                    checked={availableTime === option.value}
                    onChange={() => setAvailableTime(option.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && availableTime === option.value) {
                        setStep(2)
                      }
                    }}
                  />
                  <span className="setup-choice__marker" aria-hidden="true" />
                  <span className="setup-choice__content">
                    <strong className="setup-choice__title">{option.label}</strong>
                    <small className="setup-choice__detail">{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend>{stepMeta[2].title}</legend>
            <p className="setup-hint">{stepMeta[2].hint}</p>
            <div className="setup-choice-list" role="radiogroup" aria-label={stepMeta[2].title}>
              {helpOptions.map((option) => (
                <label className="setup-choice setup-choice--stacked" key={option.value} data-selected={helpPreference === option.value}>
                  <input
                    type="radio"
                    name="help-preference"
                    value={option.value}
                    checked={helpPreference === option.value}
                    onChange={() => setHelpPreference(option.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && helpPreference === option.value) {
                        void finish()
                      }
                    }}
                  />
                  <span className="setup-choice__marker" aria-hidden="true" />
                  <span className="setup-choice__content">
                    <strong className="setup-choice__title">{option.label}</strong>
                    <small className="setup-choice__detail">{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {error && <p className="setup-error" role="alert">{error}</p>}
      <div className="setup-actions">
        {step > 0 && (
          <button type="button" className="setup-back" onClick={() => setStep((current) => current - 1)}>
            ← Atrás
          </button>
        )}
        <button
          type="button"
          className="setup-primary"
          disabled={!canContinue || isSaving}
          onClick={() => (step < 2 ? setStep((current) => current + 1) : void finish())}
        >
          {isSaving ? 'Guardando preferencias…' : step < 2 ? 'Siguiente →' : 'Comenzar recorrido →'}
        </button>
      </div>
    </main>
  )
}

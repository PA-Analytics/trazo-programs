import { useEffect, useMemo, useState } from 'react'
import type { CalibrationExample, CalibrationVerdict, CreatorCalibration, Mission } from '../domain/course'
import type { CalibrationMode } from '../domain/identity'

interface CreatorCalibrationViewProps {
  mission: Mission
  userId?: string
  initialMode?: CalibrationMode
  onBack?: () => void
}

const verdicts: Array<{ value: CalibrationVerdict; label: string; detail: string }> = [
  { value: 'PASS', label: 'PASS', detail: 'Satisface el estándar de la misión.' },
  { value: 'REWORK', label: 'REWORK', detail: 'Se puede juzgar, pero todavía no alcanza el estándar.' },
  { value: 'CLARIFY', label: 'CLARIFY', detail: 'Falta información o contexto para decidir responsablemente.' },
]

export function CreatorCalibrationView({ mission, userId, initialMode = 'mixed_examples', onBack }: CreatorCalibrationViewProps) {
  const [calibration, setCalibration] = useState<CreatorCalibration | null>(null)
  const [standard, setStandard] = useState('')
  const [mode, setMode] = useState<'creator' | 'generated' | 'mixed'>(
    initialMode === 'own_examples' ? 'creator' : initialMode === 'generated_examples' ? 'generated' : 'mixed',
  )
  const [ownExample, setOwnExample] = useState('')
  const [editingCriteria, setEditingCriteria] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function request<T>(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(userId ? { 'X-Trazo-User-Id': userId } : { 'X-Trazo-Mode': 'creator' }),
        ...(options?.headers ?? {}),
      },
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      throw new Error(errorPayload?.error || 'No se pudo completar esta acción.')
    }
    return (await response.json()) as T
  }

  useEffect(() => {
    void request<CreatorCalibration | null>(`/api/v1/calibrations/${mission.id}`)
      .then((data) => {
        if (data) {
          setCalibration(data)
          setStandard(data.initialStandard)
          setEditingCriteria(data.proposedRubric?.criteria.map((criterion) => criterion.description) ?? [])
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar la calibración.'))
      .finally(() => setIsLoading(false))
  }, [mission.id])

  const judgedCount = useMemo(
    () => calibration?.examples.filter((example) => example.verdict && example.reason).length ?? 0,
    [calibration],
  )

  async function run(action: () => Promise<CreatorCalibration>) {
    setBusy(true)
    setError(null)
    try {
      setCalibration(await action())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function startCalibration() {
    if (!standard.trim()) return
    await run(() =>
      request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialStandard: standard }),
      }),
    )
  }

  async function addOwnExample() {
    if (!ownExample.trim()) return
    await run(async () => {
      const data = await request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}/examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'creator', submission: ownExample }),
      })
      setOwnExample('')
      return data
    })
  }

  async function generateExamples() {
    await run(() =>
      request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}/generate-examples`, {
        method: 'POST',
      }),
    )
  }

  async function judge(example: CalibrationExample, verdict: CalibrationVerdict, reason: string) {
    if (!reason.trim()) return
    await run(() =>
      request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}/examples/${example.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, reason }),
      }),
    )
  }

  async function propose() {
    await run(async () => {
      const data = await request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}/propose`, { method: 'POST' })
      setEditingCriteria(data.proposedRubric?.criteria.map((criterion) => criterion.description) ?? [])
      return data
    })
  }

  async function confirm() {
    await run(() =>
      request<CreatorCalibration>(`/api/v1/calibrations/${mission.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: editingCriteria }),
      }),
    )
  }

  if (isLoading) {
    return (
      <main className="calibration-shell" aria-busy="true">
        <p className="calibration-status">Cargando datos de calibración para esta misión…</p>
      </main>
    )
  }

  return (
    <main className="calibration-shell" aria-labelledby="calibration-title">
      <header className="calibration-header">
        {onBack && (
          <button type="button" className="calibration-back" onClick={onBack}>
            ← Volver al mapa
          </button>
        )}
        <span className="setup-eyebrow">TRAZO · MODO CREADOR · CALIBRACIÓN DE ESTÁNDAR</span>
        <h1 id="calibration-title">Enséñale a TRAZO cómo evalúas.</h1>
        <p>
          Muéstrame dónde dibujas la línea entre PASS, REWORK y CLARIFY. Tus ejemplos enseñan; no se convierten en una regla
          sin tu confirmación.
        </p>
      </header>

      <section className="calibration-mission" aria-labelledby="calibration-mission-title">
        <span className="calibration-mission__eyebrow">Misión en calibración</span>
        <h2 id="calibration-mission-title">{mission.title}</h2>
        <p className="calibration-mission__desc">{mission.description}</p>
        <div className="calibration-mission__prompt-box">
          <strong>Evidencia esperada del estudiante:</strong>
          <span>{mission.evidencePrompt}</span>
        </div>
      </section>

      {error && (
        <p className="setup-error" role="alert">
          {error}
        </p>
      )}

      {!calibration ? (
        <section className="calibration-start" aria-labelledby="standard-title">
          <div className="calibration-start__card">
            <label htmlFor="initial-standard" id="standard-title" className="calibration-start__label">
              ¿Qué tendría que tener una respuesta para que dijeras: “sí, esto está suficientemente bien”?
            </label>
            <p className="calibration-start__hint">
              Escribe en tus palabras qué esperas ver en una entrega satisfactoria. Este estándar inicial guiará la generación de
              hipótesis y la propuesta de criterios.
            </p>
            <textarea
              id="initial-standard"
              rows={4}
              value={standard}
              onChange={(event) => setStandard(event.target.value)}
              placeholder="Por ejemplo: la idea es concreta, sé para quién es, incluye una señal verificable y no podría servirle igual a cualquiera…"
            />
            <button
              type="button"
              className="setup-primary"
              disabled={!standard.trim() || busy}
              onClick={() => void startCalibration()}
            >
              {busy ? 'Iniciando…' : 'Empezar calibración de esta misión'}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="calibration-section" aria-labelledby="source-title">
            <div className="calibration-section__heading">
              <span className="calibration-section__index">01</span>
              <div>
                <h2 id="source-title">Elige cómo quieres calibrar</h2>
                <p>Aporta tus propios ejemplos reales, genera hipótesis sintéticas de frontera, o combina ambos.</p>
              </div>
            </div>

            <div className="calibration-mode" role="group" aria-label="Fuente de ejemplos">
              {([
                ['creator', 'Usar mis ejemplos'],
                ['generated', 'Generar hipótesis'],
                ['mixed', 'Mezclar ambos'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="calibration-mode__button"
                  data-selected={mode === value}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {(mode === 'creator' || mode === 'mixed') && (
              <div className="creator-example-entry">
                <label htmlFor="creator-example">Pega o redacta un ejemplo real de respuesta:</label>
                <textarea
                  id="creator-example"
                  rows={3}
                  value={ownExample}
                  onChange={(event) => setOwnExample(event.target.value)}
                  placeholder={`Ejemplo de respuesta: ${mission.evidencePrompt}`}
                />
                <button
                  type="button"
                  className="setup-secondary"
                  disabled={!ownExample.trim() || busy}
                  onClick={() => void addOwnExample()}
                >
                  + Añadir mi ejemplo a la lista
                </button>
              </div>
            )}

            {(mode === 'generated' || mode === 'mixed') && (
              <div className="generated-examples-trigger">
                <button
                  type="button"
                  className="setup-secondary"
                  disabled={busy}
                  onClick={() => void generateExamples()}
                >
                  Generar tres casos de frontera para juzgar
                </button>
              </div>
            )}
          </section>

          <section className="calibration-section" aria-labelledby="examples-title">
            <div className="calibration-section__heading">
              <span className="calibration-section__index">02</span>
              <div className="calibration-section__title-group">
                <div className="calibration-section__title-row">
                  <h2 id="examples-title">Dibuja la línea</h2>
                  <span className="calibration-judged-counter" aria-live="polite">
                    {judgedCount} de {calibration.examples.length} juzgados
                  </span>
                </div>
                <p>
                  Cada caso necesita tu veredicto y el motivo. Los generados están marcados como hipótesis de calibración, no
                  como verdad oficial.
                </p>
              </div>
            </div>

            {calibration.examples.length === 0 ? (
              <div className="calibration-empty">
                <p>Aún no hay ejemplos en la lista. Añade uno propio arriba o genera casos para empezar a calibrar.</p>
              </div>
            ) : (
              <div className="calibration-examples">
                {calibration.examples.map((example, index) => (
                  <CalibrationExampleItem
                    key={example.id}
                    example={example}
                    index={index}
                    busy={busy}
                    onJudge={judge}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="calibration-section" aria-labelledby="criteria-title">
            <div className="calibration-section__heading">
              <span className="calibration-section__index">03</span>
              <div>
                <h2 id="criteria-title">Revisa una primera propuesta de criterios</h2>
                <p>La propuesta sale de tu estándar. Tus veredictos aportan el contexto necesario para revisarla.</p>
              </div>
            </div>

            {!calibration.proposedRubric ? (
              <div className="criteria-propose-card">
                <p className="criteria-propose-card__hint">
                  {judgedCount === 0
                    ? 'Juzga al menos un caso arriba para habilitar la propuesta de criterios.'
                    : `Has juzgado ${judgedCount} caso${judgedCount > 1 ? 's' : ''}. Ya puedes generar una propuesta.`}
                </p>
                <button
                  type="button"
                  className="setup-primary"
                  disabled={judgedCount === 0 || busy}
                  onClick={() => void propose()}
                >
                  Proponer criterios
                </button>
              </div>
            ) : (
              <div className="criteria-review">
                <div
                  className="criteria-proposal-banner"
                  data-status={calibration.status}
                  role="region"
                  aria-label="Estado de la propuesta de criterios"
                >
                  <div className="criteria-proposal-banner__badge">
                    {calibration.status === 'confirmed' ? '✓ RÚBRICA CONFIRMADA' : 'PROPOSAL · PROPUESTA INTERPRETADA'}
                  </div>
                  <p className="criteria-proposal-banner__text">
                    {calibration.status === 'confirmed'
                      ? 'Estos criterios ya están activos y se aplicarán a las entregas de esta misión. Puedes ajustar las descripciones y volver a confirmar si lo necesitas.'
                      : 'TRAZO propone esta interpretación a partir de tu estándar. Tus veredictos no se convierten automáticamente en criterios. Edita los campos de abajo antes de confirmar; nada se aplicará a los estudiantes hasta que confirmes.'}
                  </p>
                </div>

                <div className="criteria-list" role="group" aria-label="Lista de criterios propuestos">
                  {calibration.proposedRubric.criteria.map((criterion, index) => (
                    <label key={criterion.id} htmlFor={`criterion-${criterion.id}`} className="criteria-item">
                      <span className="criteria-item__number">{String(index + 1).padStart(2, '0')}</span>
                      <div className="criteria-item__field">
                        <span className="criteria-item__label">Criterio {index + 1}</span>
                        <input
                          id={`criterion-${criterion.id}`}
                          value={editingCriteria[index] ?? criterion.description}
                          onChange={(event) =>
                            setEditingCriteria((current) =>
                              current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                            )
                          }
                          placeholder="Descripción del criterio..."
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="criteria-semantics" role="note">
                  <strong>Cómo se aplicará esta rúbrica:</strong>
                  <ul>
                    <li>
                      <strong>CLARIFY:</strong> si falta información o la evidencia es incontrastable.
                    </li>
                    <li>
                      <strong>REWORK:</strong> si la evidencia se puede juzgar pero no alcanza algún criterio requerido.
                    </li>
                    <li>
                      <strong>PASS:</strong> si la evidencia satisface todos los criterios obligatorios.
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  className="setup-primary"
                  disabled={busy || editingCriteria.some((item) => !item.trim())}
                  onClick={() => void confirm()}
                >
                  {busy
                    ? 'Guardando…'
                    : calibration.status === 'confirmed'
                      ? 'Criterios confirmados ✓'
                      : 'Confirmar criterios oficiales'}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function CalibrationExampleItem({
  example,
  index,
  busy,
  onJudge,
}: {
  example: CalibrationExample
  index: number
  busy: boolean
  onJudge: (example: CalibrationExample, verdict: CalibrationVerdict, reason: string) => Promise<void>
}) {
  const [verdict, setVerdict] = useState<CalibrationVerdict | ''>(example.verdict ?? '')
  const [reason, setReason] = useState(example.reason ?? '')
  const isJudged = Boolean(example.verdict && example.reason)
  const isUnsaved = verdict !== (example.verdict ?? '') || reason !== (example.reason ?? '')

  return (
    <article className="calibration-example" data-source={example.source} data-judged={isJudged}>
      <div className="calibration-example__source-row">
        <span className="calibration-example__step-tag">Paso {index + 1} · Origen</span>
        <div className="calibration-example__source-badges">
          <span className="calibration-source-badge" data-source={example.source}>
            {example.source === 'generated' ? 'Hipótesis sintética' : 'Ejemplo del creador'}
          </span>
          {example.caseQuality && (
            <span className="calibration-quality-badge" data-quality={example.caseQuality}>
              {example.caseQuality === 'clear_pass'
                ? 'Caso generado · PASS claro'
                : example.caseQuality === 'clear_rework'
                  ? 'Caso generado · REWORK claro'
                  : 'Caso generado · Frontera / Límite'}
            </span>
          )}
        </div>
      </div>

      <div className="calibration-example__submission-block">
        <span className="calibration-example__section-label">Respuesta a evaluar (Submission):</span>
        <blockquote className="calibration-example__submission-quote">
          <p>{example.submission}</p>
        </blockquote>
      </div>

      <div className="calibration-example__verdict-block">
        <fieldset className="calibration-verdict-fieldset">
          <legend className="calibration-example__section-label">Tu veredicto como creador:</legend>
          <div className="verdict-options" role="radiogroup" aria-label={`Veredicto para caso ${index + 1}`}>
            {verdicts.map((option) => (
              <label
                key={option.value}
                className="verdict-option"
                data-verdict={option.value}
                data-selected={verdict === option.value}
              >
                <input
                  type="radio"
                  name={`verdict-${example.id}`}
                  value={option.value}
                  checked={verdict === option.value}
                  onChange={() => setVerdict(option.value)}
                />
                <span className="verdict-option__header">
                  <span className="verdict-option__indicator" aria-hidden="true" />
                  <strong className="verdict-option__name">{option.label}</strong>
                </span>
                <small className="verdict-option__detail">{option.detail}</small>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="calibration-example__reason-block">
        <label htmlFor={`reason-${example.id}`} className="calibration-example__section-label">
          ¿Por qué diste este veredicto? <span className="calibration-required-mark">*</span>
        </label>
        <textarea
          id={`reason-${example.id}`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explica qué viste, qué faltó o qué criterio específico determinó tu decisión…"
        />
      </div>

      <div className="calibration-example__action-row">
        <button
          type="button"
          className="setup-secondary"
          disabled={!verdict || !reason.trim() || busy}
          onClick={() => void onJudge(example, verdict as CalibrationVerdict, reason)}
        >
          {busy ? 'Guardando…' : isJudged && !isUnsaved ? 'Veredicto guardado ✓' : 'Guardar veredicto'}
        </button>
        {isJudged && (
          <span className="calibration-saved-notice" aria-live="polite">
            {isUnsaved ? 'Cambios pendientes de guardar' : `Guardado como ${example.verdict}`}
          </span>
        )}
      </div>
    </article>
  )
}

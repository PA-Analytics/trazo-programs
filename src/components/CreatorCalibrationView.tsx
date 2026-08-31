import { useEffect, useMemo, useState } from 'react'
import type { CalibrationExample, CalibrationVerdict, CreatorCalibration, Mission } from '../domain/course'
import type { CalibrationMode } from '../domain/identity'
import trazoLogoFullWhite from '../../trazo-logo-full-white.png'
import { trazzCoachEvaluador } from '../assets/mascota-estados'

interface CreatorCalibrationViewProps {
  mission: Mission
  userId?: string
  initialMode?: CalibrationMode
  onBack?: () => void
  onEnterMap?: () => void
}

const verdicts: Array<{ value: CalibrationVerdict; label: string; detail: string; keycap: string }> = [
  { value: 'PASS', label: 'PASS', detail: 'Satisface el estándar exigido.', keycap: '1' },
  { value: 'REWORK', label: 'REWORK', detail: 'Falta rigor o tiene AI-slop.', keycap: '2' },
  { value: 'CLARIFY', label: 'CLARIFY', detail: 'Evidencia incontrastable.', keycap: '3' },
]

export function CreatorCalibrationView({
  mission,
  userId,
  initialMode = 'mixed_examples',
  onBack,
  onEnterMap,
}: CreatorCalibrationViewProps) {
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
      <main className="entry-shell coach-workbench-shell" aria-busy="true">
        <p className="calibration-status">Cargando datos de calibración para esta misión…</p>
      </main>
    )
  }

  return (
    <main className="entry-shell coach-workbench-shell" aria-labelledby="calibration-workbench-title">
      <div className="coach-workbench coach-workbench--calibration" data-testid="calibration-workbench">
        <aside className="coach-step-hero">
          <div className="coach-step-hero__brand">
            <img className="coach-step-hero__logo" src={trazoLogoFullWhite} alt="TRAZO" />
            <span className="coach-step-hero__tag">ESTUDIO DE CALIBRACIÓN</span>
          </div>

          <span className="setup-eyebrow">DIRECCIÓN PEDAGÓGICA</span>

          <h1 id="calibration-workbench-title" className="coach-step-hero__title">
            <span>FIJA TU UMBRAL</span>
            <span>DE RIGOR</span>
            <span className="coach-step-hero__title-accent">EN PIEDRA</span>
          </h1>

          <p className="coach-step-hero__desc">
            Somete al evaluador a casos límite. Ningún estudiante avanzará sin superar la exigencia que marques aquí.
          </p>

          <div className="coach-calibration-mission-pill">
            <span className="coach-calibration-mission-pill__tag">MISIÓN EN CALIBRACIÓN</span>
            <strong className="coach-calibration-mission-pill__title">{mission.title}</strong>
            <p className="coach-calibration-mission-pill__prompt">
              <span className="coach-calibration-mission-pill__prompt-label">Evidencia: </span>
              {mission.evidencePrompt}
            </p>
          </div>

          <div className="coach-trazz-brief" aria-live="polite">
            <img
              src={trazzCoachEvaluador}
              alt="Trazz Juez Curricular"
              className="coach-trazz-brief__avatar"
            />
            <div className="coach-trazz-brief__text">
              <strong>TRAZZ // JUEZ CURRICULAR</strong>
              <p>
                {!calibration
                  ? 'Define el estándar innegociable. Con base en él someteremos a prueba casos reales y sintéticos.'
                  : calibration.status === 'confirmed'
                    ? '¡Rúbrica sellada con éxito! El motor evaluador ya está calibrado con tu nivel de rigor.'
                    : 'Calibra cada caso de prueba para que aprenda exactamente dónde dibujas la línea.'}
              </p>
            </div>
          </div>
        </aside>

        <section className="coach-workbench__content" aria-label="Área de calibración de criterio">
          {!calibration ? (
            <>
              <div className="coach-workbench__header">
                <span className="coach-workbench__index">CALIBRACIÓN 01 · ESTÁNDAR INICIAL</span>
                <h2 className="coach-workbench__heading">¿CUÁL ES EL ESTÁNDAR INNEGOCIABLE?</h2>
              </div>

              <div className="coach-workbench__body">
                <div className="coach-input-block">
                  <label htmlFor="initial-standard" className="coach-input-block__label">
                    Describe qué separa una entrega aceptable de una superficial o genérica
                  </label>
                  <textarea
                    id="initial-standard"
                    className="coach-textarea"
                    rows={5}
                    maxLength={500}
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    placeholder="Ejemplo: La entrega debe ser concreta, resolver el problema sin relleno teórico, incluir datos verificables y no sonar a texto genérico generado por IA."
                    autoFocus
                  />
                  <div className="coach-input-block__footer">
                    <span className="coach-input-block__hint">Sé riguroso: guiará la generación de hipótesis y criterios.</span>
                    <span className="coach-input-block__counter">{standard.length} / 500</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="setup-error" role="alert">
                  {error}
                </div>
              )}

              <footer className="coach-workbench__actions">
                {onBack && (
                  <button type="button" className="setup-secondary coach-action-btn" onClick={onBack}>
                    ← Volver
                  </button>
                )}
                <button
                  type="button"
                  className="setup-primary coach-action-btn"
                  disabled={!standard.trim() || busy}
                  onClick={() => void startCalibration()}
                >
                  {busy ? 'Iniciando…' : 'Iniciar Ronda de Calibración →'}
                </button>
              </footer>
            </>
          ) : (
            <>
              <div className="coach-workbench__header">
                <div className="coach-workbench__header-split">
                  <div>
                    <span className="coach-workbench__index">CALIBRACIÓN 02 · CASOS DE PRUEBA</span>
                    <h2 className="coach-workbench__heading">DIBUJA LA LÍNEA DEL VEREDICTO</h2>
                  </div>
                  <span className="coach-judged-badge" aria-live="polite">
                    {judgedCount} / {calibration.examples.length} CALIBRADOS
                  </span>
                </div>
              </div>

              <div className="coach-workbench__body coach-calibration-scroll-body">
                <div className="coach-calibration-controls">
                  <div className="coach-mode-pills" role="group" aria-label="Modo de ejemplos">
                    {([
                      ['mixed', 'Combinar'],
                      ['generated', 'Hipótesis'],
                      ['creator', 'Propios'],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className="coach-mode-pill"
                        data-selected={mode === val}
                        onClick={() => setMode(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {(mode === 'generated' || mode === 'mixed') && (
                    <button
                      type="button"
                      className="setup-secondary coach-action-btn coach-action-btn--sm"
                      disabled={busy}
                      onClick={() => void generateExamples()}
                    >
                      {busy ? 'Generando casos…' : 'Generar casos de prueba'}
                    </button>
                  )}
                </div>

                {(mode === 'creator' || mode === 'mixed') && (
                  <div className="coach-add-example-block">
                    <label htmlFor="creator-example" className="coach-input-block__label">
                      Añadir caso de prueba real
                    </label>
                    <textarea
                      id="creator-example"
                      className="coach-textarea coach-textarea--sm"
                      rows={2}
                      value={ownExample}
                      onChange={(e) => setOwnExample(e.target.value)}
                      placeholder={`Pega una entrega de ejemplo para: ${mission.evidencePrompt}`}
                    />
                    <button
                      type="button"
                      className="setup-secondary coach-action-btn coach-action-btn--sm"
                      disabled={!ownExample.trim() || busy}
                      onClick={() => void addOwnExample()}
                    >
                      + Añadir Caso a la Ronda
                    </button>
                  </div>
                )}

                <div className="coach-examples-stack">
                  {calibration.examples.length === 0 ? (
                    <div className="coach-calibration-empty">
                      <p>
                        Aún no hay casos en la ronda. Pulsa <strong>Generar casos de prueba</strong> o añade uno propio arriba.
                      </p>
                    </div>
                  ) : (
                    calibration.examples.map((example, index) => (
                      <CalibrationExampleItem
                        key={example.id}
                        example={example}
                        index={index}
                        busy={busy}
                        onJudge={judge}
                      />
                    ))
                  )}
                </div>

                <div className="coach-criteria-section">
                  <div className="coach-criteria-section__header">
                    <span className="coach-workbench__index">ESTÁNDAR OFICIAL</span>
                    <h3 className="coach-criteria-section__title">PLIEGO DE CRITERIOS RESULTANTES</h3>
                  </div>

                  {!calibration.proposedRubric ? (
                    <div className="coach-criteria-prompt-box">
                      <p>
                        {judgedCount === 0
                          ? 'Calibra al menos 1 caso arriba para sintetizar tu pliego de criterios.'
                          : `Has calibrado ${judgedCount} caso${judgedCount > 1 ? 's' : ''}. Ya puedes sintetizar la rúbrica oficial.`}
                      </p>
                      <button
                        type="button"
                        className="setup-primary coach-action-btn"
                        disabled={judgedCount === 0 || busy}
                        onClick={() => void propose()}
                      >
                        Sintetizar Criterios de Evaluación →
                      </button>
                    </div>
                  ) : (
                    <div className="coach-criteria-confirmed-box">
                      <div
                        className="coach-criteria-badge-banner"
                        data-status={calibration.status}
                      >
                        <span className="coach-criteria-badge-banner__status">
                          {calibration.status === 'confirmed' ? '✓ RÚBRICA ACTIVA Y SELLADA' : 'PROPUESTA DE CRITERIOS'}
                        </span>
                        <small className="coach-criteria-badge-banner__desc">
                          {calibration.status === 'confirmed'
                            ? 'Estos criterios se aplicarán de forma determinista a las entregas de los estudiantes.'
                            : 'Revisa y ajusta la redacción antes de confirmar.'}
                        </small>
                      </div>

                      <div className="coach-criteria-list">
                        {calibration.proposedRubric.criteria.map((criterion, index) => (
                          <div key={criterion.id} className="coach-criterion-row">
                            <span className="coach-criterion-num">0{index + 1}</span>
                            <input
                              type="text"
                              className="coach-criterion-input"
                              value={editingCriteria[index] ?? criterion.description}
                              onChange={(e) =>
                                setEditingCriteria((current) =>
                                  current.map((item, i) => (i === index ? e.target.value : item)),
                                )
                              }
                              placeholder="Descripción del criterio..."
                            />
                          </div>
                        ))}
                      </div>

                      {calibration.status === 'confirmed' ? (
                        <div className="coach-confirmed-actions-row">
                          <button
                            type="button"
                            className="setup-secondary coach-action-btn coach-action-btn--sm"
                            disabled={busy || editingCriteria.some((item) => !item.trim())}
                            onClick={() => void confirm()}
                          >
                            {busy ? 'Guardando…' : 'Actualizar Criterios'}
                          </button>
                          {onEnterMap && (
                            <button
                              type="button"
                              className="setup-primary coach-action-btn"
                              onClick={onEnterMap}
                            >
                              Entrar al Mapa de Ruta →
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="setup-primary coach-action-btn"
                          disabled={busy || editingCriteria.some((item) => !item.trim())}
                          onClick={() => void confirm()}
                        >
                          {busy ? 'Guardando…' : 'Confirmar y Sellar Rúbrica Oficial →'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="setup-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </section>
      </div>
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
    <article className="coach-example-card" data-source={example.source} data-judged={isJudged}>
      <div className="coach-example-card__header">
        <span className="coach-example-card__waypoint">0{index + 1}</span>
        <div className="coach-example-card__badges">
          <span className="coach-example-badge" data-source={example.source}>
            {example.source === 'generated' ? 'CASO DE PRUEBA SINTÉTICO' : 'CASO REAL DEL COACH'}
          </span>
          {example.caseQuality && (
            <span className="coach-quality-badge" data-quality={example.caseQuality}>
              {example.caseQuality === 'clear_pass'
                ? 'PASS MODELO'
                : example.caseQuality === 'clear_rework'
                  ? 'REWORK (PRUEBA ANTI-SLOP)'
                  : 'CASO FRONTERA'}
            </span>
          )}
        </div>
      </div>

      <div className="coach-example-card__submission">
        <span className="coach-example-card__sub-label">ENTREGA DEL ESTUDIANTE:</span>
        <blockquote className="coach-example-card__quote">
          <p>{example.submission}</p>
        </blockquote>
      </div>

      <div className="coach-example-card__verdict-area">
        <fieldset className="coach-verdict-fieldset">
          <legend className="coach-example-card__sub-label">VEREDICTO DEL COACH:</legend>
          <div className="coach-verdict-options" role="radiogroup" aria-label={`Veredicto para caso ${index + 1}`}>
            {verdicts.map((option) => {
              const isSelected = verdict === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className="coach-verdict-btn"
                  data-verdict={option.value}
                  data-selected={isSelected}
                  onClick={() => setVerdict(option.value)}
                >
                  <span className="coach-verdict-btn__dot" aria-hidden="true" />
                  <strong className="coach-verdict-btn__name">{option.label}</strong>
                  <small className="coach-verdict-btn__detail">{option.detail}</small>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="coach-example-card__reason-area">
        <label htmlFor={`reason-${example.id}`} className="coach-example-card__sub-label">
          ¿POR QUÉ DISTE ESTE VEREDICTO? <span className="calibration-required-mark">*</span>
        </label>
        <textarea
          id={`reason-${example.id}`}
          className="coach-textarea coach-textarea--sm"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explica qué faltó o qué destreza específica justificó este resultado…"
        />
      </div>

      <div className="coach-example-card__footer">
        <button
          type="button"
          className="setup-secondary coach-action-btn coach-action-btn--sm"
          disabled={!verdict || !reason.trim() || busy}
          onClick={() => void onJudge(example, verdict as CalibrationVerdict, reason)}
        >
          {busy ? 'Guardando…' : isJudged && !isUnsaved ? 'Veredicto Guardado ✓' : 'Guardar Veredicto'}
        </button>
        {isJudged && (
          <span className="coach-example-saved-tag" aria-live="polite">
            {isUnsaved ? 'Cambios pendientes' : `Fijado como ${example.verdict}`}
          </span>
        )}
      </div>
    </article>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { Course, EvaluationProvenanceRecord, ImplementationArtifact, ImplementationState } from '../domain/course'
import type { UserProfile } from '../domain/identity'
import type { CohortLearnerSummary, CohortOverviewResponseDTO } from '../server/types'
import { CreatorCalibrationView } from './CreatorCalibrationView'
import trazoLogoFullWhite from '../../trazo-logo-full-white.png'
import { trazzCoachEvaluador } from '../assets/mascota-estados'

interface CoachCockpitProps {
  profile: UserProfile
  course: Course
  onSwitchProfile?: () => void
}

type CockpitMode = 'cohort' | 'calibration'

export function CoachCockpit({ profile, course }: CoachCockpitProps) {
  const [mode, setMode] = useState<CockpitMode>('cohort')
  const [cohortData, setCohortData] = useState<CohortOverviewResponseDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Multi-mission calibration selector
  const allMissions = useMemo(() => course.chapters.flatMap((c) => c.missions), [course])
  const activeCalibrationMission = allMissions[0]

  // Evidence inspection modal state
  const [inspectingLearner, setInspectingLearner] = useState<CohortLearnerSummary | null>(null)
  const [learnerEvidence, setLearnerEvidence] = useState<{
    implementation: ImplementationState
    provenance: EvaluationProvenanceRecord[]
    artifacts: Record<string, ImplementationArtifact>
  } | null>(null)
  const [loadingEvidence, setLoadingEvidence] = useState(false)

  async function loadCohort() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/coach/cohort', {
        headers: { 'X-Trazo-User-Id': profile.userId },
      })
      if (!res.ok) throw new Error('No se pudo cargar la información de la cohorte.')
      const data: CohortOverviewResponseDTO = await res.json()
      setCohortData(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al conectar con la cohorte.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCohort()
  }, [profile.userId])

  async function inspectLearner(learner: CohortLearnerSummary) {
    setInspectingLearner(learner)
    setLoadingEvidence(true)
    setLearnerEvidence(null)
    try {
      const res = await fetch(`/api/v1/coach/implementations/${learner.implementationId}/evidence`, {
        headers: { 'X-Trazo-User-Id': profile.userId },
      })
      if (!res.ok) throw new Error('No se pudo cargar el historial de entregas.')
      const data = (await res.json()) as {
        implementation: ImplementationState
        provenance: EvaluationProvenanceRecord[]
        artifacts: Record<string, ImplementationArtifact>
      }
      setLearnerEvidence(data)
    } catch (cause) {
      console.error(cause)
    } finally {
      setLoadingEvidence(false)
    }
  }

  const learners = cohortData?.cohort ?? []
  const stalledCount = cohortData?.metrics?.stalledLearners ?? 0

  if (mode === 'calibration') {
    return (
      <CreatorCalibrationView
        key={activeCalibrationMission.id}
        mission={activeCalibrationMission}
        userId={profile.userId}
        initialMode={profile.coachSetup?.calibrationMode}
        onEnterMap={() => setMode('cohort')}
        onBack={() => setMode('cohort')}
      />
    )
  }

  return (
    <main className="entry-shell coach-workbench-shell" aria-labelledby="coach-studio-title">
      <div className="coach-workbench" data-testid="coach-studio">
        {/* CÁMARA IZQUIERDA: IDENTIDAD & ORIENTACIÓN EDITORIAL */}
        <aside className="coach-step-hero">
          <div className="coach-step-hero__brand">
            <img className="coach-step-hero__logo" src={trazoLogoFullWhite} alt="TRAZO" />
            <span className="coach-step-hero__tag">ESTUDIO DE CONTROL</span>
          </div>

          <span className="setup-eyebrow">DIRECCIÓN PEDAGÓGICA</span>
          <h1 id="coach-studio-title" className="coach-step-hero__title">
            <span>PANEL DE CONTROL</span>
            <span>DEL COACH</span>
            <span className="coach-step-hero__title-accent">EN PIEDRA</span>
          </h1>

          <p className="coach-step-hero__desc">
            Supervisa el avance de tus estudiantes, audita entregas límite y fija el estándar de rigor de tu programa.
          </p>

          {/* Selector de Modos Táctiles */}
          <div className="coach-studio-mode-selector" role="tablist" aria-label="Modo de trabajo">
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="coach-studio-mode-btn"
              data-active={true}
              onClick={() => setMode('cohort')}
            >
              <span className="coach-studio-mode-btn__num">01</span>
              <div className="coach-studio-mode-btn__info">
                <strong>ALUMNOS Y COHORTE</strong>
                <small>{learners.length} inscritos {stalledCount > 0 ? `· ${stalledCount} con fricción` : ''}</small>
              </div>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="coach-studio-mode-btn"
              data-active={false}
              onClick={() => setMode('calibration')}
            >
              <span className="coach-studio-mode-btn__num">02</span>
              <div className="coach-studio-mode-btn__info">
                <strong>CALIBRAR RÚBRICAS</strong>
                <small>{allMissions.length} misiones del programa</small>
              </div>
            </button>
          </div>

          {/* Diálogo de Trazz */}
          <div className="coach-trazz-brief" aria-live="polite">
            <img src={trazzCoachEvaluador} alt="Trazz" className="coach-trazz-brief__avatar" />
            <div className="coach-trazz-brief__text">
              <strong>TRAZZ // JUEZ CURRICULAR</strong>
              <p>
                {stalledCount > 0
                  ? `Atención: hay ${stalledCount} estudiante(s) con fricción repetida. Revisa sus entregas para orientarlos.`
                  : learners.length > 0
                  ? `Monitoreando ${learners.length} alumno(s). El motor aplica tus criterios con rigor determinista.`
                  : 'Aún no hay alumnos con entregas. Cuando inicien su ruta, verás aquí su avance y veredictos.'}
              </p>
            </div>
          </div>
        </aside>

        {/* CÁMARA DERECHA: SUPERFICIE OPERACIONAL */}
        <section className="coach-workbench__content" aria-label="Superficie de control">
          <header className="coach-workbench__header">
            <div className="coach-workbench__step-tag">SEGUIMIENTO 01 · ESTUDIANTES ACTIVOS</div>
            <h2 className="coach-workbench__title">ESTADO DE LA COHORTE</h2>
            <div className="coach-workbench__divider" />
          </header>

          <div className="coach-calibration-scroll-body">
            {loading ? (
              <div className="coach-empty-state-box">
                <p>Cargando información de la cohorte desde el backend…</p>
              </div>
            ) : error ? (
              <div className="setup-error" role="alert">
                {error}
              </div>
            ) : learners.length === 0 ? (
              <div className="coach-empty-state-box">
                <span className="setup-eyebrow">COHORTE LISTA PARA RECIBIR ALUMNOS</span>
                <h3>NO HAY ENTREGAS REGISTRADAS AÚN</h3>
                <p>
                  Tu programa está activo y calibrado. Cuando los estudiantes seleccionen el rol Alumno y envíen evidencias en el mapa, sus avances aparecerán aquí en tiempo real.
                </p>
                <button
                  type="button"
                  className="setup-secondary coach-action-btn"
                  onClick={() => setMode('calibration')}
                  style={{ marginTop: 12 }}
                >
                  Ir a Calibrar Misiones →
                </button>
              </div>
            ) : (
              <div className="coach-roster-feed">
                {learners.map((learner, idx) => (
                  <article
                    key={learner.implementationId}
                    className="coach-roster-row"
                    data-health={learner.healthStatus}
                  >
                    <div className="coach-roster-row__idx">
                      <span>0{idx + 1}</span>
                    </div>

                    <div className="coach-roster-row__body">
                      <div className="coach-roster-row__title-line">
                        <span className="coach-roster-row__name">{learner.displayName}</span>
                        {learner.healthStatus === 'stalled' ? (
                          <span className="coach-health-badge coach-health-badge--stalled">
                            🔴 ATASCADO ({learner.consecutiveReworks} REWORK)
                          </span>
                        ) : learner.healthStatus === 'human_review' ? (
                          <span className="coach-health-badge coach-health-badge--review">
                            🔵 REVISIÓN HUMANA
                          </span>
                        ) : learner.healthStatus === 'iterating' ? (
                          <span className="coach-health-badge coach-health-badge--iterating">
                            🟡 EN ITERACIÓN
                          </span>
                        ) : (
                          <span className="coach-health-badge coach-health-badge--healthy">
                            🟢 EN AVANCE
                          </span>
                        )}
                      </div>

                      <div className="coach-roster-row__meta">
                        <span>Misión actual: <strong>{learner.activeMissionTitle || 'Completada'}</strong></span>
                        <span>·</span>
                        <span>{learner.completedCount} de {learner.totalMissions} misiones ({learner.progressPercentage}%)</span>
                      </div>

                      <div className="coach-progress-track" style={{ marginTop: 8 }}>
                        <div className="coach-progress-fill" style={{ width: `${learner.progressPercentage}%` }} />
                      </div>
                    </div>

                    <div className="coach-roster-row__action">
                      <button
                        type="button"
                        className="coach-audit-btn"
                        onClick={() => void inspectLearner(learner)}
                      >
                        Auditar Entregas →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* MODAL DE INSPECCIÓN DE ENTREGAS DEL ALUMNO */}
        {inspectingLearner && (
          <div className="coach-inspector-overlay" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
            <div className="coach-inspector-modal">
              <header className="coach-inspector-modal__header">
                <div>
                  <span className="setup-eyebrow">AUDITORÍA Y TRAZABILIDAD DETERMINISTA</span>
                  <h2 id="inspector-title" className="coach-inspector-modal__title">
                    HISTORIAL DE {inspectingLearner.displayName?.toUpperCase()}
                  </h2>
                  <p className="coach-inspector-modal__meta">
                    ID: {inspectingLearner.implementationId} · Misión actual: {inspectingLearner.activeMissionTitle || 'Ninguna'}
                  </p>
                </div>
                <button
                  type="button"
                  className="coach-inspector-modal__close"
                  onClick={() => setInspectingLearner(null)}
                  aria-label="Cerrar inspector"
                >
                  ✕
                </button>
              </header>

              <div className="coach-inspector-modal__body">
                {loadingEvidence ? (
                  <div className="coach-empty-state-box">
                    <p>Cargando auditoría de entregas del estudiante…</p>
                  </div>
                ) : !learnerEvidence || (learnerEvidence.provenance.length === 0 && (!learnerEvidence.implementation.completedMissionIds || learnerEvidence.implementation.completedMissionIds.length === 0)) ? (
                  <div className="coach-empty-state-box">
                    <p>Este estudiante aún no tiene entregas evaluadas en esta ruta.</p>
                  </div>
                ) : (
                  <div className="coach-evidence-feed">
                    {learnerEvidence.provenance.length === 0 && learnerEvidence.implementation.completedMissionIds && learnerEvidence.implementation.completedMissionIds.length > 0 && (
                      <div className="coach-empty-state-box" style={{ padding: '20px', margin: '0 0 12px' }}>
                        <span className="setup-eyebrow">PROGRESO REGISTRADO</span>
                        <h3 style={{ fontSize: '1.2rem', margin: '4px 0' }}>
                          Misiones Aprobadas: {learnerEvidence.implementation.completedMissionIds.join(', ')}
                        </h3>
                        <p style={{ fontSize: '0.82rem' }}>
                          Este alumno completó la misión N01 en una sesión previa. Las nuevas entregas evaluadas con el motor mostrarán aquí la evidencia completa, desglose de rúbrica y veredicto.
                        </p>
                      </div>
                    )}
                    {learnerEvidence.provenance.map((record, index) => (
                      <article key={record.id || index} className="coach-evidence-card">
                        <div className="coach-evidence-card__header">
                          <div className="coach-evidence-card__mission">
                            <span className="coach-evidence-card__tag">ENTREGA 0{index + 1}</span>
                            <strong>MISIÓN {record.missionId}</strong>
                          </div>
                          <div
                            className="coach-health-badge"
                            data-verdict={record.policyVerdict}
                          >
                            VEREDICTO: {record.policyVerdict}
                            {record.confidence !== undefined && (
                              <small> ({Math.round(record.confidence * 100)}% conf.)</small>
                            )}
                          </div>
                        </div>

                        {/* Desglose de Criterios */}
                        <div className="coach-evidence-card__criteria">
                          <span className="coach-example-card__sub-label">CRITERIOS EVALUADOS:</span>
                          <div className="coach-criteria-list">
                            {record.criterionResults?.map((crit) => (
                              <div key={crit.criterionId} className="coach-criterion-row">
                                <span className="coach-criterion-num">
                                  {crit.status === 'PASS' ? '✓' : '✗'}
                                </span>
                                <div className="coach-criterion-details">
                                  <strong>{crit.criterionId}</strong>: {crit.rationale || 'Sin observaciones'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Feedback devuelto */}
                        {record.evaluation?.coachingFeedback && (
                          <div className="coach-evidence-card__feedback">
                            <span className="coach-example-card__sub-label">FEEDBACK ENTREGADO AL ALUMNO:</span>
                            <blockquote className="coach-example-card__quote">
                              <p>{record.evaluation.coachingFeedback}</p>
                            </blockquote>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <footer className="coach-inspector-modal__footer">
                <button
                  type="button"
                  className="setup-secondary coach-action-btn"
                  onClick={() => setInspectingLearner(null)}
                >
                  Cerrar Auditoría
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}


import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChapterNavigation } from './components/ChapterNavigation'
import { CompanionNextAction } from './components/CompanionNextAction'
import { HudBar } from './components/HudBar'
import { MissionPanel } from './components/MissionPanel'
import { QuestMap } from './components/QuestMap'
import { course } from './data/course'
import type {
  Chapter,
  EvaluationStatus,
  ImplementationState,
  Mission,
  MissionEvaluationState,
} from './domain/course'
import {
  deriveMissionProgress,
  formatLockedReason,
} from './domain/progression'
import type { SubmissionResponseDTO } from './server/types'

function getPrerequisiteSummary(mission: Mission, chapter: Chapter) {
  const titleById = new Map(chapter.missions.map((item) => [item.id, item.title]))
  if (mission.requiresAny?.length) {
    return `Elige una ruta: ${mission.requiresAny
      .map((id) => titleById.get(id) ?? id)
      .join(' o ')}.`
  }
  if (mission.prerequisites?.length) {
    return `Requiere: ${mission.prerequisites
      .map((id) => titleById.get(id) ?? id)
      .join(', ')}.`
  }
  return undefined
}

export function App() {
  const [activeChapterId, setActiveChapterId] = useState(course.chapters[0].id)
  const [implementationId, setImplementationId] = useState(() => {
    return localStorage.getItem('trazo_session_id') || 'demo-implementation-1'
  })
  const [localSessionIds, setLocalSessionIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('trazo_local_sessions')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    const initial = localStorage.getItem('trazo_session_id') || 'demo-implementation-1'
    return [initial]
  })
  const [implementationState, setImplementationState] = useState<ImplementationState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [evidenceByMissionId, setEvidenceByMissionId] = useState<Record<string, string>>({})
  const [evaluationStateByMissionId, setEvaluationStateByMissionId] = useState<
    Record<string, MissionEvaluationState>
  >({})
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const loadImplementation = useCallback(async () => {
    setIsLoading(true)
    setServerError(null)
    try {
      let res = await fetch(`/api/v1/implementations/${implementationId}`)
      if (res.status === 404) {
        res = await fetch('/api/v1/implementations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: implementationId,
            courseId: course.id,
            courseVersion: '1.0.0',
          }),
        })
      }

      if (!res.ok) {
        throw new Error(`Error al conectar con el backend (${res.status}): ${res.statusText}`)
      }
      const data: ImplementationState = await res.json()
      setImplementationState(data)
      localStorage.setItem('trazo_session_id', implementationId)
      setLocalSessionIds((prev) => {
        if (!prev.includes(implementationId)) {
          const updated = [implementationId, ...prev]
          localStorage.setItem('trazo_local_sessions', JSON.stringify(updated))
          return updated
        }
        return prev
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo conectar con el servidor backend'
      setServerError(message)
    } finally {
      setIsLoading(false)
    }
  }, [implementationId])

  useEffect(() => {
    void loadImplementation()
  }, [loadImplementation])

  const handleNewSession = useCallback(() => {
    const newId = `trazo-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).slice(-4)}`
    setImplementationId(newId)
    setLocalSessionIds((prev) => {
      const updated = [newId, ...prev.filter((id) => id !== newId)]
      localStorage.setItem('trazo_local_sessions', JSON.stringify(updated))
      return updated
    })
    setSelectedMissionId(null)
    setEvidenceByMissionId({})
    setEvaluationStateByMissionId({})
    setAnnouncement(`Nueva sesión iniciada: ${newId}`)
  }, [])

  const handleSelectLocalSession = useCallback((targetId: string) => {
    const cleanId = targetId.trim()
    if (!cleanId) return
    setImplementationId(cleanId)
    setSelectedMissionId(null)
    setEvidenceByMissionId({})
    setEvaluationStateByMissionId({})
    setAnnouncement(`Cambiando a sesión: ${cleanId}`)
  }, [])

  const completedMissionIds = useMemo(
    () => new Set(implementationState?.completedMissionIds ?? []),
    [implementationState?.completedMissionIds],
  )

  const activeChapter =
    course.chapters.find((chapter) => chapter.id === activeChapterId) ?? course.chapters[0]

  const progress = useMemo(
    () => deriveMissionProgress(activeChapter.missions, completedMissionIds),
    [activeChapter.missions, completedMissionIds],
  )

  const availableMissions = useMemo(
    () =>
      activeChapter.missions.filter(
        (m) => progress[m.id] === 'available' || progress[m.id] === 'active',
      ),
    [activeChapter.missions, progress],
  )

  const selectedMission = activeChapter.missions.find(
    (mission) => mission.id === selectedMissionId,
  )
  const lockedReasons = useMemo(
    () =>
      Object.fromEntries(
        activeChapter.missions.map((mission) => [
          mission.id,
          progress[mission.id] === 'locked'
            ? formatLockedReason(mission, activeChapter.missions, completedMissionIds)
            : undefined,
        ]),
      ),
    [activeChapter.missions, completedMissionIds, progress],
  )
  const completedCount = Object.values(progress).filter(
    (state) => state === 'completed',
  ).length

  const handleChapterSelect = useCallback((chapter: Chapter) => {
    setActiveChapterId(chapter.id)
    setSelectedMissionId(null)
    setRecenterRequest((request) => request + 1)
  }, [])

  const handleMissionSelect = useCallback((missionId: string) => {
    setSelectedMissionId(missionId)
  }, [])

  const handleClosePanel = useCallback(() => {
    const missionId = selectedMissionId
    setSelectedMissionId(null)
    window.requestAnimationFrame(() => {
      if (missionId) document.getElementById(`mission-node-${missionId}`)?.focus()
    })
  }, [selectedMissionId])

  const handleEvidenceChange = useCallback((missionId: string, evidence: string) => {
    setEvidenceByMissionId((current) => ({ ...current, [missionId]: evidence }))
  }, [])

  const handleStartMission = useCallback(
    async (missionId: string) => {
      try {
        const res = await fetch(`/api/v1/implementations/${implementationId}/start-mission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missionId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Error iniciando misión (${res.status})`)
        }

        const updatedState: ImplementationState = await res.json()
        setImplementationState(updatedState)
        setSelectedMissionId(missionId)
        const missionTitle =
          activeChapter.missions.find((m) => m.id === missionId)?.title ?? missionId
        setAnnouncement(`Misión activa iniciada: ${missionTitle}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al iniciar misión'
        setAnnouncement(`Error: ${message}`)
      }
    },
    [activeChapter.missions, implementationId],
  )

  const handleSubmitEvidence = useCallback(
    async (missionId: string) => {
      if (!['available', 'active', 'submitted'].includes(progress[missionId])) return
      const evidenceText = evidenceByMissionId[missionId]?.trim()
      if (!evidenceText) return

      // Set evaluating UI state
      setEvaluationStateByMissionId((current) => ({
        ...current,
        [missionId]: { status: 'evaluating' },
      }))

      try {
        // TASK-004: Real Verified Action Submission Pipeline
        const res = await fetch(`/api/v1/implementations/${implementationId}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            missionId,
            evidence: {
              type: 'text',
              text: evidenceText,
            },
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || `Error del servidor (${res.status}): ${res.statusText}`)
        }

        const data: SubmissionResponseDTO = await res.json()

        // Update evaluation state in UI
        const statusMap: Record<string, EvaluationStatus> = {
          PASS: 'pass',
          CLARIFY: 'clarify',
          REWORK: 'rework',
          HUMAN_REVIEW: 'human_review',
        }
        const evalStatus = statusMap[data.policyVerdict] || 'error'

        setEvaluationStateByMissionId((current) => ({
          ...current,
          [missionId]: {
            status: evalStatus,
            evaluation: data.evaluation,
            policyVerdict: data.policyVerdict,
          },
        }))

        // IF PASS: Apply authoritative updated state returned from backend (NO OPTIMISTIC COMPLETION)
        if (data.completed) {
          const nextCompleted = new Set(data.state.completedMissionIds)
          const nextProgress = deriveMissionProgress(activeChapter.missions, nextCompleted)
          const missionTitle =
            activeChapter.missions.find((mission) => mission.id === missionId)?.title ?? missionId
          const unlockedTitles = activeChapter.missions
            .filter(
              (mission) =>
                progress[mission.id] === 'locked' &&
                nextProgress[mission.id] === 'available',
            )
            .map((mission) => mission.title)

          setImplementationState(data.state)
          setAnnouncement(
            unlockedTitles.length > 0
              ? `Acción verificada. ${missionTitle} completada. Se desbloqueó: ${unlockedTitles.join(', ')}.`
              : `Acción verificada. ${missionTitle} completada.`,
          )
        } else {
          // IF NOT PASS: Implementation state is NOT mutated; announce coaching feedback
          setAnnouncement(
            data.evaluation?.coachingFeedback ||
              `El Acompañante solicita ajustes (${data.policyVerdict}).`,
          )
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al evaluar evidencia'
        setEvaluationStateByMissionId((current) => ({
          ...current,
          [missionId]: {
            status: 'error',
            errorMessage: message,
          },
        }))
        setAnnouncement(`Error: ${message}`)
      }
    },
    [activeChapter.missions, evidenceByMissionId, implementationId, progress],
  )

  if (isLoading) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--trazo-ink)', fontStyle: 'italic' }}>
          Cargando estado de implementación desde el backend...
        </p>
      </div>
    )
  }

  if (serverError) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--trazo-ink)' }}>Error de conexión con el backend</h2>
          <p style={{ color: 'var(--trazo-muted)', margin: '12px 0 20px' }}>{serverError}</p>
          <button
            type="button"
            className="submit-evidence-button"
            onClick={() => void loadImplementation()}
          >
            Reintentar conexión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <ChapterNavigation
        course={course}
        activeChapterId={activeChapter.id}
        onChapterSelect={handleChapterSelect}
      />
      <main className="map-stage">
        <HudBar
          chapterTitle={activeChapter.title}
          chapterPromise={activeChapter.mapPromise}
          completed={completedCount}
          total={activeChapter.missions.length}
          implementationId={implementationId}
          localSessionIds={localSessionIds}
          onRecenter={() => setRecenterRequest((request) => request + 1)}
          onNewSession={handleNewSession}
          onSelectLocalSession={handleSelectLocalSession}
        />
        <QuestMap
          chapter={activeChapter}
          progress={progress}
          selectedMissionId={selectedMissionId}
          lockedReasons={lockedReasons}
          recenterRequest={recenterRequest}
          onMissionSelect={handleMissionSelect}
        />

        {/* Companion Next Action Guidance Bar (TASK-006) */}
        {!selectedMissionId && availableMissions.length > 1 && (
          <CompanionNextAction
            implementationId={implementationId}
            availableMissions={availableMissions}
            onStartMission={handleStartMission}
            onSelectMission={handleMissionSelect}
          />
        )}
      </main>

      {selectedMission && (
        <MissionPanel
          key={selectedMission.id}
          mission={selectedMission}
          progressState={progress[selectedMission.id]}
          lockedReason={lockedReasons[selectedMission.id]}
          prerequisiteSummary={getPrerequisiteSummary(selectedMission, activeChapter)}
          evidence={evidenceByMissionId[selectedMission.id] ?? ''}
          evaluationState={evaluationStateByMissionId[selectedMission.id]}
          artifacts={implementationState?.artifacts}
          onClose={handleClosePanel}
          onEvidenceChange={handleEvidenceChange}
          onSubmitEvidence={handleSubmitEvidence}
        />
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}

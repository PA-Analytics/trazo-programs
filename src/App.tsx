import { useCallback, useMemo, useState } from 'react'
import { ChapterNavigation } from './components/ChapterNavigation'
import { HudBar } from './components/HudBar'
import { MissionPanel } from './components/MissionPanel'
import { QuestMap } from './components/QuestMap'
import { course } from './data/course'
import type { Chapter, Mission } from './domain/course'
import {
  deriveMissionProgress,
  formatLockedReason,
} from './domain/progression'

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
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const activeChapter =
    course.chapters.find((chapter) => chapter.id === activeChapterId) ?? course.chapters[0]
  const progress = useMemo(
    () => deriveMissionProgress(activeChapter.missions, completedMissionIds),
    [activeChapter.missions, completedMissionIds],
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

  const handleCompleteMission = useCallback(
    (missionId: string) => {
      if (!['available', 'active', 'submitted'].includes(progress[missionId])) return

      const nextCompleted = new Set(completedMissionIds)
      nextCompleted.add(missionId)
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

      setCompletedMissionIds(nextCompleted)
      setAnnouncement(
        unlockedTitles.length > 0
          ? `${missionTitle} completada. Se desbloqueó: ${unlockedTitles.join(', ')}.`
          : `${missionTitle} completada.`,
      )
    },
    [activeChapter.missions, completedMissionIds, progress],
  )

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
          completed={completedCount}
          total={activeChapter.missions.length}
          onRecenter={() => setRecenterRequest((request) => request + 1)}
        />
        <QuestMap
          chapter={activeChapter}
          progress={progress}
          selectedMissionId={selectedMissionId}
          lockedReasons={lockedReasons}
          recenterRequest={recenterRequest}
          onMissionSelect={handleMissionSelect}
        />
      </main>

      {selectedMission && (
        <MissionPanel
          key={selectedMission.id}
          mission={selectedMission}
          progressState={progress[selectedMission.id]}
          lockedReason={lockedReasons[selectedMission.id]}
          prerequisiteSummary={getPrerequisiteSummary(selectedMission, activeChapter)}
          onClose={handleClosePanel}
          onComplete={handleCompleteMission}
        />
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}

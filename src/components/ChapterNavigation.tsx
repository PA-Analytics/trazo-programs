import type { Chapter, Course } from '../domain/course'

interface ChapterNavigationProps {
  course: Course
  activeChapterId: string
  onChapterSelect: (chapter: Chapter) => void
}

export function ChapterNavigation({
  course,
  activeChapterId,
  onChapterSelect,
}: ChapterNavigationProps) {
  return (
    <nav className="chapter-navigation" aria-label="Capítulos del curso">
      <div className="chapter-navigation__mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="chapter-navigation__chapters">
        {course.chapters.map((chapter) => {
          const active = chapter.id === activeChapterId
          return (
            <button
              key={chapter.id}
              type="button"
              className="chapter-tab"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              aria-label={`${chapter.title}${active ? ', capítulo actual' : ''}`}
              title={chapter.title}
              onClick={() => onChapterSelect(chapter)}
            >
              <span aria-hidden="true">{chapter.shortTitle}</span>
            </button>
          )
        })}
      </div>
      <span className="chapter-navigation__course" aria-hidden="true">
        {course.title}
      </span>
    </nav>
  )
}

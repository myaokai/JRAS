import { useMemo } from 'react'
import type { AnaumeQuestion, Chapter } from '../types'

interface Props {
  chapters: Record<string, Chapter>
  questions: AnaumeQuestion[]
  selectedChapters: Set<number>
  onChange: (next: Set<number>) => void
}

export function ChapterSelector({ chapters, questions, selectedChapters, onChange }: Props) {
  const countByChapter = useMemo(() => {
    const counts: Record<string, number> = {}
    questions.forEach((q) => {
      counts[q.chapter] = (counts[q.chapter] ?? 0) + 1
    })
    return counts
  }, [questions])

  const toggleChapter = (chapterId: number, checked: boolean) => {
    const next = new Set(selectedChapters)
    if (checked) next.add(chapterId)
    else next.delete(chapterId)
    onChange(next)
  }

  const selectAll = () => {
    onChange(
      new Set(
        Object.keys(chapters)
          .filter((id) => (countByChapter[id] ?? 0) > 0)
          .map(Number),
      ),
    )
  }

  const deselectAll = () => onChange(new Set())

  return (
    <div className="chapter-selection">
      <h3>出題範囲を選択</h3>
      <div className="chapter-toggle-all">
        <button className="btn-small" onClick={selectAll} type="button">
          すべて選択
        </button>
        <button className="btn-small" onClick={deselectAll} type="button">
          すべて解除
        </button>
      </div>
      <div className="chapter-list">
        {Object.entries(chapters).map(([chapterId, chapter]) => {
          const count = countByChapter[chapterId] ?? 0
          if (count === 0) return null
          const id = Number(chapterId)
          const checked = selectedChapters.has(id)
          return (
            <div
              key={chapterId}
              className={`chapter-item${checked ? ' selected' : ''}`}
              onClick={() => toggleChapter(id, !checked)}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleChapter(id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              <label>{chapter.title}</label>
              <span className="question-badge">{count}問</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

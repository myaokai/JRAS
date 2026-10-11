import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AnaumeQuestion, Chapter } from '../types'
import { sectionKey } from '../quizPool'

interface Props {
  chapters: Record<string, Chapter>
  questions: AnaumeQuestion[]
  // 選択中の節（sectionKey 形式）
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

// 問題のある節を章ごとにまとめる
function useTree(chapters: Record<string, Chapter>, questions: AnaumeQuestion[]) {
  return useMemo(() => {
    const counts: Record<string, number> = {}
    questions.forEach((q) => {
      const key = sectionKey(q.chapter, q.section)
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(chapters)
      .map(([chapterId, chapter]) => ({
        chapterId,
        title: chapter.title,
        sections: Object.entries(chapter.sections)
          .map(([sectionId, title]) => ({ key: sectionKey(chapterId, sectionId), title, count: counts[sectionKey(chapterId, sectionId)] ?? 0 }))
          .filter((s) => s.count > 0),
      }))
      .filter((c) => c.sections.length > 0)
  }, [chapters, questions])
}

export function ChapterSelector({ chapters, questions, selected, onChange }: Props) {
  const tree = useTree(chapters, questions)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const setKeys = (keys: string[], checked: boolean) => {
    const next = new Set(selected)
    keys.forEach((k) => (checked ? next.add(k) : next.delete(k)))
    onChange(next)
  }

  const toggleOpen = (chapterId: string) => {
    const next = new Set(open)
    if (next.has(chapterId)) next.delete(chapterId)
    else next.add(chapterId)
    setOpen(next)
  }

  return (
    <div className="chapter-selection">
      <h3>出題範囲（章→節）</h3>
      <div className="chapter-toggle-all">
        <button className="btn-small" onClick={() => onChange(new Set(tree.flatMap((c) => c.sections.map((s) => s.key))))} type="button">
          すべて選択
        </button>
        <button className="btn-small" onClick={() => onChange(new Set())} type="button">
          すべて解除
        </button>
      </div>
      <div className="chapter-list">
        {tree.map((c) => {
          const keys = c.sections.map((s) => s.key)
          const checkedCount = keys.filter((k) => selected.has(k)).length
          const total = c.sections.reduce((n, s) => n + s.count, 0)
          // 節が1つだけの章（総論第4章など）は開かずに章の行だけで選ぶ
          const expandable = c.sections.length > 1
          const isOpen = open.has(c.chapterId)
          return (
            <div key={c.chapterId} className="chapter-group" data-chapter={c.chapterId}>
              <TriStateRow
                label={c.title}
                count={total}
                checked={checkedCount === keys.length}
                indeterminate={checkedCount > 0 && checkedCount < keys.length}
                onToggle={(checked) => setKeys(keys, checked)}
                trailing={
                  expandable && (
                    <button
                      className="tree-toggle"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? '節を閉じる' : '節を開く'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleOpen(c.chapterId)
                      }}
                      type="button"
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>
                  )
                }
              />
              {expandable &&
                isOpen &&
                c.sections.map((s) => {
                  const checked = selected.has(s.key)
                  return (
                    <div
                      key={s.key}
                      className={`chapter-item section-item${checked ? ' selected' : ''}`}
                      data-section={s.key}
                      onClick={() => setKeys([s.key], !checked)}
                    >
                      <input type="checkbox" checked={checked} onChange={(e) => setKeys([s.key], e.target.checked)} onClick={(e) => e.stopPropagation()} />
                      <label>{s.title}</label>
                      <span className="question-badge">{s.count}問</span>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TriStateRow({
  label,
  count,
  checked,
  indeterminate,
  onToggle,
  trailing,
}: {
  label: string
  count: number
  checked: boolean
  indeterminate: boolean
  onToggle: (checked: boolean) => void
  trailing?: ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <div className={`chapter-item${checked || indeterminate ? ' selected' : ''}`} onClick={() => onToggle(!checked)}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} onClick={(e) => e.stopPropagation()} />
      <label>{label}</label>
      <span className="question-badge">{count}問</span>
      {trailing}
    </div>
  )
}

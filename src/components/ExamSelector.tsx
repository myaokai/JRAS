import { useEffect, useMemo, useRef } from 'react'
import type { ExamMeta } from '../types'

interface Props {
  exams: ExamMeta[]
  selectedExams: Set<string>
  onChange: (next: Set<string>) => void
}

const SUBJECT_ORDER = ['kanteishi', 'gyosei'] as const
const SUBJECT_LABELS: Record<string, string> = {
  kanteishi: '鑑定評価理論',
  gyosei: '行政法規',
}

function getExamSubject(examId: string): string {
  return examId.endsWith('_kanteishi') ? 'kanteishi' : 'gyosei'
}

export function ExamSelector({ exams, selectedExams, onChange }: Props) {
  const groups = useMemo(() => {
    const g: Record<string, ExamMeta[]> = {}
    exams.forEach((exam) => {
      const subject = getExamSubject(exam.id)
      ;(g[subject] ??= []).push(exam)
    })
    return g
  }, [exams])

  const toggleExam = (examId: string, checked: boolean) => {
    const next = new Set(selectedExams)
    if (checked) next.add(examId)
    else next.delete(examId)
    onChange(next)
  }

  const toggleSubject = (subjectExams: ExamMeta[], checked: boolean) => {
    const next = new Set(selectedExams)
    subjectExams.forEach((exam) => {
      if (checked) next.add(exam.id)
      else next.delete(exam.id)
    })
    onChange(next)
  }

  if (exams.length === 0) return null

  return (
    <div className="chapter-selection">
      <h3>試験を選択</h3>
      <div className="chapter-list">
        {SUBJECT_ORDER.map((subject) => {
          const subjectExams = groups[subject]
          if (!subjectExams || subjectExams.length === 0) return null
          const allChecked = subjectExams.every((e) => selectedExams.has(e.id))
          const noneChecked = subjectExams.every((e) => !selectedExams.has(e.id))
          const totalCount = subjectExams.reduce((s, e) => s + e.count, 0)

          return (
            <div key={subject}>
              <SubjectHeader
                label={SUBJECT_LABELS[subject]}
                count={totalCount}
                checked={allChecked}
                indeterminate={!allChecked && !noneChecked}
                onToggle={(checked) => toggleSubject(subjectExams, checked)}
              />
              {subjectExams.map((exam) => {
                const yearLabel = exam.label
                  .replace(/\s*(鑑定評価理論|行政法規)/, '')
                  .trim()
                const checked = selectedExams.has(exam.id)
                return (
                  <div
                    key={exam.id}
                    className={`chapter-item exam-child-item${checked ? ' selected' : ''}`}
                    onClick={() => toggleExam(exam.id, !checked)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleExam(exam.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label>{yearLabel}</label>
                    <span className="question-badge">{exam.count}問</span>
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

function SubjectHeader({
  label,
  count,
  checked,
  indeterminate,
  onToggle,
}: {
  label: string
  count: number
  checked: boolean
  indeterminate: boolean
  onToggle: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <div
      className={`exam-subject-header${checked || indeterminate ? ' selected' : ''}`}
      onClick={() => onToggle(!checked)}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <label>{label}</label>
      <span className="question-badge">{count}問</span>
    </div>
  )
}

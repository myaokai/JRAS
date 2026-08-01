import type { ExamMeta, KakomonHistory } from '../types'

interface Props {
  history: KakomonHistory
  exams: ExamMeta[]
}

export function KakomonHistoryList({ history, exams }: Props) {
  if (history.length === 0) return null

  return (
    <div className="kakomon-history" id="kakomonHistorySection">
      <div className="kakomon-history-header">学習履歴</div>
      <div id="kakomonHistoryList">
        {history.map((entry) => {
          const pct = Math.round((entry.correct / entry.total) * 100)
          const examLabels = entry.examIds
            .map((id) => exams.find((e) => e.id === id)?.label ?? id)
            .join('・')
          return (
            <div className="history-entry" key={entry.timestamp}>
              <span className="history-date">{entry.dateStr}</span>
              <span className="history-score">
                {entry.correct}
                <em>/{entry.total}</em>
              </span>
              <span className="history-pct">{pct}%</span>
              <span className="history-exams">{examLabels}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

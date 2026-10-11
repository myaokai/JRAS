import type { Navigate } from '../route'
import type { ExamMeta, KakomonHistory } from '../types'
import { QUESTIONS_PER_QUIZ } from '../constants'
import { AppShell } from './layout/AppShell'
import { ExamSelector } from './ExamSelector'
import { FilterBar } from './FilterBar'
import { KakomonHistoryList } from './KakomonHistoryList'

interface Props {
  navigate: Navigate
  examIndex: ExamMeta[]
  selectedExams: Set<string>
  onExamsChange: (next: Set<string>) => void
  filterWrong: boolean
  onToggleFilterWrong: () => void
  wrongCount: number
  history: KakomonHistory
  onStart: () => void
}

export function KakomonSelectScreen(props: Props) {
  const { navigate, filterWrong, wrongCount, examIndex, selectedExams } = props
  const pool = filterWrong
    ? wrongCount
    : examIndex.filter((e) => selectedExams.has(e.id)).reduce((s, e) => s + e.count, 0)
  return (
    <AppShell
      title="短答 過去問"
      onBack={() => navigate({ name: 'study' })}
      navigate={navigate}
      screenId="startScreen"
      footer={
        <button id="startBtn" className="btn-primary btn-block" onClick={props.onStart} type="button">
          {pool}問から{Math.min(pool, QUESTIONS_PER_QUIZ)}問をはじめる
        </button>
      }
    >
      <FilterBar
        barId="kakomonFilterBar"
        btnId="filterWrongBtn"
        countId="filterWrongCount"
        label="間違えた問題だけ"
        count={wrongCount}
        active={filterWrong}
        onToggle={props.onToggleFilterWrong}
      />
      {!filterWrong && <ExamSelector exams={examIndex} selectedExams={selectedExams} onChange={props.onExamsChange} />}
      <KakomonHistoryList history={props.history} exams={examIndex} />
    </AppShell>
  )
}

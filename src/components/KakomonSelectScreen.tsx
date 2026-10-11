import type { Navigate } from '../route'
import type { ExamMeta, KakomonHistory } from '../types'
import { QUESTIONS_PER_QUIZ } from '../constants'
import { AppShell } from './layout/AppShell'
import { ExamSelector } from './ExamSelector'
import { KakomonHistoryList } from './KakomonHistoryList'
import { SectionTitle, Segmented } from './ui'

export type KakomonTab = 'year' | 'wrong'
// random=選んだ試験からランダム10問、exam=1つの試験を本番どおり全問・番号順
export type KakomonFormat = 'random' | 'exam'

interface Props {
  navigate: Navigate
  examIndex: ExamMeta[]
  tab: KakomonTab
  onTabChange: (tab: KakomonTab) => void
  format: KakomonFormat
  onFormatChange: (format: KakomonFormat) => void
  selectedExams: Set<string>
  onExamsChange: (next: Set<string>) => void
  realExam: string
  onRealExamChange: (examId: string) => void
  wrongCount: number
  history: KakomonHistory
  onStart: () => void
}

export function KakomonSelectScreen(props: Props) {
  const { navigate, tab, format, wrongCount, examIndex, selectedExams } = props
  let label: string
  let pool: number
  if (tab === 'wrong') {
    pool = wrongCount
    label = `間違えた ${pool}問から${Math.min(pool, QUESTIONS_PER_QUIZ)}問をはじめる`
  } else if (format === 'exam') {
    pool = examIndex.find((e) => e.id === props.realExam)?.count ?? 0
    label = `本番形式 ${pool}問をはじめる`
  } else {
    pool = examIndex.filter((e) => selectedExams.has(e.id)).reduce((s, e) => s + e.count, 0)
    label = `${pool}問から${Math.min(pool, QUESTIONS_PER_QUIZ)}問をはじめる`
  }

  return (
    <AppShell
      title="短答 過去問"
      onBack={() => navigate({ name: 'study' })}
      navigate={navigate}
      screenId="startScreen"
      footer={
        <button id="startBtn" className="btn-primary btn-block" onClick={props.onStart} disabled={pool === 0} type="button">
          {pool === 0 ? '当てはまる問題がありません' : label}
        </button>
      }
    >
      <Segmented
        id="kakomonTab"
        label="選び方"
        options={[
          { value: 'year', label: '年度別' },
          { value: 'wrong', label: `間違えた問題 ${wrongCount}` },
        ]}
        value={tab}
        onChange={props.onTabChange}
      />

      {tab === 'year' && (
        <>
          <SectionTitle>出題形式</SectionTitle>
          <Segmented
            id="formatSelect"
            label="出題形式"
            options={[
              { value: 'random', label: `ランダム${QUESTIONS_PER_QUIZ}問` },
              { value: 'exam', label: '本番形式（40問）' },
            ]}
            value={format}
            onChange={props.onFormatChange}
          />
          {format === 'random' ? (
            <ExamSelector exams={examIndex} selectedExams={selectedExams} onChange={props.onExamsChange} />
          ) : (
            <div className="chapter-selection" id="realExamList">
              <h3>試験を1つ選択（問題番号順に全問）</h3>
              <div className="chapter-list">
                {examIndex.map((exam) => (
                  <label key={exam.id} className={`chapter-item${props.realExam === exam.id ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      name="realExam"
                      value={exam.id}
                      checked={props.realExam === exam.id}
                      onChange={() => props.onRealExamChange(exam.id)}
                    />
                    <span className="chapter-item-label">{exam.label}</span>
                    <span className="question-badge">{exam.count}問</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {tab === 'wrong' && wrongCount === 0 && <p className="muted">復習期限の来た間違いはありません。</p>}
      <KakomonHistoryList history={props.history} exams={examIndex} />
    </AppShell>
  )
}

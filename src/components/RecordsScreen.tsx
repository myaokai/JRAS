import type { Navigate } from '../route'
import type { ExamMeta, KakomonHistory } from '../types'
import type { HabitSummary } from '../store/replay'
import { AppShell } from './layout/AppShell'
import { KakomonHistoryList } from './KakomonHistoryList'
import { Card, SectionTitle, Stat } from './ui'

interface Props {
  navigate: Navigate
  habit: HabitSummary
  totalCount: number
  recentAccuracy: number | null
  history: KakomonHistory
  examIndex: ExamMeta[]
}

export function RecordsScreen({ navigate, habit, totalCount, recentAccuracy, history, examIndex }: Props) {
  return (
    <AppShell title="学習記録" tab="records" navigate={navigate} screenId="recordsScreen">
      <div className="stat-grid">
        <Card>
          <Stat value={`${habit.currentStreak}日`} label="連続学習" />
        </Card>
        <Card>
          <Stat value={totalCount.toLocaleString()} label="累計解答" />
        </Card>
        <Card>
          <Stat value={recentAccuracy === null ? '—' : `${recentAccuracy}%`} label="直近50問の正答率" />
        </Card>
      </div>
      <p className="muted">最長連続 {habit.longestStreak}日</p>

      <SectionTitle>過去問の履歴</SectionTitle>
      {history.length === 0 ? <p className="muted">まだ記録がありません。</p> : <KakomonHistoryList history={history} exams={examIndex} />}

      <p className="note">学習量のヒートマップと章別の定着度は、今後追加します。</p>
    </AppShell>
  )
}

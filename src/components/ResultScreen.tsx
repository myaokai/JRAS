import type { Navigate } from '../route'
import { AppShell } from './layout/AppShell'
import { Card, ProgressBar, SectionTitle } from './ui'

export interface ResultItem {
  id: string
  label: string
  correct: boolean
  // 暗唱の「一部」（△で表示する）
  partial?: boolean
  // 次回の復習日（YYYY-MM-DD）。ライトナー方式の記録から求める
  dueDate: string | null
}

interface Props {
  navigate: Navigate
  mode: 'anaume' | 'kakomon' | 'anshou'
  items: ResultItem[]
  today: string
  todayCount: number
  dailyGoal: number
  onRetryWrong: () => void
}

function formatDue(dueDate: string | null, today: string): string {
  if (!dueDate) return '—'
  if (dueDate <= today) return '今日'
  const [, m, d] = dueDate.split('-').map(Number)
  return `${m}/${d}`
}

export function ResultScreen({ navigate, mode, items, today, todayCount, dailyGoal, onRetryWrong }: Props) {
  const total = items.length
  const correctCount = items.filter((i) => i.correct).length
  const wrongCount = total - correctCount
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const selectRoute = mode === 'kakomon' ? 'study-kakomon' : mode === 'anshou' ? 'study-anshou' : 'study-anaume'
  const pctLabel = mode === 'kakomon' ? '正答率 ' : mode === 'anshou' ? '「書けた」' : '「わかった」'
  const goalMet = todayCount >= dailyGoal

  return (
    <AppShell
      title="結果"
      navigate={navigate}
      screenId="resultScreen"
      footer={
        <>
          {wrongCount > 0 && (
            <button id="retryWrongBtn" className="btn-primary btn-block" onClick={onRetryWrong} type="button">
              {mode === 'anshou' ? `「書けた」以外の${wrongCount}問をもう一度` : `間違えた${wrongCount}問だけもう一度`}
            </button>
          )}
          <div className="bottom-bar-row">
            <button id="retryBtn" className="btn-secondary" onClick={() => navigate({ name: selectRoute })} type="button">
              範囲を選び直す
            </button>
            <button id="homeBtn" className="btn-secondary" onClick={() => navigate({ name: 'home' })} type="button">
              ホームへ
            </button>
          </div>
        </>
      }
    >
      <div className="result-card" id="resultText">
        <span className="result-score">
          {correctCount}
          <em> / {total} 問</em>
        </span>
        <span className="result-pct">{`${pctLabel}${pct}%`}</span>
      </div>

      <Card className="goal-card">
        <div className="row-title" id="goalStatus">
          {goalMet ? `今日の目標 ${dailyGoal}問を達成しました` : `今日の目標まであと ${dailyGoal - todayCount}問`}
        </div>
        <ProgressBar value={todayCount} max={dailyGoal} />
      </Card>

      <SectionTitle>問題ごとの結果と次回の復習</SectionTitle>
      <Card className="list-card">
        <ul className="result-list" id="resultList">
          {items.map((item, i) => (
            <li className="result-item" key={`${item.id}-${i}`} data-id={item.id}>
              <span
                className={item.correct ? 'text-ok' : item.partial ? 'text-partial' : 'text-ng'}
                aria-label={item.correct ? '正解' : item.partial ? '一部' : '不正解'}
              >
                {item.correct ? '○' : item.partial ? '△' : '×'}
              </span>
              <span className="result-item-label">{item.label}</span>
              <span className="result-item-due" data-due={item.dueDate ?? ''}>
                次回 {formatDue(item.dueDate, today)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  )
}

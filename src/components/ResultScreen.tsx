import type { Navigate } from '../route'
import { AppShell } from './layout/AppShell'

interface Props {
  navigate: Navigate
  mode: 'anaume' | 'kakomon'
  total: number
  correctCount: number
}

export function ResultScreen({ navigate, mode, total, correctCount }: Props) {
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const selectRoute = mode === 'kakomon' ? 'study-kakomon' : 'study-anaume'

  return (
    <AppShell
      title="結果"
      navigate={navigate}
      screenId="resultScreen"
      footer={
        <>
          <button id="retryBtn" className="btn-primary btn-block" onClick={() => navigate({ name: selectRoute })} type="button">
            もう一度
          </button>
          <button id="homeBtn" className="btn-secondary btn-block" onClick={() => navigate({ name: 'home' })} type="button">
            ホームへ
          </button>
        </>
      }
    >
      <div className="result-card" id="resultText">
        <span className="result-score">
          {correctCount}
          <em> / {total} 問</em>
        </span>
        <span className="result-pct">{mode === 'kakomon' ? `正答率 ${pct}%` : `「わかった」${pct}%`}</span>
      </div>
    </AppShell>
  )
}

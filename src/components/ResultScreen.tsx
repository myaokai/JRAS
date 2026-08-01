import type { Mode } from '../types'

interface Props {
  mode: Mode
  total: number
  correctCount: number
  onRetry: () => void
}

export function ResultScreen({ mode, total, correctCount, onRetry }: Props) {
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return (
    <div className="screen" id="resultScreen">
      <h2>{mode === 'kakomon' ? '結果発表' : '学習完了'}</h2>
      {mode === 'kakomon' ? (
        <p id="resultText">
          <span className="result-score">
            {correctCount}
            <em>/{total}</em>
          </span>
          <span className="result-pct">正答率 {pct}%</span>
        </p>
      ) : (
        <p id="resultText">全{total}問を学習しました。</p>
      )}
      <button id="retryBtn" className="btn-primary" onClick={onRetry} type="button">
        もう一度
      </button>
    </div>
  )
}

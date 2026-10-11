import type { Navigate } from '../route'
import type { HabitSummary } from '../store/replay'
import { DAILY_GOAL } from '../habit'
import { AppShell } from './layout/AppShell'
import { Card, ProgressBar, SectionTitle } from './ui'

interface Props {
  navigate: Navigate
  habit: HabitSummary
  anaumeReviewCount: number
  kakomonReviewCount: number
  onStartAnaumeReview: () => void
  onStartKakomonReview: () => void
}

export function HomeScreen({ navigate, habit, anaumeReviewCount, kakomonReviewCount, onStartAnaumeReview, onStartKakomonReview }: Props) {
  const reviews = [
    { label: '基準 穴埋め', count: anaumeReviewCount, onStart: onStartAnaumeReview, id: 'reviewAnaumeBtn' },
    { label: '短答 過去問', count: kakomonReviewCount, onStart: onStartKakomonReview, id: 'reviewKakomonBtn' },
  ]
  const totalReview = anaumeReviewCount + kakomonReviewCount

  return (
    <AppShell title="鑑定士 学習" tab="home" navigate={navigate} screenId="homeScreen">
      <Card className="hero-card">
        <div className="hero-label">今日の学習</div>
        <div className="hero-value" id="todayCount">
          {habit.todayCount} <small>/ {DAILY_GOAL} 問</small>
        </div>
        <ProgressBar value={habit.todayCount} max={DAILY_GOAL} />
        <div className="hero-sub" id="streak">
          🔥 {habit.currentStreak}日連続（最長 {habit.longestStreak}日）
        </div>
      </Card>

      <SectionTitle>今日の復習</SectionTitle>
      <Card>
        {totalReview === 0 ? (
          <p className="muted">復習期限の問題はありません</p>
        ) : (
          reviews.map((r) => (
            <div className="row" key={r.label}>
              <div className="row-main">
                <div className="row-title">{r.label}</div>
                <div className="row-sub">復習期限 {r.count}問</div>
              </div>
              <button className="btn-primary btn-compact" id={r.id} onClick={r.onStart} disabled={r.count === 0} type="button">
                はじめる
              </button>
            </div>
          ))
        )}
      </Card>

      <SectionTitle>科目</SectionTitle>
      <Card onClick={() => navigate({ name: 'study' })} id="subjectKantei">
        <div className="row-title">鑑定評価理論</div>
        <div className="row-sub">基準 穴埋め・短答 過去問・教科書</div>
        <span className="chevron" aria-hidden="true">›</span>
      </Card>
    </AppShell>
  )
}

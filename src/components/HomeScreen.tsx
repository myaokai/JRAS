import type { Navigate } from '../route'
import type { HabitSummary } from '../store/replay'
import { daysBetween } from '../date'
import { relogin } from '../session'
import { AppShell } from './layout/AppShell'
import { Card, ProgressBar, SectionTitle } from './ui'

interface Props {
  navigate: Navigate
  habit: HabitSummary
  // ログインが切れている（更新と同期が止まっている）
  sessionExpired: boolean
  today: string
  examDate: string | null
  dailyGoal: number
  anaumeReviewCount: number
  kakomonReviewCount: number
  anshouReviewCount: number
  onStartAnaumeReview: () => void
  onStartAnshouReview: () => void
  onStartKakomonReview: () => void
}

export function HomeScreen(props: Props) {
  const { navigate, habit, sessionExpired, today, examDate, dailyGoal } = props
  const reviews = [
    { label: '基準 穴埋め', count: props.anaumeReviewCount, onStart: props.onStartAnaumeReview, id: 'reviewAnaumeBtn' },
    { label: '短答 過去問', count: props.kakomonReviewCount, onStart: props.onStartKakomonReview, id: 'reviewKakomonBtn' },
    { label: '暗唱チェック', count: props.anshouReviewCount, onStart: props.onStartAnshouReview, id: 'reviewAnshouBtn' },
  ]
  const totalReview = reviews.reduce((sum, r) => sum + r.count, 0)

  return (
    <AppShell title="鑑定士 学習" tab="home" navigate={navigate} screenId="homeScreen">
      {sessionExpired && (
        <div className="session-banner" id="sessionBanner" role="alert">
          <div className="row-main">
            <div className="row-title">ログインが切れています</div>
            <div className="row-sub">アプリの更新と同期が止まっています。学習の記録はこの端末に残ります</div>
          </div>
          <button className="btn-primary btn-compact" id="reloginBannerBtn" onClick={relogin} type="button">
            ログイン
          </button>
        </div>
      )}
      <Card className="exam-card" id="examCountdown" onClick={examDate ? undefined : () => navigate({ name: 'settings' })}>
        <ExamCountdown today={today} examDate={examDate} />
      </Card>

      <Card className="hero-card">
        <div className="hero-label">今日の学習</div>
        <div className="hero-value" id="todayCount">
          {habit.todayCount} <small>/ {dailyGoal} 問</small>
        </div>
        <ProgressBar value={habit.todayCount} max={dailyGoal} />
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

function ExamCountdown({ today, examDate }: { today: string; examDate: string | null }) {
  if (!examDate) {
    return (
      <>
        <div className="row-title">試験日を設定する</div>
        <div className="row-sub">設定すると、試験までの残り日数を表示します</div>
        <span className="chevron" aria-hidden="true">›</span>
      </>
    )
  }
  const days = daysBetween(today, examDate)
  const [y, m, d] = examDate.split('-').map(Number)
  return (
    <>
      <div className="hero-label">
        試験日 {y}年{m}月{d}日
      </div>
      <div className="exam-days" id="examDays">
        {days > 0 ? (
          <>
            あと <strong>{days}</strong> 日
          </>
        ) : days === 0 ? (
          '今日が試験日です'
        ) : (
          '試験日を過ぎました（設定で次の試験日に変更できます）'
        )}
      </div>
    </>
  )
}

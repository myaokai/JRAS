import type { Navigate } from '../route'
import { AppShell } from './layout/AppShell'
import { Card, Chip, SectionTitle, Stat } from './ui'

interface Props {
  navigate: Navigate
  anaumeReviewCount: number
  kakomonReviewCount: number
  anshouReviewCount: number
  weekCount: number
  totalCount: number
}

export function StudyScreen({ navigate, anaumeReviewCount, kakomonReviewCount, anshouReviewCount, weekCount, totalCount }: Props) {
  return (
    <AppShell title="鑑定評価理論" tab="study" navigate={navigate} screenId="studyScreen">
      <Card className="stats-card">
        <Stat value={`${anaumeReviewCount + kakomonReviewCount + anshouReviewCount}問`} label="要復習" />
        <Stat value={`${weekCount}問`} label="直近7日" />
        <Stat value={`${totalCount}問`} label="累計" />
      </Card>

      <SectionTitle>短答式</SectionTitle>
      <Card onClick={() => navigate({ name: 'study-anaume' })} id="modeAnaume">
        <div className="row">
          <div className="row-main">
            <div className="row-title">基準 穴埋め</div>
            <div className="row-sub">基準の重要語句を穴埋めで暗記</div>
          </div>
          {anaumeReviewCount > 0 && <Chip tone="accent">要復習 {anaumeReviewCount}</Chip>}
        </div>
      </Card>
      <Card onClick={() => navigate({ name: 'study-kakomon' })} id="modeKakomon">
        <div className="row">
          <div className="row-main">
            <div className="row-title">短答 過去問</div>
            <div className="row-sub">令和3〜7年・鑑定評価理論／行政法規</div>
          </div>
          {kakomonReviewCount > 0 && <Chip tone="ng">間違い {kakomonReviewCount}</Chip>}
        </div>
      </Card>

      <SectionTitle>論文式</SectionTitle>
      <Card onClick={() => navigate({ name: 'study-anshou' })} id="modeAnshou">
        <div className="row">
          <div className="row-main">
            <div className="row-title">暗唱チェック</div>
            <div className="row-sub">定義・規定のお題から基準を再現して照合</div>
          </div>
          {anshouReviewCount > 0 && <Chip tone="accent">要復習 {anshouReviewCount}</Chip>}
        </div>
      </Card>
      <Card onClick={() => navigate({ name: 'study-drill' })} id="modeDrill">
        <div className="row">
          <div className="row-main">
            <div className="row-title">演習 計算ドリル</div>
            <div className="row-sub">収益還元法・原価法・取引事例比較法・継続賃料（毎回違う数値）</div>
          </div>
        </div>
      </Card>
      <p className="muted">論文過去問は今後追加します。</p>
    </AppShell>
  )
}

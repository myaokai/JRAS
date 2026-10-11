import { useMemo } from 'react'
import type { AnaumeQuestion, Chapter, KakomonQuestion, KijunData, KijunRef } from '../types'
import { isKakomonQuestion } from '../types'
import type { Navigate } from '../route'
import { getBlankIds } from '../questionText'
import { kijunRefLabel, refOf } from '../kijunRef'
import { AnaumeQuestionView } from './AnaumeQuestionView'
import { KakomonQuestionView } from './KakomonQuestionView'
import { AppShell } from './layout/AppShell'
import { ProgressBar } from './ui'

// 問題ごとの回答状態。App が持つので、教科書を開いて戻っても残る
export interface QuizResponse {
  revealed: string[]
  // 穴埋めの自己評価（true=わかった）。過去問は選んだ時点の正誤
  correct: boolean | null
  choice: string | null
}

export const EMPTY_RESPONSE: QuizResponse = { revealed: [], correct: null, choice: null }

interface Props {
  navigate: Navigate
  chapters: Record<string, Chapter>
  kijunData: KijunData
  currentQuestions: (AnaumeQuestion | KakomonQuestion)[]
  currentIndex: number
  response: QuizResponse
  onResponseChange: (response: QuizResponse) => void
  onNext: () => void
  onAnaumeAssessed: (questionId: number, correct: boolean) => void
  onKakomonAnswered: (questionId: string, choice: string, correct: boolean) => void
}

export function QuizScreen({
  navigate,
  chapters,
  kijunData,
  currentQuestions,
  currentIndex,
  response,
  onResponseChange,
  onNext,
  onAnaumeAssessed,
  onKakomonAnswered,
}: Props) {
  const current = currentQuestions[currentIndex]
  const revealed = useMemo(() => new Set(response.revealed), [response.revealed])

  const blankIds = useMemo(
    () => (current && !isKakomonQuestion(current) ? getBlankIds(current.text, current.id) : []),
    [current],
  )
  const allRevealed = blankIds.length > 0 && blankIds.every((id) => revealed.has(id))

  if (!current) return null
  const kakomon = isKakomonQuestion(current)

  const categoryLabel = kakomon
    ? `${current._examLabel}　問${current.number}`
    : (() => {
        const chapter = chapters[current.chapter]
        const sectionTitle = chapter?.sections[current.section]
        return sectionTitle ? `${chapter?.title ?? ''} / ${sectionTitle}` : (chapter?.title ?? '')
      })()

  const assess = (correct: boolean) => {
    if (response.correct !== null || kakomon) return
    onResponseChange({ ...response, correct })
    onAnaumeAssessed(current.id, correct)
  }

  const openKijun = (ref: KijunRef) =>
    navigate({ name: 'textbook', chapterId: ref.chapter, sectionId: ref.section, fromQuiz: true })

  const isLast = currentIndex + 1 >= currentQuestions.length
  const nextLabel = isLast ? '結果を見る' : '次の問題'

  let footer
  if (kakomon) {
    footer = (
      <button id="nextBtn" className="btn-primary btn-block" onClick={onNext} disabled={response.choice === null} type="button">
        {nextLabel}
      </button>
    )
  } else if (!allRevealed) {
    footer = (
      <button id="showAllBtn" className="btn-secondary btn-block" onClick={() => onResponseChange({ ...response, revealed: blankIds })} type="button">
        すべて表示
      </button>
    )
  } else if (response.correct === null) {
    footer = (
      <div className="assess-row">
        <button className="assess-btn unknown" onClick={() => assess(false)} type="button">
          わからなかった
        </button>
        <button className="assess-btn known" onClick={() => assess(true)} type="button">
          わかった
        </button>
      </div>
    )
  } else {
    footer = (
      <button id="nextBtn" className="btn-primary btn-block" onClick={onNext} type="button">
        {nextLabel}
      </button>
    )
  }

  return (
    <AppShell
      title={`${currentIndex + 1} / ${currentQuestions.length}`}
      onBack={() => navigate({ name: kakomon ? 'study-kakomon' : 'study-anaume' })}
      backLabel="出題をやめる"
      navigate={navigate}
      screenId="quizScreen"
      footer={footer}
    >
      <ProgressBar value={currentIndex + 1} max={currentQuestions.length} />
      <div className="question-header">
        <span id="questionCategory">{categoryLabel}</span>
      </div>

      {kakomon ? (
        <KakomonQuestionView
          question={current}
          selectedKey={response.choice}
          onSelect={(key) => {
            if (response.choice !== null) return
            const correct = key === current.answer
            onResponseChange({ ...response, choice: key, correct })
            onKakomonAnswered(current.id, key, correct)
          }}
          renderKijunLink={(ref) => <KijunLink kijunData={kijunData} kijunRef={ref} onOpen={openKijun} />}
        />
      ) : (
        <>
          <AnaumeQuestionView
            question={current}
            revealedBlankIds={revealed}
            onRevealBlank={(id) => onResponseChange({ ...response, revealed: [...new Set([...response.revealed, id])] })}
          />
          {response.correct !== null && (
            <div className={`answer-feedback${response.correct ? ' correct' : ' wrong'}`}>
              {response.correct ? 'わかった：次の復習まで間隔をあけます' : 'わからなかった：今日もう一度出題されます'}
            </div>
          )}
          {allRevealed && <KijunLink kijunData={kijunData} kijunRef={refOf(current.chapter, current.section)} onOpen={openKijun} />}
        </>
      )}
    </AppShell>
  )
}

export function KijunLink({ kijunData, kijunRef, onOpen }: { kijunData: KijunData; kijunRef: KijunRef; onOpen: (ref: KijunRef) => void }) {
  const label = kijunRefLabel(kijunData, kijunRef)
  if (!label) return null
  return (
    <button className="kijun-link" onClick={() => onOpen(kijunRef)} type="button">
      📖 基準 {label}を読む
    </button>
  )
}

import { useMemo } from 'react'
import type { AnaumeQuestion, AnshouUnit, Chapter, KakomonQuestion, KijunData, KijunRef } from '../types'
import { isAnshouUnit, isKakomonQuestion } from '../types'
import type { AnswerResult } from '../store/types'
import type { Navigate } from '../route'
import { getBlankIds } from '../questionText'
import { kijunRefLabel, refOf } from '../kijunRef'
import { AnaumeQuestionView } from './AnaumeQuestionView'
import { KakomonQuestionView } from './KakomonQuestionView'
import { AnshouQuestionView } from './AnshouQuestionView'
import { AppShell } from './layout/AppShell'
import { ProgressBar } from './ui'

// 問題ごとの回答状態。App が持つので、教科書を開いて戻っても残る
export interface QuizResponse {
  // 穴埋めは表示した穴の id。暗唱は 'hint'・'text'（ヒント・本文を表示した）
  revealed: string[]
  // 穴埋めの自己評価（true=わかった）。過去問は選んだ時点の正誤。暗唱は「書けた」のとき true
  correct: boolean | null
  choice: string | null
  // 暗唱の3段階の自己評価と、メモ欄（保存しない）
  grade?: AnswerResult
  memo?: string
}

export const EMPTY_RESPONSE: QuizResponse = { revealed: [], correct: null, choice: null }

const ANSHOU_GRADES: { grade: AnswerResult; label: string; className: string }[] = [
  { grade: 0, label: '書けなかった', className: 'unknown' },
  { grade: 1, label: '一部', className: 'partial' },
  { grade: 2, label: '書けた', className: 'known' },
]

const ANSHOU_FEEDBACK: Record<AnswerResult, string> = {
  0: '書けなかった：今日もう一度出題されます',
  1: '一部：明日もう一度出題されます',
  2: '書けた：次の復習まで間隔をあけます',
}

interface Props {
  navigate: Navigate
  chapters: Record<string, Chapter>
  kijunData: KijunData
  currentQuestions: (AnaumeQuestion | KakomonQuestion | AnshouUnit)[]
  currentIndex: number
  response: QuizResponse
  onResponseChange: (response: QuizResponse) => void
  onNext: () => void
  onAnaumeAssessed: (questionId: number, correct: boolean) => void
  onKakomonAnswered: (questionId: string, choice: string, correct: boolean) => void
  onAnshouAssessed: (unitId: string, grade: AnswerResult) => void
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
  onAnshouAssessed,
}: Props) {
  const current = currentQuestions[currentIndex]
  const revealed = useMemo(() => new Set(response.revealed), [response.revealed])

  const blankIds = useMemo(
    () => (current && !isKakomonQuestion(current) && !isAnshouUnit(current) ? getBlankIds(current.text, current.id) : []),
    [current],
  )
  const allRevealed = blankIds.length > 0 && blankIds.every((id) => revealed.has(id))

  if (!current) return null
  const kakomon = isKakomonQuestion(current)
  const anshou = isAnshouUnit(current)

  const categoryLabel = kakomon
    ? `${current._examLabel}　問${current.number}`
    : anshou
      ? current.context
      : (() => {
          const chapter = chapters[current.chapter]
          const sectionTitle = chapter?.sections[current.section]
          return sectionTitle ? `${chapter?.title ?? ''} / ${sectionTitle}` : (chapter?.title ?? '')
        })()

  const assess = (correct: boolean) => {
    if (response.correct !== null || kakomon || anshou) return
    onResponseChange({ ...response, correct })
    onAnaumeAssessed(current.id, correct)
  }

  const reveal = (key: string) => onResponseChange({ ...response, revealed: [...new Set([...response.revealed, key])] })
  const assessAnshou = (grade: AnswerResult) => {
    if (!anshou || response.grade !== undefined) return
    onResponseChange({ ...response, grade, correct: grade === 2 })
    onAnshouAssessed(current.id, grade)
  }

  const openKijun = (ref: KijunRef) =>
    navigate({ name: 'textbook', chapterId: ref.chapter, sectionId: ref.section, fromQuiz: true })

  const isLast = currentIndex + 1 >= currentQuestions.length
  const nextLabel = isLast ? '結果を見る' : '次の問題'

  let footer
  if (anshou) {
    if (!revealed.has('text')) {
      footer = (
        <button id="showTextBtn" className="btn-secondary btn-block" onClick={() => reveal('text')} type="button">
          本文を表示
        </button>
      )
    } else if (response.grade === undefined) {
      footer = (
        <div className="assess-row" id="anshouAssess">
          {ANSHOU_GRADES.map((g) => (
            <button key={g.grade} className={`assess-btn ${g.className}`} data-grade={g.grade} onClick={() => assessAnshou(g.grade)} type="button">
              {g.label}
            </button>
          ))}
        </div>
      )
    } else {
      footer = (
        <button id="nextBtn" className="btn-primary btn-block" onClick={onNext} type="button">
          {nextLabel}
        </button>
      )
    }
  } else if (kakomon) {
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
      onBack={() => navigate({ name: kakomon ? 'study-kakomon' : anshou ? 'study-anshou' : 'study-anaume' })}
      backLabel="出題をやめる"
      navigate={navigate}
      screenId="quizScreen"
      footer={footer}
    >
      <ProgressBar value={currentIndex + 1} max={currentQuestions.length} />
      <div className="question-header">
        <span id="questionCategory">{categoryLabel}</span>
      </div>

      {anshou ? (
        <>
          <AnshouQuestionView
            unit={current}
            hintShown={revealed.has('hint')}
            textShown={revealed.has('text')}
            memo={response.memo ?? ''}
            onShowHint={() => reveal('hint')}
            onMemoChange={(memo) => onResponseChange({ ...response, memo })}
            kijunLink={<KijunLink kijunData={kijunData} kijunRef={refOf(current.chapter, current.section)} onOpen={openKijun} />}
          />
          {response.grade !== undefined && (
            <div className={`answer-feedback${response.grade === 2 ? ' correct' : ' wrong'}`} id="anshouFeedback">
              {ANSHOU_FEEDBACK[response.grade]}
            </div>
          )}
        </>
      ) : kakomon ? (
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

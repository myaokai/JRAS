import { useEffect, useMemo, useState } from 'react'
import type { AnaumeQuestion, Chapter, KakomonQuestion } from '../types'
import { isKakomonQuestion } from '../types'
import type { Navigate } from '../route'
import { getBlankIds } from '../questionText'
import { AnaumeQuestionView } from './AnaumeQuestionView'
import { KakomonQuestionView } from './KakomonQuestionView'
import { AppShell } from './layout/AppShell'
import { ProgressBar } from './ui'

interface Props {
  navigate: Navigate
  chapters: Record<string, Chapter>
  currentQuestions: (AnaumeQuestion | KakomonQuestion)[]
  currentIndex: number
  onNext: () => void
  onAnaumeAssessed: (questionId: number, correct: boolean) => void
  onKakomonAnswered: (questionId: string, choice: string, correct: boolean) => void
}

export function QuizScreen({
  navigate,
  chapters,
  currentQuestions,
  currentIndex,
  onNext,
  onAnaumeAssessed,
  onKakomonAnswered,
}: Props) {
  const current = currentQuestions[currentIndex]
  const [revealedBlankIds, setRevealedBlankIds] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [assessed, setAssessed] = useState<boolean | null>(null)

  useEffect(() => {
    setRevealedBlankIds(new Set())
    setSelectedKey(null)
    setAssessed(null)
  }, [currentIndex])

  const blankIds = useMemo(
    () => (current && !isKakomonQuestion(current) ? getBlankIds(current.text, current.id) : []),
    [current],
  )
  const allRevealed = blankIds.length > 0 && blankIds.every((id) => revealedBlankIds.has(id))

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
    if (assessed !== null || kakomon) return
    setAssessed(correct)
    onAnaumeAssessed(current.id, correct)
  }

  const isLast = currentIndex + 1 >= currentQuestions.length
  const nextLabel = isLast ? '結果を見る' : '次の問題'

  let footer
  if (kakomon) {
    footer = (
      <button id="nextBtn" className="btn-primary btn-block" onClick={onNext} disabled={selectedKey === null} type="button">
        {nextLabel}
      </button>
    )
  } else if (!allRevealed) {
    footer = (
      <button id="showAllBtn" className="btn-secondary btn-block" onClick={() => setRevealedBlankIds(new Set(blankIds))} type="button">
        すべて表示
      </button>
    )
  } else if (assessed === null) {
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
          selectedKey={selectedKey}
          onSelect={(key) => {
            if (selectedKey !== null) return
            setSelectedKey(key)
            onKakomonAnswered(current.id, key, key === current.answer)
          }}
        />
      ) : (
        <>
          <AnaumeQuestionView
            question={current}
            revealedBlankIds={revealedBlankIds}
            onRevealBlank={(id) => setRevealedBlankIds((prev) => new Set(prev).add(id))}
          />
          {assessed !== null && (
            <div className={`answer-feedback${assessed ? ' correct' : ' wrong'}`}>
              {assessed ? 'わかった：次の復習まで間隔をあけます' : 'わからなかった：今日もう一度出題されます'}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

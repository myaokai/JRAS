import { useEffect, useMemo, useState } from 'react'
import type { AnaumeQuestion, Chapter, KakomonQuestion, Mode } from '../types'
import { isKakomonQuestion } from '../types'
import { getBlankIds } from '../questionText'
import { AnaumeQuestionView } from './AnaumeQuestionView'
import { KakomonQuestionView } from './KakomonQuestionView'

interface Props {
  mode: Mode
  chapters: Record<string, Chapter>
  currentQuestions: (AnaumeQuestion | KakomonQuestion)[]
  currentIndex: number
  onNext: () => void
  onAnaumeAssessed: (questionId: number, correct: boolean) => void
  onKakomonAnswered: (questionId: string, correct: boolean) => void
}

export function QuizScreen({
  mode,
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
    () => (!isKakomonQuestion(current) ? getBlankIds(current.text, current.id) : []),
    [current],
  )
  const allRevealed =
    blankIds.length > 0 && blankIds.every((id) => revealedBlankIds.has(id))

  if (!current) return null

  const categoryLabel =
    mode === 'anaume' && !isKakomonQuestion(current)
      ? `${chapters[current.chapter]?.title ?? ''} / ${
          chapters[current.chapter]?.sections[current.section] ?? ''
        }`
      : isKakomonQuestion(current)
        ? `${current._examLabel}　問${current.number}`
        : ''

  const revealAll = () => {
    if (isKakomonQuestion(current)) return
    setRevealedBlankIds(new Set(getBlankIds(current.text, current.id)))
  }

  const assess = (correct: boolean) => {
    if (assessed !== null || isKakomonQuestion(current)) return
    setAssessed(correct)
    onAnaumeAssessed(current.id, correct)
  }

  return (
    <div className="screen" id="quizScreen">
      <div className="question-header">
        <span>
          問題 {currentIndex + 1} / {currentQuestions.length}
        </span>
        <span>{categoryLabel}</span>
      </div>

      {isKakomonQuestion(current) ? (
        <KakomonQuestionView
          question={current}
          selectedKey={selectedKey}
          onSelect={(key) => {
            if (selectedKey !== null) return
            setSelectedKey(key)
            onKakomonAnswered(current.id, key === current.answer)
          }}
        />
      ) : (
        <AnaumeQuestionView
          question={current}
          revealedBlankIds={revealedBlankIds}
          onRevealBlank={(id) =>
            setRevealedBlankIds((prev) => new Set(prev).add(id))
          }
        />
      )}

      {mode === 'anaume' && allRevealed && (
        <div className="assess-row">
          <button
            className={`assess-btn known${assessed === true ? ' selected' : ''}`}
            onClick={() => assess(true)}
            disabled={assessed !== null}
            type="button"
          >
            わかった
          </button>
          <button
            className={`assess-btn unknown${assessed === false ? ' selected' : ''}`}
            onClick={() => assess(false)}
            disabled={assessed !== null}
            type="button"
          >
            わからなかった
          </button>
        </div>
      )}

      <div className="controls">
        {mode === 'anaume' && (
          <button id="showAllBtn" className="btn-secondary" onClick={revealAll} type="button">
            すべて表示
          </button>
        )}
        <button
          id="nextBtn"
          className="btn-primary"
          onClick={onNext}
          disabled={mode === 'kakomon' && selectedKey === null}
          type="button"
        >
          次の問題
        </button>
      </div>
    </div>
  )
}

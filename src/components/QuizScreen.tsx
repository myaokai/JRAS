import { useEffect, useState } from 'react'
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
  onAnaumeAllRevealed: (questionId: number) => void
  onKakomonAnswered: (questionId: string, correct: boolean) => void
}

export function QuizScreen({
  mode,
  chapters,
  currentQuestions,
  currentIndex,
  onNext,
  onAnaumeAllRevealed,
  onKakomonAnswered,
}: Props) {
  const current = currentQuestions[currentIndex]
  const [revealedBlankIds, setRevealedBlankIds] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    setRevealedBlankIds(new Set())
    setSelectedKey(null)
  }, [currentIndex])

  useEffect(() => {
    if (mode !== 'anaume' || isKakomonQuestion(current)) return
    const blankIds = getBlankIds(current.text, current.id)
    if (blankIds.length > 0 && blankIds.every((id) => revealedBlankIds.has(id))) {
      onAnaumeAllRevealed(current.id)
    }
  }, [mode, current, revealedBlankIds, onAnaumeAllRevealed])

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

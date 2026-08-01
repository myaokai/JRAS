import { useMemo } from 'react'
import type { AnaumeQuestion } from '../types'
import { parseAnaumeText } from '../questionText'

interface Props {
  question: AnaumeQuestion
  revealedBlankIds: Set<string>
  onRevealBlank: (blankId: string) => void
}

export function AnaumeQuestionView({ question, revealedBlankIds, onRevealBlank }: Props) {
  const segments = useMemo(
    () => parseAnaumeText(question.text, question.id),
    [question],
  )

  return (
    <div className="question-text">
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>
        const revealed = revealedBlankIds.has(seg.blankId as string)
        return (
          <span
            key={i}
            className={`blank${revealed ? ' revealed' : ''}`}
            onClick={() => onRevealBlank(seg.blankId as string)}
          >
            {revealed ? seg.value : ''}
          </span>
        )
      })}
    </div>
  )
}

import type { ReactNode } from 'react'
import type { KakomonQuestion, KijunRef } from '../types'

interface Props {
  question: KakomonQuestion
  selectedKey: string | null
  onSelect: (key: string) => void
  renderKijunLink: (ref: KijunRef) => ReactNode
}

function MultilineText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i, arr) => (
        <span key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

export function KakomonQuestionView({ question, selectedKey, onSelect, renderKijunLink }: Props) {
  const answered = selectedKey !== null
  const isCorrect = answered && selectedKey === question.answer

  return (
    <>
      <div className="question-text">
        <MultilineText text={question.instruction} />
      </div>
      <div className="choices-container" id="choicesContainer">
        {question.choices.map((choice) => {
          let cls = 'choice-btn'
          let tag: string | null = null
          if (answered) {
            if (choice.key === question.answer) {
              cls += ' choice-correct'
              tag = '正解'
            } else if (choice.key === selectedKey) {
              cls += ' choice-wrong'
              tag = 'あなたの回答'
            }
          }
          return (
            <button
              key={choice.key}
              className={cls}
              disabled={answered}
              onClick={() => onSelect(choice.key)}
            >
              <span className="choice-key">{choice.key}</span>
              <span className="choice-text">{choice.text}</span>
              {tag && <span className="choice-tag">{tag}</span>}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className={`answer-feedback${isCorrect ? ' correct' : ' wrong'}`}>
          {isCorrect ? '正解！' : `不正解（正解: ${question.answer}）`}
        </div>
      )}
      {answered && <Explanation question={question} renderKijunLink={renderKijunLink} />}
    </>
  )
}

// 解答後の解説（FR-11）と基準リンク（FR-12）。解説がない問題では、リンクがあればリンクだけを出す
function Explanation({ question, renderKijunLink }: Pick<Props, 'question' | 'renderKijunLink'>) {
  const choices = question.choices.filter((c) => c.explanation || c.kijunRef)
  if (!question.explanation && !question.kijunRef && choices.length === 0) return null
  return (
    <div className="explanation" id="explanation">
      <div className="explanation-title">解説</div>
      {question.explanation && (
        <p className="explanation-text">
          <MultilineText text={question.explanation} />
        </p>
      )}
      {question.kijunRef && renderKijunLink(question.kijunRef)}
      {choices.map((c) => (
        <div className="explanation-choice" key={c.key}>
          <span className={`choice-key${c.key === question.answer ? ' is-answer' : ''}`}>{c.key}</span>
          <div className="explanation-choice-body">
            {c.explanation && <MultilineText text={c.explanation} />}
            {c.kijunRef && renderKijunLink(c.kijunRef)}
          </div>
        </div>
      ))}
    </div>
  )
}

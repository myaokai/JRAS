import type { KakomonQuestion } from '../types'

interface Props {
  question: KakomonQuestion
  selectedKey: string | null
  onSelect: (key: string) => void
}

export function KakomonQuestionView({ question, selectedKey, onSelect }: Props) {
  const answered = selectedKey !== null
  const isCorrect = answered && selectedKey === question.answer

  return (
    <>
      <div className="question-text">
        {question.instruction.split('\n').map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
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
    </>
  )
}

import type { KakomonQuestion } from '../types'

interface Props {
  question: KakomonQuestion
  selectedKey: string | null
  onSelect: (key: string) => void
}

export function KakomonQuestionView({ question, selectedKey, onSelect }: Props) {
  const answered = selectedKey !== null

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
          if (answered) {
            if (choice.key === question.answer) cls += ' choice-correct'
            else if (choice.key === selectedKey) cls += ' choice-wrong'
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
            </button>
          )
        })}
      </div>
    </>
  )
}

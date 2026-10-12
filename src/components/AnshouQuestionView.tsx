import type { ReactNode } from 'react'
import type { AnshouUnit } from '../types'

// ヒントで見せる本文の書き出しの文字数
const HINT_CHARS = 15

interface Props {
  unit: AnshouUnit
  hintShown: boolean
  textShown: boolean
  memo: string
  onShowHint: () => void
  onMemoChange: (memo: string) => void
  kijunLink: ReactNode
}

export function AnshouQuestionView({ unit, hintShown, textShown, memo, onShowHint, onMemoChange, kijunLink }: Props) {
  return (
    <>
      <div className="question-text anshou-prompt" id="anshouPrompt">
        {unit.prompt}
      </div>
      {hintShown ? (
        <p className="anshou-hint" id="anshouHint">
          ヒント：{unit.text.replace(/\s+/g, ' ').slice(0, HINT_CHARS)}…
        </p>
      ) : (
        !textShown && (
          <button className="btn-small anshou-hint-btn" id="anshouHintBtn" onClick={onShowHint} type="button">
            ヒント（書き出しを見る）
          </button>
        )
      )}
      <textarea
        className="input anshou-memo"
        id="anshouMemo"
        rows={4}
        placeholder="思い出せたことをメモ（任意・保存されません）"
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
      />
      {textShown && (
        <div className="explanation" id="anshouText">
          <div className="explanation-title">基準の本文</div>
          <div className="explanation-text anshou-text">{unit.text}</div>
          {kijunLink}
        </div>
      )}
    </>
  )
}

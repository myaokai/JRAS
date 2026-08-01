import type { Mode } from '../types'

interface Props {
  mode: Mode
  onChange: (mode: Mode) => void
}

export function ModeTabs({ mode, onChange }: Props) {
  return (
    <div className="mode-tabs">
      <button
        className={`mode-tab${mode === 'anaume' ? ' active' : ''}`}
        data-mode="anaume"
        onClick={() => onChange('anaume')}
      >
        穴埋め問題
      </button>
      <button
        className={`mode-tab${mode === 'kakomon' ? ' active' : ''}`}
        data-mode="kakomon"
        onClick={() => onChange('kakomon')}
      >
        過去問（短答式）
      </button>
    </div>
  )
}

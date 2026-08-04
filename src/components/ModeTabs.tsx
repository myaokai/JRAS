import type { Mode } from '../types'

interface Props {
  mode: Mode
  onChange: (mode: Mode) => void
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'anaume', label: '穴埋め問題' },
  { mode: 'kakomon', label: '過去問（短答式）' },
  { mode: 'textbook', label: '教科書' },
]

export function ModeTabs({ mode, onChange }: Props) {
  return (
    <div className="mode-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.mode}
          className={`mode-tab${mode === tab.mode ? ' active' : ''}`}
          data-mode={tab.mode}
          onClick={() => onChange(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

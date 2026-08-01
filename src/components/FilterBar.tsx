interface Props {
  barId: string
  btnId: string
  countId: string
  label: string
  count: number
  active: boolean
  onToggle: () => void
}

export function FilterBar({ barId, btnId, countId, label, count, active, onToggle }: Props) {
  if (count === 0) return null

  return (
    <div className="kakomon-filter-bar" id={barId}>
      <button
        id={btnId}
        className={`filter-wrong-btn${active ? ' active' : ''}`}
        onClick={onToggle}
        type="button"
      >
        <span>{label}</span>
        <span className="filter-wrong-count" id={countId}>
          {count}問
        </span>
      </button>
    </div>
  )
}

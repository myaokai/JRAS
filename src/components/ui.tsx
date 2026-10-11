import type { ReactNode } from 'react'

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>
}

export function Card({ children, className = '', onClick, id }: { children: ReactNode; className?: string; onClick?: () => void; id?: string }) {
  if (onClick) {
    return (
      <button className={`card card-link ${className}`} onClick={onClick} type="button" id={id}>
        {children}
      </button>
    )
  }
  return (
    <div className={`card ${className}`} id={id}>
      {children}
    </div>
  )
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'ng' }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

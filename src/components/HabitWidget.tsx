import type { HabitRecord } from '../types'
import { DAILY_GOAL } from '../habit'
import { todayStr } from '../date'

interface Props {
  habitRecord: HabitRecord
}

export function HabitWidget({ habitRecord }: Props) {
  const todayCount = habitRecord.todayDate === todayStr() ? habitRecord.todayCount : 0
  const pct = Math.min(100, Math.round((todayCount / DAILY_GOAL) * 100))

  return (
    <div className="habit-widget">
      <span className="habit-streak">🔥 {habitRecord.currentStreak}日連続</span>
      <span className="habit-today">
        今日 {todayCount}/{DAILY_GOAL}問
      </span>
      <div className="habit-progress">
        <div className="habit-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

import type { HabitRecord } from './types'
import { addDays, todayStr } from './date'

export const DAILY_GOAL = 10

export const EMPTY_HABIT_RECORD: HabitRecord = {
  lastStudyDate: '',
  currentStreak: 0,
  longestStreak: 0,
  todayDate: '',
  todayCount: 0,
}

export function recordStudy(prev: HabitRecord): HabitRecord {
  const today = todayStr()

  const todayDate = prev.todayDate === today ? prev.todayDate : today
  const todayCount = prev.todayDate === today ? prev.todayCount + 1 : 1

  if (prev.lastStudyDate === today) {
    return { ...prev, todayDate, todayCount }
  }

  const yesterday = addDays(today, -1)
  const currentStreak = prev.lastStudyDate === yesterday ? prev.currentStreak + 1 : 1

  return {
    lastStudyDate: today,
    currentStreak,
    longestStreak: Math.max(prev.longestStreak, currentStreak),
    todayDate,
    todayCount,
  }
}

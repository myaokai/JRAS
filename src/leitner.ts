import type { ProblemRecordEntry } from './types'
import { addDays, todayStr } from './date'

const MAX_BOX = 5
const INTERVAL_DAYS = [1, 3, 7, 14, 30]

export function nextEntry(prev: ProblemRecordEntry | undefined, correct: boolean): ProblemRecordEntry {
  const today = todayStr()
  const box = correct ? Math.min((prev?.box ?? 0) + 1, MAX_BOX) : 0
  const dueDate = correct ? addDays(today, INTERVAL_DAYS[box - 1]) : today
  return { box, dueDate, lastResult: correct, ts: Date.now() }
}

export function isDue(entry: ProblemRecordEntry | undefined): boolean {
  return !entry || entry.dueDate <= todayStr()
}

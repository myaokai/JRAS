import type { ProblemRecordEntry } from './types'
import { addDays, dateStrOf, todayStr } from './date'

const MAX_BOX = 5
const INTERVAL_DAYS = [1, 3, 7, 14, 30]

export function nextEntry(
  prev: ProblemRecordEntry | undefined,
  correct: boolean,
  now: number = Date.now(),
): ProblemRecordEntry {
  const today = dateStrOf(now)
  const box = correct ? Math.min((prev?.box ?? 0) + 1, MAX_BOX) : 0
  const dueDate = correct ? addDays(today, INTERVAL_DAYS[box - 1]) : today
  return { box, dueDate, lastResult: correct, ts: now }
}

// 一部だけ再現できた（暗唱チェックの「一部」）。ボックスは上げも下げもせず、翌日にもう一度出す
export function partialEntry(prev: ProblemRecordEntry | undefined, now: number = Date.now()): ProblemRecordEntry {
  return { box: prev?.box ?? 0, dueDate: addDays(dateStrOf(now), 1), lastResult: false, ts: now }
}

export function isDue(entry: ProblemRecordEntry | undefined, today: string = todayStr()): boolean {
  return !entry || entry.dueDate <= today
}

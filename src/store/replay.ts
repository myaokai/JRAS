import { nextEntry } from '../leitner'
import { addDays, dateStrOf } from '../date'
import type { KakomonHistory, ProblemRecord, ProblemRecordEntry } from '../types'
import type { Answer, LegacyHabit } from './types'

export interface HabitSummary {
  currentStreak: number
  longestStreak: number
  todayCount: number
}

function byTime(a: Answer, b: Answer): number {
  return a.answered_at - b.answered_at || a.id.localeCompare(b.id)
}

// ログを時刻順に再生して、問題ごとの復習状態（ライトナー方式）を求める。
// snapshot は移行前の状態をそのまま初期値にする。
export function buildProblemRecord(answers: Answer[]): ProblemRecord {
  const record: ProblemRecord = {}
  for (const a of [...answers].sort(byTime)) {
    if (a.mode === 'snapshot') {
      if (a.payload) record[a.question_id] = JSON.parse(a.payload) as ProblemRecordEntry
    } else {
      record[a.question_id] = nextEntry(record[a.question_id], a.result === 2, a.answered_at)
    }
  }
  return record
}

function studyDates(answers: Answer[], legacy: LegacyHabit | null): Set<string> {
  const dates = new Set<string>()
  for (const a of answers) {
    if (a.mode !== 'snapshot') dates.add(dateStrOf(a.answered_at))
  }
  if (legacy?.lastStudyDate) {
    for (let i = 0; i < legacy.currentStreak; i++) dates.add(addDays(legacy.lastStudyDate, -i))
  }
  return dates
}

export function buildHabit(answers: Answer[], legacy: LegacyHabit | null, today: string): HabitSummary {
  const dates = studyDates(answers, legacy)

  // 今日まだ解いていなくても、昨日まで続いていれば連続は途切れていない
  let currentStreak = 0
  let day = dates.has(today) ? today : addDays(today, -1)
  while (dates.has(day)) {
    currentStreak++
    day = addDays(day, -1)
  }

  let longestStreak = legacy?.longestStreak ?? 0
  for (const d of dates) {
    if (dates.has(addDays(d, -1))) continue
    let run = 0
    for (let x = d; dates.has(x); x = addDays(x, 1)) run++
    longestStreak = Math.max(longestStreak, run)
  }

  const loggedToday = answers.filter(
    (a) => a.mode !== 'snapshot' && dateStrOf(a.answered_at) === today,
  ).length
  const legacyToday = legacy?.todayDate === today ? legacy.todayCount : 0

  return { currentStreak, longestStreak, todayCount: loggedToday + legacyToday }
}

// 過去問の問題ID（例 R07_kanteishi_001）から試験ID（R07_kanteishi）を取り出す
export function examIdOf(questionId: string): string {
  return questionId.replace(/_\d+$/, '')
}

// 過去問の履歴を、セット（session_id）ごとに新しい順で返す
export function buildKakomonHistory(answers: Answer[], limit = 5): KakomonHistory {
  const sessions = new Map<string, Answer[]>()
  for (const a of answers) {
    if (a.mode !== 'kakomon' || !a.session_id) continue
    const list = sessions.get(a.session_id) ?? []
    list.push(a)
    sessions.set(a.session_id, list)
  }
  return [...sessions.values()]
    .map((list) => {
      const timestamp = Math.max(...list.map((a) => a.answered_at))
      return {
        timestamp,
        dateStr: new Date(timestamp).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        }),
        examIds: [...new Set(list.map((a) => examIdOf(a.question_id)))].sort().reverse(),
        total: list.length,
        correct: list.filter((a) => a.result === 2).length,
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

import type { AnaumeQuestion, KakomonQuestion, ProblemRecord } from './types'
import { isDue } from './leitner'
import { shuffled } from './shuffle'

// 出題方法。due=学習済みで復習期限が来た問題、new=まだ解いていない問題
export type PoolMethod = 'all' | 'due' | 'new'

export const QUIZ_SIZES = [5, 10, 20] as const

// 節の識別子（例 "8-4"）。節のない章（総論第4章）は section 0
export function sectionKey(chapter: number | string, section: number | string): string {
  return `${chapter}-${section}`
}

export function matchesMethod(record: ProblemRecord, id: string, method: PoolMethod, today: string): boolean {
  const entry = record[id]
  if (method === 'new') return !entry
  if (method === 'due') return !!entry && isDue(entry, today)
  return true
}

export function anaumePool(
  questions: AnaumeQuestion[],
  sections: Set<string>,
  method: PoolMethod,
  record: ProblemRecord,
  today: string,
): AnaumeQuestion[] {
  return questions.filter(
    (q) => sections.has(sectionKey(q.chapter, q.section)) && matchesMethod(record, String(q.id), method, today),
  )
}

export function pickRandom<T>(pool: T[], size: number): T[] {
  return shuffled(pool).slice(0, size)
}

// 本番形式：1つの試験を問題番号順に全問
export function inExamOrder(questions: KakomonQuestion[]): KakomonQuestion[] {
  return [...questions].sort((a, b) => a.number - b.number)
}

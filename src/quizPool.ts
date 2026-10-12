import type { AnaumeQuestion, AnshouUnit, KakomonQuestion, ProblemRecord } from './types'
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

export function anshouPool(
  units: AnshouUnit[],
  sections: Set<string>,
  method: PoolMethod,
  record: ProblemRecord,
  today: string,
): AnshouUnit[] {
  return units.filter((u) => sections.has(sectionKey(u.chapter, u.section)) && matchesMethod(record, u.id, method, today))
}

// 復習期限の来た問題をモードごとに分ける。穴埋めは数字だけの id、暗唱は "anshou:" で始まる id、
// 過去問は試験ID（examIdOf）が過去問の一覧にある id
export function splitDueIds(dueIds: string[], isExamQuestion: (id: string) => boolean) {
  return {
    anaume: dueIds.filter((id) => /^\d+$/.test(id)),
    kakomon: dueIds.filter((id) => isExamQuestion(id)),
    anshou: dueIds.filter((id) => id.startsWith('anshou:')),
  }
}

export function pickRandom<T>(pool: T[], size: number): T[] {
  return shuffled(pool).slice(0, size)
}

// 本番形式：1つの試験を問題番号順に全問
export function inExamOrder(questions: KakomonQuestion[]): KakomonQuestion[] {
  return [...questions].sort((a, b) => a.number - b.number)
}

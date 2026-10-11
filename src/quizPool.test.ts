import { describe, expect, it } from 'vitest'
import { anaumePool, inExamOrder, pickRandom, sectionKey } from './quizPool'
import type { AnaumeQuestion, KakomonQuestion, ProblemRecord } from './types'

const q = (id: number, chapter: number, section: number): AnaumeQuestion => ({ id, chapter, section, text: '' })
const QUESTIONS = [q(1, 8, 4), q(2, 8, 4), q(3, 8, 5), q(4, 4, 0), q(5, 1, 1)]
const TODAY = '2026-10-12'
const RECORD: ProblemRecord = {
  '1': { box: 1, dueDate: '2026-10-12', lastResult: true, ts: 0 },
  '2': { box: 2, dueDate: '2026-10-20', lastResult: true, ts: 0 },
}

describe('anaumePool', () => {
  it('節を1つだけ選ぶと、その節の問題だけになる', () => {
    const pool = anaumePool(QUESTIONS, new Set([sectionKey(8, 4)]), 'all', RECORD, TODAY)
    expect(pool.map((x) => x.id)).toEqual([1, 2])
  })

  it('節のない章は section 0 で選べる', () => {
    const pool = anaumePool(QUESTIONS, new Set(['4-0']), 'all', RECORD, TODAY)
    expect(pool.map((x) => x.id)).toEqual([4])
  })

  it('要復習のみ：記録があり期限が来た問題だけ（未学習は含まない）', () => {
    const all = new Set(QUESTIONS.map((x) => sectionKey(x.chapter, x.section)))
    expect(anaumePool(QUESTIONS, all, 'due', RECORD, TODAY).map((x) => x.id)).toEqual([1])
  })

  it('未学習のみ：記録がない問題だけ', () => {
    const all = new Set(QUESTIONS.map((x) => sectionKey(x.chapter, x.section)))
    expect(anaumePool(QUESTIONS, all, 'new', RECORD, TODAY).map((x) => x.id)).toEqual([3, 4, 5])
  })
})

describe('pickRandom / inExamOrder', () => {
  it('問題数の上限で切る', () => {
    expect(pickRandom(QUESTIONS, 3)).toHaveLength(3)
    expect(pickRandom(QUESTIONS, 20)).toHaveLength(5)
  })

  it('本番形式は問題番号順', () => {
    const k = (number: number) => ({ id: `R07_kanteishi_${number}`, number, instruction: '', choices: [], answer: '1' }) as KakomonQuestion
    expect(inExamOrder([k(3), k(1), k(2)]).map((x) => x.number)).toEqual([1, 2, 3])
  })
})

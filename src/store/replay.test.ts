import { describe, expect, it } from 'vitest'
import { buildHabit, buildKakomonHistory, buildProblemRecord } from './replay'
import type { Answer, LegacyHabit } from './types'

const at = (date: string, hour = 10) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

let n = 0
function ans(question_id: string, result: 0 | 2, answered_at: number, extra: Partial<Answer> = {}): Answer {
  return {
    id: `a${n++}`,
    question_id,
    mode: 'anaume',
    result,
    choice: null,
    session_id: null,
    answered_at,
    device: 'd1',
    payload: null,
    synced: 0,
    ...extra,
  }
}

describe('buildProblemRecord', () => {
  it('ログを時刻順に再生する（配列の順序に依存しない）', () => {
    const log = [ans('1', 2, at('2026-10-13')), ans('1', 2, at('2026-10-12'))]
    expect(buildProblemRecord(log)['1']).toMatchObject({ box: 2, dueDate: '2026-10-16' })
  })

  it('不正解でボックス0に戻る', () => {
    const log = [ans('1', 2, at('2026-10-12')), ans('1', 0, at('2026-10-13'))]
    expect(buildProblemRecord(log)['1']).toMatchObject({ box: 0, dueDate: '2026-10-13', lastResult: false })
  })

  it('snapshot を初期値にして、その後のログを積み上げる', () => {
    const snap = { box: 3, dueDate: '2026-10-15', lastResult: true, ts: at('2026-10-08') }
    const log = [
      ans('1', 2, at('2026-10-15')),
      ans('1', 2, snap.ts, { mode: 'snapshot', payload: JSON.stringify(snap) }),
    ]
    expect(buildProblemRecord(log)['1']).toMatchObject({ box: 4, dueDate: '2026-10-29' })
  })

  it('計算ドリルは復習の対象にしない（今日の解答数には数える）', () => {
    const log = [ans('drill:dcf', 0, at('2026-10-12'), { mode: 'drill' })]
    expect(buildProblemRecord(log)).toEqual({})
    expect(buildHabit(log, null, '2026-10-12').todayCount).toBe(1)
  })
})

describe('buildHabit', () => {
  const legacy: LegacyHabit = {
    lastStudyDate: '2026-10-11',
    currentStreak: 3,
    longestStreak: 7,
    todayDate: '2026-10-11',
    todayCount: 4,
  }

  it('移行前の連続日数に、ログの日付をつなげる', () => {
    const log = [ans('1', 2, at('2026-10-12')), ans('2', 0, at('2026-10-12', 23))]
    expect(buildHabit(log, legacy, '2026-10-12')).toEqual({
      currentStreak: 4,
      longestStreak: 7,
      todayCount: 2,
    })
  })

  it('今日まだ解いていなくても、昨日までの連続は残る。2日空くと0', () => {
    expect(buildHabit([], legacy, '2026-10-12').currentStreak).toBe(3)
    expect(buildHabit([], legacy, '2026-10-13').currentStreak).toBe(0)
  })

  it('移行前の今日の解答数を足す', () => {
    const log = [ans('1', 2, at('2026-10-11', 20))]
    expect(buildHabit(log, legacy, '2026-10-11').todayCount).toBe(5)
  })

  it('最長記録はログからも求める', () => {
    const log = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => ans('1', 2, at(d)))
    expect(buildHabit(log, null, '2026-10-12')).toEqual({ currentStreak: 0, longestStreak: 3, todayCount: 0 })
  })

  it('snapshot は学習日に数えない', () => {
    const log = [ans('1', 2, at('2026-10-12'), { mode: 'snapshot', payload: '{}' })]
    expect(buildHabit(log, null, '2026-10-12')).toEqual({ currentStreak: 0, longestStreak: 0, todayCount: 0 })
  })
})

describe('buildKakomonHistory', () => {
  it('セットごとに正答数をまとめ、新しい順に返す', () => {
    const k = (id: string, result: 0 | 2, t: number, s: string) =>
      ans(id, result, t, { mode: 'kakomon', session_id: s })
    const log = [
      k('R07_kanteishi_001', 2, at('2026-10-10'), 's1'),
      k('R06_gyosei_012', 0, at('2026-10-10', 11), 's1'),
      k('R07_kanteishi_002', 2, at('2026-10-12'), 's2'),
      ans('5', 2, at('2026-10-12')),
    ]
    const history = buildKakomonHistory(log)
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ examIds: ['R07_kanteishi'], total: 1, correct: 1 })
    expect(history[1]).toMatchObject({ examIds: ['R07_kanteishi', 'R06_gyosei'], total: 2, correct: 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { isDue, nextEntry } from './leitner'

const NOW = new Date(2026, 9, 12, 10, 0).getTime()

describe('leitner', () => {
  it('正解するとボックスが上がり、間隔が 1/3/7/14/30 日に伸びる', () => {
    const expected = ['2026-10-13', '2026-10-15', '2026-10-19', '2026-10-26', '2026-11-11']
    let entry = undefined
    for (let i = 0; i < 5; i++) {
      entry = nextEntry(entry, true, NOW)
      expect(entry.box).toBe(i + 1)
      expect(entry.dueDate).toBe(expected[i])
    }
  })

  it('ボックスは5で止まる', () => {
    const entry = nextEntry({ box: 5, dueDate: '2026-10-01', lastResult: true, ts: 0 }, true, NOW)
    expect(entry.box).toBe(5)
    expect(entry.dueDate).toBe('2026-11-11')
  })

  it('不正解でボックス0・当日が期限になる', () => {
    const entry = nextEntry({ box: 3, dueDate: '2026-10-20', lastResult: true, ts: 0 }, false, NOW)
    expect(entry).toEqual({ box: 0, dueDate: '2026-10-12', lastResult: false, ts: NOW })
  })

  it('記録がない問題と期限が来た問題は出題対象', () => {
    expect(isDue(undefined, '2026-10-12')).toBe(true)
    const entry = { box: 1, dueDate: '2026-10-13', lastResult: true, ts: 0 }
    expect(isDue(entry, '2026-10-12')).toBe(false)
    expect(isDue(entry, '2026-10-13')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { EMPTY_HABIT_RECORD, recordStudy } from './habit'

describe('habit', () => {
  it('同じ日は解答数だけ増える', () => {
    const a = recordStudy(EMPTY_HABIT_RECORD, '2026-10-12')
    const b = recordStudy(a, '2026-10-12')
    expect(b).toMatchObject({ currentStreak: 1, todayCount: 2, lastStudyDate: '2026-10-12' })
  })

  it('翌日に続けると連続日数が伸び、空くと1に戻る', () => {
    const day1 = recordStudy(EMPTY_HABIT_RECORD, '2026-10-12')
    const day2 = recordStudy(day1, '2026-10-13')
    expect(day2).toMatchObject({ currentStreak: 2, longestStreak: 2, todayCount: 1 })
    const day4 = recordStudy(day2, '2026-10-15')
    expect(day4).toMatchObject({ currentStreak: 1, longestStreak: 2 })
  })
})

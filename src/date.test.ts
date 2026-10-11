import { describe, expect, it } from 'vitest'
import { addDays, dateStrOf } from './date'

describe('date', () => {
  it('日本時間の0〜9時も当日の日付になる', () => {
    // 2026-10-12 08:30 JST = 2026-10-11 23:30 UTC
    expect(dateStrOf(Date.UTC(2026, 9, 11, 23, 30))).toBe('2026-10-12')
  })

  it('月末・年末をまたいで日付を足し引きできる', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })
})

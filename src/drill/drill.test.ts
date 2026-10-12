import { describe, expect, it } from 'vitest'
import { DRILL_TYPES, drillTypeOf } from './drillTypes'
import { isCorrect, parseNumber } from './judge'
import { range, seededRng } from './random'
import type { DrillProblem } from './types'

const num = (s: string) => Number(s.replace(/[^\d.]/g, ''))
const cond = (p: DrillProblem, label: string) => {
  const c = p.conditions.find((x) => x.label === label)
  if (!c) throw new Error(`条件がない: ${label}`)
  return c.value
}

describe('range', () => {
  it('min〜max の step 刻みの値だけを返す', () => {
    const rng = seededRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = range(rng, 0.035, 0.065, 0.001)
      expect(v).toBeGreaterThanOrEqual(0.035)
      expect(v).toBeLessThanOrEqual(0.065)
      expect(Math.round(v * 1000)).toBeCloseTo(v * 1000, 9)
    }
  })
})

describe.each(DRILL_TYPES.map((t) => [t.label, t] as const))('%s', (_label, type) => {
  it('100回作っても、答えが正の有限値で、計算過程の最後に答えが出る', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = type.generate(seededRng(seed))
      expect(p.typeId).toBe(type.id)
      expect(Number.isFinite(p.answer)).toBe(true)
      expect(p.answer).toBeGreaterThan(0)
      expect(Number.isInteger(p.answer)).toBe(true)
      expect(p.steps.at(-1)!.expr).toContain(`${p.answer.toLocaleString('ja-JP')}${p.unit}`)
      expect(isCorrect(p.answer, p)).toBe(true)
    }
  })

  it('シードが違えば条件の数値が変わる', () => {
    const shown = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify(type.generate(seededRng(s)).conditions)))
    expect(shown.size).toBeGreaterThan(15)
  })

  it('同じシードなら同じ問題になる', () => {
    expect(type.generate(seededRng(42))).toEqual(type.generate(seededRng(42)))
  })
})

// 表示された条件から、教科書どおりの式で計算し直して答えと突き合わせる
describe('答えが手法の式どおりになっている', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i)

  it('直接還元法：(総収益 − 総費用) ÷ 還元利回り', () => {
    for (const s of seeds) {
      const p = drillTypeOf('direct-cap').generate(seededRng(s))
      const noi = num(cond(p, '総収益（年額）')) - num(cond(p, '総費用（年額）'))
      expect(p.answer).toBe(Math.round(noi / (num(cond(p, '還元利回り')) / 100)))
    }
  })

  it('DCF法：5年間の純収益と復帰価格の現在価値の合計', () => {
    for (const s of seeds) {
      const p = drillTypeOf('dcf').generate(seededRng(s))
      const nois = cond(p, '純収益（1〜5年目）').split(' / ').map(num)
      const y = num(cond(p, '割引率')) / 100
      const pr = (num(cond(p, '6年目の純収益')) / (num(cond(p, '最終還元利回り')) / 100)) * (1 - num(cond(p, '売却費用')) / 100)
      const expected = nois.reduce((sum, a, i) => sum + a / (1 + y) ** (i + 1), 0) + pr / (1 + y) ** 5
      expect(p.answer).toBe(Math.round(expected))
    }
  })

  it('DCF法：例題（1,000万円が5年続き、6年目1,000万円、割引率5%、最終還元利回り5%、売却費用なし）は2億円', () => {
    // 毎年同じ純収益なら、割引率＝最終還元利回りのとき a/Y に一致する（売却費用0の場合）
    const y = 0.05
    const value = [1, 2, 3, 4, 5].reduce((s, k) => s + 1000 / (1 + y) ** k, 0) + 1000 / 0.05 / (1 + y) ** 5
    expect(Math.round(value)).toBe(20000)
  })

  it('原価法：土地 ＋ 再調達原価 × (1 − 経過年数 ÷ 耐用年数)', () => {
    for (const s of seeds) {
      const p = drillTypeOf('cost').generate(seededRng(s))
      const c = num(cond(p, '建物の再調達原価（単価）')) * num(cond(p, '建物の延床面積'))
      const building = c * (1 - num(cond(p, '経過年数')) / num(cond(p, '経済的耐用年数')))
      expect(p.answer).toBe(Math.round(num(cond(p, '土地の価格')) + building))
    }
  })

  it('取引事例比較法：答えは許容誤差 0.5% 以内で、誤差の外は不正解', () => {
    const p = drillTypeOf('comparison').generate(seededRng(7))
    expect(isCorrect(Math.round(p.answer * 1.004), p)).toBe(true)
    expect(isCorrect(Math.round(p.answer * 1.01), p)).toBe(false)
  })

  it('差額配分法：実際実質賃料 ＋ 差額 × 1/2', () => {
    for (const s of seeds) {
      const p = drillTypeOf('sabun').generate(seededRng(s))
      const normal = num(cond(p, '価格時点の正常実質賃料（月額）'))
      const actual = num(cond(p, '実際実質賃料（月額）'))
      expect(p.answer).toBe(actual + (normal - actual) / 2)
    }
  })

  it('利回り法：価格時点の基礎価格 × 継続賃料利回り ＋ 必要諸経費等', () => {
    for (const s of seeds) {
      const p = drillTypeOf('rimawari').generate(seededRng(s))
      const rate = (num(cond(p, '直近合意時点の純賃料（月額）')) * 12) / (num(cond(p, '直近合意時点の基礎価格')) * 10000)
      const net = (num(cond(p, '価格時点の基礎価格')) * 10000 * rate) / 12
      expect(p.answer).toBe(Math.round(net + num(cond(p, '価格時点の必要諸経費等（月額）'))))
    }
  })

  it('スライド法：純賃料 × 変動率 ＋ 必要諸経費等', () => {
    for (const s of seeds) {
      const p = drillTypeOf('slide').generate(seededRng(s))
      const net = num(cond(p, '直近合意時点の純賃料（月額）')) * num(cond(p, '変動率（直近合意時点〜価格時点）'))
      expect(p.answer).toBe(Math.round(net + num(cond(p, '価格時点の必要諸経費等（月額）'))))
    }
  })
})

describe('parseNumber', () => {
  it.each([
    ['12345', 12345],
    ['12,345', 12345],
    ['１２，３４５', 12345],
    [' 1,234.5 ', 1234.5],
    ['１２３４．５', 1234.5],
  ])('%s → %d', (input, expected) => {
    expect(parseNumber(input)).toBe(expected)
  })

  it.each(['', '  ', 'abc', '12a', '-5', '1.2.3'])('「%s」は読めない（null）', (input) => {
    expect(parseNumber(input)).toBeNull()
  })
})

describe('isCorrect', () => {
  const base: DrillProblem = {
    typeId: 't',
    conditions: [],
    prompt: '',
    unit: '万円',
    answer: 10000,
    tolerance: { abs: 1 },
    steps: [],
    kijunRef: { chapter: '7' },
  }

  it('abs：差が許容誤差ちょうどまでは正解', () => {
    expect(isCorrect(10001, base)).toBe(true)
    expect(isCorrect(9999, base)).toBe(true)
    expect(isCorrect(10002, base)).toBe(false)
  })

  it('rel：正解に対する割合で判定する', () => {
    const p = { ...base, tolerance: { rel: 0.002 } }
    expect(isCorrect(10020, p)).toBe(true)
    expect(isCorrect(9980, p)).toBe(true)
    expect(isCorrect(10021, p)).toBe(false)
  })
})

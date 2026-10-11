import { describe, expect, it } from 'vitest'
import { kijunRefLabel, refOf } from './kijunRef'
import type { KijunData } from './types'

const KIJUN: KijunData = {
  '4': { title: '総論 第４章 不動産の価格に関する諸原則', intro: '…', sections: {} },
  '8': { title: '総論 第８章 鑑定評価の手順', intro: '', sections: { '4': { title: '第４節 対象不動産の確認', text: '…' } } },
  '13': { title: '附則', intro: '…', sections: {} },
}

describe('kijunRef', () => {
  it('章・節の短い表示名を作る', () => {
    expect(kijunRefLabel(KIJUN, { chapter: '8', section: '4' })).toBe('総論 第８章 第４節')
    expect(kijunRefLabel(KIJUN, { chapter: '4' })).toBe('総論 第４章')
    expect(kijunRefLabel(KIJUN, { chapter: '13' })).toBe('附則')
  })

  it('存在しない章・節は null', () => {
    expect(kijunRefLabel(KIJUN, { chapter: '99' })).toBeNull()
    expect(kijunRefLabel(KIJUN, { chapter: '8', section: '9' })).toBeNull()
  })

  it('穴埋めの section 0 は章だけを指す', () => {
    expect(refOf(4, 0)).toEqual({ chapter: '4' })
    expect(refOf(8, 4)).toEqual({ chapter: '8', section: '4' })
  })
})

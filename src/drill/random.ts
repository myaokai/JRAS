import type { Rng } from './types'

// シード付きの乱数（mulberry32）。テストで同じ問題を作り直すために使う
export function seededRng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// min〜max の step 刻みの値。小数の刻みでも誤差が出ないよう整数で数えてから戻す
export function range(rng: Rng, min: number, max: number, step: number): number {
  const n = Math.round((max - min) / step)
  const i = Math.floor(rng() * (n + 1))
  return Number((min + i * step).toFixed(6))
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

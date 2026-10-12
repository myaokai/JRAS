import type { DrillProblem } from './types'

// 入力された数値を読む。全角数字・カンマ・空白を許す。読めなければ null
export function parseNumber(input: string): number | null {
  const s = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[,，、\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

export function isCorrect(value: number, problem: DrillProblem): boolean {
  const { abs = 0, rel = 0 } = problem.tolerance
  // 浮動小数の誤差で境界の値を落とさないよう、わずかに余裕を持たせる
  const allowed = Math.max(abs, Math.abs(problem.answer) * rel) + 1e-9
  return Math.abs(value - problem.answer) <= allowed
}

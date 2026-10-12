import type { KijunRef } from '../types'

// 計算ドリル（FR-23）の1問。数値は生成のたびに変わる
export interface DrillProblem {
  typeId: string
  // 与えられた条件（表示用の文字列）
  conditions: { label: string; value: string }[]
  // 求めるもの（例「収益価格を求めなさい」）
  prompt: string
  // 入力欄の単位（例「万円」）
  unit: string
  // 正解。表示単位で四捨五入した値
  answer: number
  // 許容誤差。abs は表示単位での差、rel は正解に対する割合。大きい方まで正解にする
  tolerance: { abs?: number; rel?: number }
  // 計算過程。最後の行が答えになる
  steps: { label: string; expr: string }[]
  kijunRef: KijunRef
}

export type Rng = () => number

export interface DrillType {
  id: string
  label: string
  generate: (rng: Rng) => DrillProblem
}

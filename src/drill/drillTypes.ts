import type { DrillProblem, DrillType, Rng } from './types'
import { pick, range } from './random'

// 計算ドリルの問題の型。数値はきりのよい値で作り、答えは表示単位で四捨五入する

const PRICE_REF = { chapter: '7', section: '1' }
const RENT_REF = { chapter: '7', section: '2' }

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function roundTo(n: number, digits = 0): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

// 「= 1,800」または、端数を丸めたときは「≒ 1,800.3」
function eq(n: number, digits = 0): string {
  return `${roundTo(n, digits) === n ? '=' : '≒'} ${fmt(n, digits)}`
}

function pct(r: number, digits = 1): string {
  return `${(r * 100).toFixed(digits)}%`
}

const signed = (n: number) => `${n >= 0 ? '＋' : '−'}${fmt(Math.abs(n), 1)}`

const directCap: DrillType = {
  id: 'direct-cap',
  label: '直接還元法',
  generate(rng: Rng): DrillProblem {
    const gross = range(rng, 1200, 6000, 10)
    const expenses = Math.round((gross * range(rng, 0.15, 0.35, 0.01)) / 10) * 10
    const noi = gross - expenses
    const r = range(rng, 0.035, 0.065, 0.001)
    const value = noi / r
    return {
      typeId: 'direct-cap',
      conditions: [
        { label: '総収益（年額）', value: `${fmt(gross)}万円` },
        { label: '総費用（年額）', value: `${fmt(expenses)}万円` },
        { label: '還元利回り', value: pct(r) },
      ],
      prompt: '直接還元法による収益価格を求めなさい。',
      unit: '万円',
      answer: Math.round(value),
      tolerance: { abs: 1 },
      steps: [
        { label: '純収益', expr: `総収益 − 総費用 = ${fmt(gross)} − ${fmt(expenses)} = ${fmt(noi)}万円` },
        { label: '収益価格', expr: `純収益 ÷ 還元利回り = ${fmt(noi)} ÷ ${pct(r)} ${eq(value)}万円` },
      ],
      kijunRef: PRICE_REF,
    }
  },
}

const DCF_YEARS = 5

const dcf: DrillType = {
  id: 'dcf',
  label: 'DCF法',
  generate(rng: Rng): DrillProblem {
    const first = range(rng, 1000, 5000, 10)
    const growth = range(rng, -20, 40, 10)
    // 1〜5年目と、復帰価格に使う6年目の純収益
    const nois = Array.from({ length: DCF_YEARS + 1 }, (_, i) => first + growth * i)
    const y = range(rng, 0.04, 0.06, 0.001)
    const terminal = range(rng, 0.045, 0.065, 0.001)
    const sellCost = range(rng, 0.01, 0.03, 0.005)

    const pvs = nois.slice(0, DCF_YEARS).map((a, i) => a / (1 + y) ** (i + 1))
    const pvSum = pvs.reduce((s, v) => s + v, 0)
    const reversion = (nois[DCF_YEARS] / terminal) * (1 - sellCost)
    const pvReversion = reversion / (1 + y) ** DCF_YEARS
    const value = pvSum + pvReversion
    const base = fmt(1 + y, 3)

    return {
      typeId: 'dcf',
      conditions: [
        { label: '純収益（1〜5年目）', value: `${nois.slice(0, DCF_YEARS).map((a) => fmt(a)).join(' / ')}万円` },
        { label: '6年目の純収益', value: `${fmt(nois[DCF_YEARS])}万円` },
        { label: '割引率', value: pct(y) },
        { label: '最終還元利回り', value: pct(terminal) },
        { label: '売却費用', value: `復帰価格の${pct(sellCost)}` },
      ],
      prompt: '保有期間を5年とし、DCF法による収益価格を求めなさい（復帰価格は6年目の純収益を最終還元利回りで還元し、売却費用を控除する）。',
      unit: '万円',
      answer: Math.round(value),
      // 複利現価率を途中で丸めても正解にする
      tolerance: { rel: 0.002 },
      steps: [
        ...pvs.map((pv, i) => ({
          label: `${i + 1}年目の現在価値`,
          expr: `${fmt(nois[i])} ÷ ${base}${i === 0 ? '' : `^${i + 1}`} ${eq(pv, 1)}万円`,
        })),
        { label: '純収益の現在価値の合計', expr: `${pvs.map((v) => fmt(v, 1)).join(' ＋ ')} ${eq(pvSum, 1)}万円` },
        {
          label: '復帰価格',
          expr: `${fmt(nois[DCF_YEARS])} ÷ ${pct(terminal)} × (1 − ${pct(sellCost)}) ${eq(reversion, 1)}万円`,
        },
        { label: '復帰価格の現在価値', expr: `${fmt(reversion, 1)} ÷ ${base}^${DCF_YEARS} ${eq(pvReversion, 1)}万円` },
        { label: '収益価格', expr: `${fmt(pvSum, 1)} ＋ ${fmt(pvReversion, 1)} ${eq(value)}万円` },
      ],
      kijunRef: PRICE_REF,
    }
  },
}

const cost: DrillType = {
  id: 'cost',
  label: '原価法',
  generate(rng: Rng): DrillProblem {
    const land = range(rng, 3000, 20000, 100)
    const unitCost = range(rng, 15, 40, 0.5)
    const area = range(rng, 200, 2000, 10)
    const life = pick(rng, [30, 35, 40, 45, 50])
    const age = range(rng, 1, life - 5, 1)
    const replacement = unitCost * area
    const depreciation = (replacement * age) / life
    const building = replacement - depreciation
    const value = land + building
    return {
      typeId: 'cost',
      conditions: [
        { label: '土地の価格', value: `${fmt(land)}万円` },
        { label: '建物の再調達原価（単価）', value: `${fmt(unitCost, 1)}万円/㎡` },
        { label: '建物の延床面積', value: `${fmt(area)}㎡` },
        { label: '経済的耐用年数', value: `${life}年` },
        { label: '経過年数', value: `${age}年` },
        { label: '減価修正', value: '耐用年数に基づく方法（定額法）、残価率0' },
      ],
      prompt: '建物及びその敷地の積算価格（土地の価格と建物の積算価格の合計）を求めなさい。',
      unit: '万円',
      answer: Math.round(value),
      tolerance: { abs: 1 },
      steps: [
        { label: '建物の再調達原価', expr: `${fmt(unitCost, 1)} × ${fmt(area)} = ${fmt(replacement)}万円` },
        { label: '減価額', expr: `${fmt(replacement)} × ${age} ÷ ${life} ${eq(depreciation, 1)}万円` },
        { label: '建物の積算価格', expr: `${fmt(replacement)} − ${fmt(depreciation, 1)} ${eq(building, 1)}万円` },
        { label: '積算価格', expr: `${fmt(land)} ＋ ${fmt(building, 1)} ${eq(value)}万円` },
      ],
      kijunRef: PRICE_REF,
    }
  },
}

const comparison: DrillType = {
  id: 'comparison',
  label: '取引事例比較法',
  generate(rng: Rng): DrillProblem {
    const unitPrice = range(rng, 150000, 800000, 1000)
    const situation = pick(rng, [-10, -5, 5, 10, 15])
    const monthly = pick(rng, [-0.3, -0.2, 0.1, 0.2, 0.3, 0.4, 0.5])
    const months = range(rng, 3, 18, 1)
    const time = roundTo(100 + monthly * months, 1)
    const caseIndividual = range(rng, -10, 10, 1)
    const region = range(rng, -10, 10, 1)
    const subjectIndividual = range(rng, -10, 10, 1)
    const area = range(rng, 100, 1000, 5)

    const factors = [
      100 / (100 + situation),
      time / 100,
      100 / (100 + caseIndividual),
      100 / (100 + region),
      (100 + subjectIndividual) / 100,
    ]
    const unit = factors.reduce((v, f) => v * f, unitPrice)
    const value = (unit * area) / 10000
    const situationText = situation > 0 ? `正常価格より${situation}%高い（買い進み）` : `正常価格より${-situation}%低い（売り急ぎ）`

    return {
      typeId: 'comparison',
      conditions: [
        { label: '事例の取引単価', value: `${fmt(unitPrice)}円/㎡` },
        { label: '事情', value: situationText },
        { label: '時点修正', value: `取引時点から価格時点まで${months}か月、月率${signed(monthly)}%（単利）` },
        { label: '事例の個別的要因', value: `標準的な画地を100として${100 + caseIndividual}` },
        { label: '地域要因', value: `対象地域を100として事例地域は${100 + region}` },
        { label: '対象地の個別的要因', value: `標準的な画地を100として${100 + subjectIndividual}` },
        { label: '対象地の面積', value: `${fmt(area)}㎡` },
      ],
      prompt: '取引事例比較法による対象地の比準価格を求めなさい。',
      unit: '万円',
      answer: Math.round(value),
      // 比準単価を途中で丸めても正解にする
      tolerance: { rel: 0.005 },
      steps: [
        { label: '事情補正', expr: `100 / ${100 + situation}` },
        { label: '時点修正', expr: `(100 ${signed(monthly)} × ${months}) / 100 = ${fmt(time, 1)} / 100` },
        { label: '標準化補正', expr: `100 / ${100 + caseIndividual}` },
        { label: '地域要因の比較', expr: `100 / ${100 + region}` },
        { label: '個別的要因の比較', expr: `${100 + subjectIndividual} / 100` },
        {
          label: '比準単価',
          expr: `${fmt(unitPrice)} × 100/${100 + situation} × ${fmt(time, 1)}/100 × 100/${100 + caseIndividual} × 100/${100 + region} × ${100 + subjectIndividual}/100 ${eq(unit)}円/㎡`,
        },
        { label: '比準価格', expr: `${fmt(unit)} × ${fmt(area)}㎡ ${eq(value)}万円` },
      ],
      kijunRef: PRICE_REF,
    }
  },
}

const sabun: DrillType = {
  id: 'sabun',
  label: '差額配分法',
  generate(rng: Rng): DrillProblem {
    const normal = range(rng, 300000, 2000000, 10000)
    // 増額・減額のどちらの場面も出す
    const gap = range(rng, 0.05, 0.25, 0.01) * pick(rng, [1, -1])
    const actual = Math.round((normal * (1 - gap)) / 1000) * 1000
    const diff = normal - actual
    const share = diff / 2
    const value = actual + share
    return {
      typeId: 'sabun',
      conditions: [
        { label: '価格時点の正常実質賃料（月額）', value: `${fmt(normal)}円` },
        { label: '実際実質賃料（月額）', value: `${fmt(actual)}円` },
        { label: '差額の配分', value: '2分の1法（賃貸人に帰属する部分を1/2とする）' },
      ],
      prompt: '差額配分法による試算賃料（実質賃料・月額）を求めなさい。',
      unit: '円',
      answer: Math.round(value),
      tolerance: { abs: 100 },
      steps: [
        { label: '差額', expr: `正常実質賃料 − 実際実質賃料 = ${fmt(normal)} − ${fmt(actual)} = ${fmt(diff)}円` },
        { label: '賃貸人に帰属する部分', expr: `${fmt(diff)} × 1/2 = ${fmt(share)}円` },
        { label: '試算賃料', expr: `${fmt(actual)} ＋ ${share < 0 ? `(${fmt(share)})` : fmt(share)} = ${fmt(value)}円` },
      ],
      kijunRef: RENT_REF,
    }
  },
}

const rimawari: DrillType = {
  id: 'rimawari',
  label: '利回り法',
  generate(rng: Rng): DrillProblem {
    const base0 = range(rng, 10000, 50000, 100)
    const net0 = Math.round((base0 * 10000 * range(rng, 0.02, 0.05, 0.001)) / 12 / 1000) * 1000
    const base1 = Math.round((base0 * (1 + range(rng, -0.1, 0.2, 0.01))) / 100) * 100
    const expenses = range(rng, 50000, 300000, 1000)
    const yieldRate = (net0 * 12) / (base0 * 10000)
    const net1 = (base1 * 10000 * yieldRate) / 12
    const value = net1 + expenses
    return {
      typeId: 'rimawari',
      conditions: [
        { label: '直近合意時点の基礎価格', value: `${fmt(base0)}万円` },
        { label: '直近合意時点の純賃料（月額）', value: `${fmt(net0)}円` },
        { label: '価格時点の基礎価格', value: `${fmt(base1)}万円` },
        { label: '価格時点の必要諸経費等（月額）', value: `${fmt(expenses)}円` },
      ],
      prompt: '利回り法による試算賃料（実質賃料・月額）を求めなさい。継続賃料利回りは直近合意時点の純賃料と基礎価格から求める。',
      unit: '円',
      answer: Math.round(value),
      // 継続賃料利回りを途中で丸めても正解にする
      tolerance: { rel: 0.001 },
      steps: [
        {
          label: '継続賃料利回り',
          expr: `${fmt(net0)} × 12 ÷ ${fmt(base0 * 10000)} ${eq(yieldRate * 100, 3)}%`,
        },
        { label: '純賃料（月額）', expr: `${fmt(base1 * 10000)} × ${fmt(yieldRate * 100, 3)}% ÷ 12 ${eq(net1)}円` },
        { label: '試算賃料', expr: `${fmt(net1)} ＋ ${fmt(expenses)} ${eq(value)}円` },
      ],
      kijunRef: RENT_REF,
    }
  },
}

const slide: DrillType = {
  id: 'slide',
  label: 'スライド法',
  generate(rng: Rng): DrillProblem {
    const net0 = range(rng, 300000, 1500000, 1000)
    const rate = range(rng, 0.95, 1.1, 0.005)
    const expenses = range(rng, 50000, 300000, 1000)
    const net1 = net0 * rate
    const value = net1 + expenses
    return {
      typeId: 'slide',
      conditions: [
        { label: '直近合意時点の純賃料（月額）', value: `${fmt(net0)}円` },
        { label: '変動率（直近合意時点〜価格時点）', value: fmt(rate, 3) },
        { label: '価格時点の必要諸経費等（月額）', value: `${fmt(expenses)}円` },
      ],
      prompt: 'スライド法による試算賃料（実質賃料・月額）を求めなさい。',
      unit: '円',
      answer: Math.round(value),
      tolerance: { abs: 100 },
      steps: [
        { label: '純賃料（月額）', expr: `${fmt(net0)} × ${fmt(rate, 3)} ${eq(net1)}円` },
        { label: '試算賃料', expr: `${fmt(net1)} ＋ ${fmt(expenses)} ${eq(value)}円` },
      ],
      kijunRef: RENT_REF,
    }
  },
}

export const DRILL_TYPES: DrillType[] = [directCap, dcf, cost, comparison, sabun, rimawari, slide]

export function drillTypeOf(id: string): DrillType {
  return DRILL_TYPES.find((t) => t.id === id) ?? DRILL_TYPES[0]
}

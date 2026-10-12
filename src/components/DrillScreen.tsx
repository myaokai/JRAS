import type { KijunData, KijunRef } from '../types'
import type { Navigate } from '../route'
import { DRILL_TYPES, drillTypeOf } from '../drill/drillTypes'
import { isCorrect, parseNumber } from '../drill/judge'
import type { DrillProblem } from '../drill/types'
import { AppShell } from './layout/AppShell'
import { KijunLink } from './QuizScreen'
import { Card } from './ui'

// 計算ドリルの状態。App が持つので、基準リンクで教科書を開いて戻っても残る
export interface DrillState {
  problem: DrillProblem
  input: string
  // 答え合わせの結果。gaveUp は「わからない」で答えを見たとき
  checked: { correct: boolean; gaveUp: boolean } | null
  // 表示済みの計算過程の行数
  shownSteps: number
  sessionId: string
}

export function newDrill(typeId: string, sessionId: string = crypto.randomUUID()): DrillState {
  return { problem: drillTypeOf(typeId).generate(Math.random), input: '', checked: null, shownSteps: 0, sessionId }
}

interface Props {
  navigate: Navigate
  kijunData: KijunData
  state: DrillState
  onChange: (state: DrillState) => void
  onAnswered: (typeId: string, correct: boolean, input: string | null) => void
}

const fmt = (n: number) => n.toLocaleString('ja-JP')

function toleranceText({ tolerance, unit }: DrillProblem): string {
  if (tolerance.rel) return `±${tolerance.rel * 100}%`
  return `±${fmt(tolerance.abs ?? 0)}${unit}`
}

export function DrillScreen({ navigate, kijunData, state, onChange, onAnswered }: Props) {
  const { problem, input, checked, shownSteps } = state
  const value = parseNumber(input)

  const check = (gaveUp: boolean) => {
    if (checked) return
    const correct = !gaveUp && value !== null && isCorrect(value, problem)
    // 「わからない」のときは計算過程を最初の1行から見せる
    onChange({ ...state, checked: { correct, gaveUp }, shownSteps: Math.max(shownSteps, 1) })
    onAnswered(problem.typeId, correct, gaveUp ? null : input.trim())
  }

  const openKijun = (ref: KijunRef) =>
    navigate({ name: 'textbook', chapterId: ref.chapter, sectionId: ref.section, fromQuiz: true })

  const footer = checked ? (
    <button id="drillNext" className="btn-primary btn-block" onClick={() => onChange(newDrill(problem.typeId, state.sessionId))} type="button">
      次の問題
    </button>
  ) : (
    <div className="bottom-bar-row">
      <button id="drillGiveUp" className="btn-secondary" onClick={() => check(true)} type="button">
        わからない
      </button>
      <button id="drillCheck" className="btn-primary drill-check" onClick={() => check(false)} disabled={value === null} type="button">
        答え合わせ
      </button>
    </div>
  )

  return (
    <AppShell title="計算ドリル" onBack={() => navigate({ name: 'study' })} navigate={navigate} screenId="drillScreen" footer={footer}>
      <div className="drill-types" role="radiogroup" aria-label="手法" id="drillTypes">
        {DRILL_TYPES.map((t) => (
          <button
            key={t.id}
            className={`drill-type${t.id === problem.typeId ? ' active' : ''}`}
            role="radio"
            aria-checked={t.id === problem.typeId}
            data-value={t.id}
            onClick={() => t.id !== problem.typeId && onChange(newDrill(t.id, state.sessionId))}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <dl className="drill-conditions" id="drillConditions">
          {problem.conditions.map((c) => (
            <div key={c.label} className="drill-condition">
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
            </div>
          ))}
        </dl>
        <p className="drill-prompt">{problem.prompt}</p>
        <div className="drill-input-row">
          <input
            id="drillInput"
            className="input drill-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="答えを入力"
            aria-label="答え"
            value={input}
            disabled={checked !== null}
            onChange={(e) => onChange({ ...state, input: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && value !== null && check(false)}
          />
          <span className="drill-unit">{problem.unit}</span>
        </div>
      </Card>

      {checked && (
        <>
          <div id="drillFeedback" className={`answer-feedback${checked.correct ? ' correct' : ' wrong'}`}>
            {checked.correct ? '正解' : checked.gaveUp ? '答え' : '不正解'}：{fmt(problem.answer)}
            {problem.unit}（許容誤差 {toleranceText(problem)}）
          </div>
          <div className="explanation" id="drillSteps">
            <div className="explanation-title">計算過程</div>
            <ol className="drill-steps">
              {problem.steps.slice(0, shownSteps).map((s) => (
                <li key={s.label}>
                  <span className="drill-step-label">{s.label}</span>
                  <span className="drill-step-expr">{s.expr}</span>
                </li>
              ))}
            </ol>
            {shownSteps < problem.steps.length && (
              <div className="drill-step-actions">
                <button id="drillNextStep" className="btn-small" onClick={() => onChange({ ...state, shownSteps: shownSteps + 1 })} type="button">
                  次の手順
                </button>
                <button id="drillAllSteps" className="btn-small" onClick={() => onChange({ ...state, shownSteps: problem.steps.length })} type="button">
                  すべて表示
                </button>
              </div>
            )}
            <KijunLink kijunData={kijunData} kijunRef={problem.kijunRef} onOpen={openKijun} />
          </div>
        </>
      )}
    </AppShell>
  )
}

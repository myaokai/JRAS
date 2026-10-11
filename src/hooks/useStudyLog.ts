import { useCallback, useEffect, useMemo, useState } from 'react'
import { addAnswer, getDb, importRecords, initStore, putSetting, type StoreSnapshot } from '../store/store'
import { buildHabit, buildKakomonHistory, buildProblemRecord } from '../store/replay'
import { SETTING_KEYS, type Answer, type AnswerMode, type AnswerResult, type LegacyHabit, type Setting } from '../store/types'
import { createBackup, parseBackup } from '../backup'
import { isDue } from '../leitner'
import { todayStr } from '../date'
import { DAILY_GOAL } from '../habit'

export interface AnswerInput {
  question_id: string
  mode: AnswerMode
  result: AnswerResult
  choice?: string | null
  session_id?: string | null
}

// StrictMode で effect が2回走っても、移行（端末IDの採番を含む）を1回にする
let initPromise: Promise<StoreSnapshot> | null = null

export function useStudyLog() {
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    initPromise ??= getDb().then((db) => initStore(db))
    initPromise
      .then((s) => alive && setSnapshot(s))
      .catch((e) => {
        console.error('学習記録の読み込みに失敗しました', e)
        if (alive) {
          setError('学習記録を読み込めませんでした。この端末では記録が保存されません。')
          setSnapshot({ answers: [], settings: {} })
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const answers = useMemo(() => snapshot?.answers ?? [], [snapshot])
  const settings = useMemo(() => snapshot?.settings ?? {}, [snapshot])
  const device = (settings[SETTING_KEYS.deviceId]?.value as string | undefined) ?? 'unknown'

  const recordAnswer = useCallback(
    (input: AnswerInput) => {
      const answer: Answer = {
        id: crypto.randomUUID(),
        question_id: input.question_id,
        mode: input.mode,
        result: input.result,
        choice: input.choice ?? null,
        session_id: input.session_id ?? null,
        answered_at: Date.now(),
        device,
        payload: null,
        synced: 0,
      }
      setSnapshot((prev) => prev && { ...prev, answers: [...prev.answers, answer] })
      getDb()
        .then((db) => addAnswer(db, answer))
        .catch((e) => console.error('解答の保存に失敗しました', e))
    },
    [device],
  )

  const today = todayStr()
  const problemRecord = useMemo(() => buildProblemRecord(answers), [answers])
  const dueIds = useMemo(
    () => Object.keys(problemRecord).filter((id) => isDue(problemRecord[id], today)),
    [problemRecord, today],
  )
  const isQuestionDue = useCallback(
    (questionId: string) => isDue(problemRecord[questionId], today),
    [problemRecord, today],
  )
  const legacyHabit = (settings[SETTING_KEYS.habitLegacy]?.value as LegacyHabit | undefined) ?? null
  const habit = useMemo(() => buildHabit(answers, legacyHabit, today), [answers, legacyHabit, today])
  const history = useMemo(() => buildKakomonHistory(answers), [answers])
  const lastBackupAt = (settings[SETTING_KEYS.lastBackupAt]?.value as number | undefined) ?? null
  const examDate = (settings[SETTING_KEYS.examDate]?.value as string | undefined) || null
  const dailyGoal = (settings[SETTING_KEYS.dailyGoal]?.value as number | undefined) ?? DAILY_GOAL

  // 設定の変更。updated_at は同期（2-9）で後から書いた方を採用するために使う
  const updateSetting = useCallback((key: string, value: unknown) => {
    const setting: Setting = { key, value, updated_at: Date.now() }
    setSnapshot((prev) => prev && { ...prev, settings: { ...prev.settings, [key]: setting } })
    getDb()
      .then((db) => putSetting(db, setting))
      .catch((e) => console.error('設定の保存に失敗しました', e))
  }, [])

  const exportBackup = useCallback(async () => {
    const now = Date.now()
    const backup = createBackup(answers, Object.values(settings), now)
    const setting: Setting = { key: SETTING_KEYS.lastBackupAt, value: now, updated_at: now }
    setSnapshot((prev) => prev && { ...prev, settings: { ...prev.settings, [setting.key]: setting } })
    await putSetting(await getDb(), setting)
    return backup
  }, [answers, settings])

  // 読み込み（上書き）。形式が不正なら BackupError を投げる
  const importBackup = useCallback(
    async (text: string) => {
      const parsed = parseBackup(text, device)
      const next = await importRecords(await getDb(), parsed.answers, parsed.settings)
      setSnapshot(next)
      return parsed.answers.length
    },
    [device],
  )

  return {
    loaded: snapshot !== null,
    error,
    answers,
    problemRecord,
    dueIds,
    isQuestionDue,
    habit,
    history,
    lastBackupAt,
    examDate,
    dailyGoal,
    today,
    recordAnswer,
    updateSetting,
    exportBackup,
    importBackup,
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addAnswer, getDb, importRecords, initStore, putSetting, type StoreSnapshot } from '../store/store'
import { buildHabit, buildKakomonHistory, buildProblemRecord } from '../store/replay'
import { SETTING_KEYS, type Answer, type AnswerMode, type AnswerResult, type LegacyHabit, type Setting } from '../store/types'
import { createBackup, parseBackup } from '../backup'
import { SyncError, syncOnce, type SyncFailure, type SyncResult } from '../store/sync'
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

export type SyncStatus = { state: 'idle' | 'syncing' | 'ok' } | { state: SyncFailure; message: string }

// 同期の結果を画面の状態に反映する。同期中に解いた分（DB への保存が終わっていないもの）を消さないよう、差分だけを当てる
function applySync(prev: StoreSnapshot, result: SyncResult): StoreSnapshot {
  const sent = new Set(result.sentIds)
  const have = new Set(prev.answers.map((a) => a.id))
  return {
    answers: [
      ...prev.answers.map((a) => (sent.has(a.id) ? { ...a, synced: 1 as const } : a)),
      ...result.received.filter((a) => !have.has(a.id)),
    ],
    settings: { ...prev.settings, ...Object.fromEntries(result.settings.map((s) => [s.key, s])) },
  }
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

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' })
  const syncing = useRef<Promise<void> | null>(null)

  // 同時に1つだけ走らせる。失敗しても未送信の解答は残り、次の同期で送られる
  const syncNow = useCallback(() => {
    syncing.current ??= (async () => {
      setSyncStatus({ state: 'syncing' })
      try {
        const result = await syncOnce(await getDb())
        setSnapshot((prev) => prev && applySync(prev, result))
        setSyncStatus({ state: 'ok' })
      } catch (e) {
        if (e instanceof SyncError) {
          setSyncStatus({ state: e.kind, message: e.message })
        } else {
          console.error('同期に失敗しました', e)
          setSyncStatus({ state: 'error', message: '同期に失敗しました' })
        }
      } finally {
        syncing.current = null
      }
    })()
    return syncing.current
  }, [])

  // 起動時（記録を読み込んだ後）と、オンラインに戻ったときに同期する
  const loaded = snapshot !== null
  useEffect(() => {
    if (!loaded || error) return
    void syncNow()
    const onOnline = () => void syncNow()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [loaded, error, syncNow])

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
  const lastSyncedAt = (settings[SETTING_KEYS.lastSyncedAt]?.value as number | undefined) ?? null
  const pendingCount = useMemo(() => answers.filter((a) => a.synced === 0).length, [answers])
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
      void syncNow()
      return parsed.answers.length
    },
    [device, syncNow],
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
    lastSyncedAt,
    pendingCount,
    syncStatus,
    syncNow,
    examDate,
    dailyGoal,
    today,
    recordAnswer,
    updateSetting,
    exportBackup,
    importBackup,
  }
}

import { getAllAnswers, getAllSettings, putRecords } from './db'
import { DEVICE_LOCAL_KEYS, SETTING_KEYS, type Answer, type Setting } from './types'

// 端末側の同期（docs/infrastructure.md 3節）。未送信の解答を送り、他の端末の解答と設定を受け取る。
// 復習状態や連続日数は解答ログから毎回計算し直すので、受け取ったログを足すだけで反映される

export const UPLOAD_CHUNK = 500
const MAX_ROUNDS = 100

export type SyncFailure = 'offline' | 'expired' | 'error'

export class SyncError extends Error {
  constructor(readonly kind: SyncFailure, message: string) {
    super(message)
  }
}

interface SyncResponse {
  cursor: number
  more: boolean
  answers: Omit<Answer, 'synced'>[]
  settings: Setting[]
}

export interface SyncResult {
  // 送信済みになった解答の id
  sentIds: string[]
  // 他の端末から届いた解答（この端末になかったもの）
  received: Answer[]
  // サーバー側の方が新しかった設定と、同期の位置・時刻
  settings: Setting[]
}

async function post(fetchImpl: typeof fetch, body: unknown): Promise<SyncResponse> {
  let res: Response
  try {
    res = await fetchImpl('/api/sync', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      // ログインが切れていると Access がログイン画面へリダイレクトする
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SyncError('offline', 'サーバーに接続できません')
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
    throw new SyncError('expired', 'ログインが切れています')
  }
  if (!res.ok) throw new SyncError('error', `サーバーエラー（${res.status}）`)
  return (await res.json()) as SyncResponse
}

const toWire = ({ synced: _synced, ...a }: Answer) => a

export async function syncOnce(
  db: IDBDatabase,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<SyncResult> {
  const [answers, settings] = await Promise.all([getAllAnswers(db), getAllSettings(db)])
  const known = new Set(answers.map((a) => a.id))
  const local = new Map(settings.map((s) => [s.key, s]))
  let cursor = (local.get(SETTING_KEYS.syncCursor)?.value as number | undefined) ?? 0
  const pending = answers.filter((a) => a.synced === 0).sort((a, b) => a.answered_at - b.answered_at)
  // 設定は数件なので毎回すべて送り、サーバー側で新しい方を残す
  const shared = settings.filter((s) => !DEVICE_LOCAL_KEYS.includes(s.key))

  const result: SyncResult = { sentIds: [], received: [], settings: [] }
  const serverSettings = new Map<string, Setting>()

  for (let round = 0, offset = 0; round < MAX_ROUNDS; round++) {
    const chunk = pending.slice(offset, offset + UPLOAD_CHUNK)
    const res = await post(fetchImpl, { cursor, answers: chunk.map(toWire), settings: round === 0 ? shared : [] })
    offset += chunk.length

    const sent = chunk.map((a) => ({ ...a, synced: 1 as const }))
    const received = res.answers.filter((a) => !known.has(a.id)).map((a) => ({ ...a, synced: 1 as const }))
    received.forEach((a) => known.add(a.id))
    cursor = res.cursor
    // 1往復ごとに保存し、途中で切れても送った分を送り直さないようにする
    await putRecords(db, [...sent, ...received], [{ key: SETTING_KEYS.syncCursor, value: cursor, updated_at: now }])
    result.sentIds.push(...sent.map((a) => a.id))
    result.received.push(...received)
    res.settings.forEach((s) => serverSettings.set(s.key, s))

    if (offset >= pending.length && !res.more) break
  }

  // 後から書いた方を採用する
  const newer = [...serverSettings.values()].filter((s) => {
    const mine = local.get(s.key)
    return !DEVICE_LOCAL_KEYS.includes(s.key) && (!mine || s.updated_at > mine.updated_at)
  })
  const meta: Setting[] = [
    { key: SETTING_KEYS.syncCursor, value: cursor, updated_at: now },
    { key: SETTING_KEYS.lastSyncedAt, value: now, updated_at: now },
  ]
  await putRecords(db, [], [...newer, ...meta])
  result.settings = [...newer, ...meta]
  return result
}

// 学習記録の同期（docs/infrastructure.md 3節）。解答ログは追記のみ、設定は後から書いた方を採用する

export const MAX_UPLOAD = 500
export const MAX_DOWNLOAD = 1000

const MODES = new Set(['anaume', 'kakomon', 'anshou', 'card', 'drill', 'snapshot'])

export interface SyncAnswer {
  id: string
  question_id: string
  mode: string
  result: 0 | 1 | 2
  choice: string | null
  session_id: string | null
  answered_at: number
  device: string
  payload: string | null
}

export interface SyncSetting {
  key: string
  value: unknown
  updated_at: number
}

export interface SyncRequest {
  cursor: number
  answers: SyncAnswer[]
  settings: SyncSetting[]
}

interface AnswerRow extends SyncAnswer {
  seq: number
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isOptStr = (v: unknown) => v === undefined || v === null || typeof v === 'string'
const isTime = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0

function parseAnswer(x: unknown): SyncAnswer | null {
  if (typeof x !== 'object' || x === null) return null
  const a = x as Record<string, unknown>
  if (!isStr(a.id) || !isStr(a.question_id) || !isStr(a.device) || !isTime(a.answered_at)) return null
  if (typeof a.mode !== 'string' || !MODES.has(a.mode)) return null
  if (a.result !== 0 && a.result !== 1 && a.result !== 2) return null
  if (!isOptStr(a.choice) || !isOptStr(a.session_id) || !isOptStr(a.payload)) return null
  return {
    id: a.id,
    question_id: a.question_id,
    mode: a.mode,
    result: a.result,
    choice: (a.choice as string | null | undefined) ?? null,
    session_id: (a.session_id as string | null | undefined) ?? null,
    answered_at: a.answered_at,
    device: a.device,
    payload: (a.payload as string | null | undefined) ?? null,
  }
}

function parseSetting(x: unknown): SyncSetting | null {
  if (typeof x !== 'object' || x === null) return null
  const s = x as Record<string, unknown>
  if (!isStr(s.key) || !('value' in s) || s.value === undefined || !isTime(s.updated_at)) return null
  return { key: s.key, value: s.value, updated_at: s.updated_at }
}

// 不正な入力はエラーメッセージを返す（1件でも不正なら全体を受け付けない）
export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (typeof body !== 'object' || body === null) return '本文が JSON のオブジェクトではありません'
  const b = body as Record<string, unknown>
  const cursor = b.cursor ?? 0
  if (!isTime(cursor)) return 'cursor が不正です'
  const rawAnswers = b.answers ?? []
  const rawSettings = b.settings ?? []
  if (!Array.isArray(rawAnswers) || !Array.isArray(rawSettings)) return 'answers・settings は配列にしてください'
  if (rawAnswers.length > MAX_UPLOAD) return `answers は1回に${MAX_UPLOAD}件までです`
  const answers = rawAnswers.map(parseAnswer)
  const bad = answers.findIndex((a) => a === null)
  if (bad >= 0) return `answers[${bad}] の形式が正しくありません`
  const settings = rawSettings.map(parseSetting)
  const badSetting = settings.findIndex((s) => s === null)
  if (badSetting >= 0) return `settings[${badSetting}] の形式が正しくありません`
  return { cursor, answers: answers as SyncAnswer[], settings: settings as SyncSetting[] }
}

const ANSWER_COLUMNS = 'seq, id, question_id, mode, result, choice, session_id, answered_at, device, payload'

async function readSettings(db: D1Database, user: string): Promise<SyncSetting[]> {
  const { results } = await db
    .prepare('SELECT key, value, updated_at FROM settings WHERE user = ? ORDER BY key')
    .bind(user)
    .all<{ key: string; value: string; updated_at: number }>()
  return results.map((r) => ({ key: r.key, value: JSON.parse(r.value) as unknown, updated_at: r.updated_at }))
}

// D1 の無料枠は1回の呼び出しで50クエリまでなので、1件ずつではなく JSON の配列を1つの文で書き込む
const INSERT_ANSWERS = `INSERT OR IGNORE INTO answers (id, user, question_id, mode, result, choice, session_id, answered_at, device, payload)
  SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.question_id'), json_extract(value, '$.mode'),
         json_extract(value, '$.result'), json_extract(value, '$.choice'), json_extract(value, '$.session_id'),
         json_extract(value, '$.answered_at'), json_extract(value, '$.device'), json_extract(value, '$.payload')
  FROM json_each(?2) ORDER BY key`

// 後から書いた方（updated_at が大きい方）だけを残す。WHERE true は SELECT と ON CONFLICT の区切り
const UPSERT_SETTINGS = `INSERT INTO settings (user, key, value, updated_at)
  SELECT ?1, json_extract(value, '$.key'), json_extract(value, '$.json'), json_extract(value, '$.updated_at')
  FROM json_each(?2) WHERE true
  ON CONFLICT (user, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  WHERE excluded.updated_at > settings.updated_at`

// 受け取った解答と設定を保存し、cursor より後の自分のログ（他の端末の分を含む）と全設定を返す
export async function sync(db: D1Database, user: string, req: SyncRequest) {
  const writes: D1PreparedStatement[] = []
  if (req.answers.length > 0) writes.push(db.prepare(INSERT_ANSWERS).bind(user, JSON.stringify(req.answers)))
  if (req.settings.length > 0) {
    const rows = req.settings.map((s) => ({ key: s.key, json: JSON.stringify(s.value), updated_at: s.updated_at }))
    writes.push(db.prepare(UPSERT_SETTINGS).bind(user, JSON.stringify(rows)))
  }
  if (writes.length > 0) await db.batch(writes)

  const { results } = await db
    .prepare(`SELECT ${ANSWER_COLUMNS} FROM answers WHERE user = ? AND seq > ? ORDER BY seq LIMIT ?`)
    .bind(user, req.cursor, MAX_DOWNLOAD + 1)
    .all<AnswerRow>()
  const more = results.length > MAX_DOWNLOAD
  const rows = results.slice(0, MAX_DOWNLOAD)
  return {
    cursor: rows.length > 0 ? rows[rows.length - 1].seq : req.cursor,
    more,
    answers: rows.map(({ seq: _seq, ...a }) => a),
    settings: await readSettings(db, user),
  }
}

// 設定画面の「データを読み込む」でそのまま使える書き出し v2 の形式で返す
export async function exportAll(db: D1Database, user: string, now: number = Date.now()) {
  const { results } = await db
    .prepare(`SELECT ${ANSWER_COLUMNS} FROM answers WHERE user = ? ORDER BY seq`)
    .bind(user)
    .all<AnswerRow>()
  return {
    app: 'jras',
    version: 2,
    exportedAt: now,
    answers: results.map(({ seq: _seq, ...a }) => a),
    settings: await readSettings(db, user),
  }
}

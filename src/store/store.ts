import { getAllAnswers, getAllSettings, openDb, putRecords, replaceAll } from './db'
import { legacyToLog, readLegacyLocalStorage } from './migrate'
import type { Answer, Setting } from './types'
import { DEVICE_LOCAL_KEYS, SETTING_KEYS } from './types'

export interface StoreSnapshot {
  answers: Answer[]
  settings: Record<string, Setting>
}

function toMap(settings: Setting[]): Record<string, Setting> {
  return Object.fromEntries(settings.map((s) => [s.key, s]))
}

async function load(db: IDBDatabase): Promise<StoreSnapshot> {
  const [answers, settings] = await Promise.all([getAllAnswers(db), getAllSettings(db)])
  return { answers, settings: toMap(settings) }
}

// 端末IDの用意と、localStorage からの初回移行を行ってから全データを返す
export async function initStore(
  db: IDBDatabase,
  storage: Storage = localStorage,
  now: number = Date.now(),
): Promise<StoreSnapshot> {
  const settings = toMap(await getAllSettings(db))
  const added: Setting[] = []

  let device = settings[SETTING_KEYS.deviceId]?.value as string | undefined
  if (!device) {
    device = crypto.randomUUID()
    added.push({ key: SETTING_KEYS.deviceId, value: device, updated_at: now })
  }

  let migrated: Answer[] = []
  if (!settings[SETTING_KEYS.migratedV1]) {
    // 元の localStorage は消さない（移行に失敗しても戻せるように）
    const log = legacyToLog(readLegacyLocalStorage(storage), device, now)
    migrated = log.answers
    added.push(...log.settings, { key: SETTING_KEYS.migratedV1, value: true, updated_at: now })
  }

  if (added.length > 0 || migrated.length > 0) await putRecords(db, migrated, added)
  return load(db)
}

export async function addAnswer(db: IDBDatabase, answer: Answer): Promise<void> {
  await putRecords(db, [answer])
}

export async function putSetting(db: IDBDatabase, setting: Setting): Promise<void> {
  await putRecords(db, [], [setting])
}

// 読み込み（上書き）。端末ID などの端末ごとの設定は残す
export async function importRecords(
  db: IDBDatabase,
  answers: Answer[],
  settings: Setting[],
): Promise<StoreSnapshot> {
  const current = toMap(await getAllSettings(db))
  const kept = DEVICE_LOCAL_KEYS.map((k) => current[k]).filter((s): s is Setting => !!s)
  const imported = settings.filter((s) => !DEVICE_LOCAL_KEYS.includes(s.key))
  await replaceAll(db, answers, [...imported, ...kept])
  return load(db)
}

let dbPromise: Promise<IDBDatabase> | null = null

export function getDb(): Promise<IDBDatabase> {
  dbPromise ??= openDb()
  return dbPromise
}

import type { Answer, Setting } from './store/types'
import { DEVICE_LOCAL_KEYS } from './store/types'
import { legacyToLog, type LegacyData } from './store/migrate'

export const BACKUP_VERSION = 2

export interface BackupV2 {
  app: 'jras'
  version: 2
  exportedAt: number
  answers: Answer[]
  settings: Setting[]
}

// 解答ログ化（段階0-2）より前の形。localStorage の中身をそのまま持つ
export interface BackupV1 {
  app: 'jras'
  version: 1
  exportedAt: number
  localStorage: LegacyData
}

export function createBackup(answers: Answer[], settings: Setting[], now: number = Date.now()): BackupV2 {
  return {
    app: 'jras',
    version: BACKUP_VERSION,
    exportedAt: now,
    answers,
    settings: settings.filter((s) => !DEVICE_LOCAL_KEYS.includes(s.key)),
  }
}

export function backupFileName(now: number = Date.now()): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `jras-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}

const MODES = new Set(['anaume', 'kakomon', 'anshou', 'card', 'drill', 'snapshot'])

function isAnswer(a: unknown): a is Answer {
  if (typeof a !== 'object' || a === null) return false
  const x = a as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.question_id === 'string' &&
    typeof x.mode === 'string' &&
    MODES.has(x.mode) &&
    (x.result === 0 || x.result === 1 || x.result === 2) &&
    typeof x.answered_at === 'number' &&
    typeof x.device === 'string'
  )
}

function isSetting(s: unknown): s is Setting {
  if (typeof s !== 'object' || s === null) return false
  const x = s as Record<string, unknown>
  return typeof x.key === 'string' && 'value' in x && typeof x.updated_at === 'number'
}

export class BackupError extends Error {}

// 読み込んだファイルを検証し、解答ログと設定に変換する。不正な形式なら BackupError
export function parseBackup(
  text: string,
  device: string,
  now: number = Date.now(),
): { answers: Answer[]; settings: Setting[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('JSON として読み込めませんでした')
  }
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== 'jras') {
    throw new BackupError('このアプリの書き出しファイルではありません')
  }

  const version = (data as { version?: unknown }).version
  if (version === 1) {
    const legacy = (data as BackupV1).localStorage
    if (typeof legacy !== 'object' || legacy === null) throw new BackupError('データが壊れています')
    return legacyToLog(legacy, device, now)
  }
  if (version === 2) {
    const { answers, settings } = data as BackupV2
    if (!Array.isArray(answers) || !answers.every(isAnswer)) {
      throw new BackupError('解答ログの形式が正しくありません')
    }
    if (!Array.isArray(settings) || !settings.every(isSetting)) {
      throw new BackupError('設定の形式が正しくありません')
    }
    // 読み込んだ分は、同期（段階2-9）で送り直す対象にする
    return { answers: answers.map((a) => ({ ...a, synced: 0 as const })), settings }
  }
  throw new BackupError(`対応していないバージョンです（${String(version)}）`)
}

// 解答ログ。docs/infrastructure.md の D1 `answers` テーブルと同じ形にする。
export type AnswerMode = 'anaume' | 'kakomon' | 'anshou' | 'card' | 'drill' | 'snapshot'

// 0=不正解/書けなかった 1=一部 2=正解/書けた
export type AnswerResult = 0 | 1 | 2

export interface Answer {
  id: string
  question_id: string
  mode: AnswerMode
  result: AnswerResult
  choice: string | null
  session_id: string | null
  answered_at: number
  device: string
  payload: string | null
  // 端末側だけで使う。0=未送信 1=送信済み（同期は段階2-9）
  synced: 0 | 1
}

export interface Setting {
  key: string
  value: unknown
  updated_at: number
}

// 移行前の連続日数（habitRecord）。ログに無い過去の学習日を補う
export interface LegacyHabit {
  lastStudyDate: string
  currentStreak: number
  longestStreak: number
  todayDate: string
  todayCount: number
}

export const SETTING_KEYS = {
  deviceId: 'deviceId',
  habitLegacy: 'habit.legacy',
  migratedV1: 'migrated.v1',
  lastBackupAt: 'backup.lastExportedAt',
  examDate: 'exam.date',
  dailyGoal: 'goal.daily',
  // 同期（2-9）。サーバーから受け取った最後の位置と、最後に同期できた時刻
  syncCursor: 'sync.cursor',
  lastSyncedAt: 'sync.lastSyncedAt',
} as const

// 端末ごとの設定。書き出し・読み込み・同期の対象にしない
export const DEVICE_LOCAL_KEYS: string[] = [
  SETTING_KEYS.deviceId,
  SETTING_KEYS.migratedV1,
  SETTING_KEYS.lastBackupAt,
  SETTING_KEYS.syncCursor,
  SETTING_KEYS.lastSyncedAt,
]

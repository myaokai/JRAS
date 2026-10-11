import type { HabitRecord, ProblemRecord } from '../types'
import type { Answer, Setting } from './types'
import { SETTING_KEYS } from './types'

export interface LegacyData {
  problemRecord?: ProblemRecord
  habitRecord?: HabitRecord
}

export const LEGACY_KEYS = ['problemRecord', 'habitRecord', 'kakomonHistory'] as const

export function readLegacyLocalStorage(storage: Storage = localStorage): LegacyData {
  const read = <T>(key: string): T | undefined => {
    try {
      const raw = storage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : undefined
    } catch {
      return undefined
    }
  }
  return {
    problemRecord: read<ProblemRecord>('problemRecord'),
    habitRecord: read<HabitRecord>('habitRecord'),
  }
}

// 旧形式（localStorage の「最新の状態」）を解答ログに変換する。
// problemRecord は問題ごとに snapshot 1件、habitRecord は設定 habit.legacy にする。
// kakomonHistory は直近5件しかないため移さない（docs/infrastructure.md）。
export function legacyToLog(
  legacy: LegacyData,
  device: string,
  now: number,
): { answers: Answer[]; settings: Setting[] } {
  const answers: Answer[] = Object.entries(legacy.problemRecord ?? {}).map(([questionId, entry]) => ({
    // 同じ端末で読み込み直しても重複しないよう、IDを固定する
    id: `snapshot-${device}-${questionId}`,
    question_id: questionId,
    mode: 'snapshot',
    result: entry.lastResult ? 2 : 0,
    choice: null,
    session_id: null,
    answered_at: entry.ts || now,
    device,
    payload: JSON.stringify(entry),
    synced: 0,
  }))

  const settings: Setting[] = legacy.habitRecord?.lastStudyDate
    ? [{ key: SETTING_KEYS.habitLegacy, value: legacy.habitRecord, updated_at: now }]
    : []

  return { answers, settings }
}

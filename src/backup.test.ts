import { describe, expect, it } from 'vitest'
import { BackupError, backupFileName, createBackup, parseBackup } from './backup'
import type { Answer, Setting } from './store/types'

const NOW = new Date(2026, 9, 12, 9, 5).getTime()
const answer: Answer = {
  id: 'a1',
  question_id: 'R07_kanteishi_001',
  mode: 'kakomon',
  result: 2,
  choice: '3',
  session_id: 's1',
  answered_at: NOW,
  device: 'd1',
  payload: null,
  synced: 1,
}
const settings: Setting[] = [
  { key: 'deviceId', value: 'd1', updated_at: NOW },
  { key: 'habit.legacy', value: { currentStreak: 3 }, updated_at: NOW },
]

describe('backup', () => {
  it('書き出して読み込むと同じログと設定に戻る（端末IDは含めない）', () => {
    const text = JSON.stringify(createBackup([answer], settings, NOW))
    const parsed = parseBackup(text, 'd2', NOW)
    expect(parsed.answers).toEqual([{ ...answer, synced: 0 }])
    expect(parsed.settings.map((s) => s.key)).toEqual(['habit.legacy'])
  })

  it('version 1（localStorage の形）は移行処理を通して読み込む', () => {
    const v1 = {
      app: 'jras',
      version: 1,
      exportedAt: NOW,
      localStorage: {
        problemRecord: { '7': { box: 1, dueDate: '2026-10-13', lastResult: true, ts: NOW } },
        habitRecord: { lastStudyDate: '2026-10-12', currentStreak: 2, longestStreak: 2, todayDate: '2026-10-12', todayCount: 3 },
      },
    }
    const parsed = parseBackup(JSON.stringify(v1), 'd2', NOW)
    expect(parsed.answers).toMatchObject([{ question_id: '7', mode: 'snapshot', device: 'd2' }])
    expect(parsed.settings[0].key).toBe('habit.legacy')
  })

  it.each([
    ['JSON でない', 'not json'],
    ['別アプリ', JSON.stringify({ app: 'other', version: 2 })],
    ['未対応の版', JSON.stringify({ app: 'jras', version: 99 })],
    ['ログが壊れている', JSON.stringify({ app: 'jras', version: 2, answers: [{ id: 1 }], settings: [] })],
  ])('不正なファイルは BackupError（%s）', (_, text) => {
    expect(() => parseBackup(text, 'd2', NOW)).toThrow(BackupError)
  })

  it('ファイル名に日時を入れる', () => {
    expect(backupFileName(NOW)).toBe('jras-backup-20261012-0905.json')
  })
})

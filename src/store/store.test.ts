import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDb } from './db'
import { addAnswer, importRecords, initStore } from './store'
import { buildHabit, buildProblemRecord } from './replay'
import type { LegacyHabit } from './types'

function memoryStorage(data: Record<string, unknown>): Storage {
  const map = new Map(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

const NOW = new Date(2026, 9, 12, 10).getTime()
const legacyStorage = () =>
  memoryStorage({
    problemRecord: {
      '12': { box: 2, dueDate: '2026-10-14', lastResult: true, ts: NOW - 86400000 },
      R07_kanteishi_003: { box: 0, dueDate: '2026-10-11', lastResult: false, ts: NOW - 86400000 },
    },
    habitRecord: { lastStudyDate: '2026-10-11', currentStreak: 5, longestStreak: 9, todayDate: '2026-10-11', todayCount: 8 },
    kakomonHistory: [],
  })

let dbName = 0
const freshDb = () => openDb(`test-${dbName++}`)

describe('initStore（localStorage からの移行）', () => {
  let storage: Storage
  beforeEach(() => {
    storage = legacyStorage()
  })

  it('既存の復習状態と連続日数を失わずに新形式で読める', async () => {
    const db = await freshDb()
    const snap = await initStore(db, storage, NOW)

    const record = buildProblemRecord(snap.answers)
    expect(record['12']).toMatchObject({ box: 2, dueDate: '2026-10-14' })
    expect(record['R07_kanteishi_003']).toMatchObject({ box: 0, lastResult: false })

    const legacy = snap.settings['habit.legacy'].value as LegacyHabit
    expect(buildHabit(snap.answers, legacy, '2026-10-12')).toMatchObject({ currentStreak: 5, longestStreak: 9 })
    expect(typeof snap.settings.deviceId.value).toBe('string')
    // 元の localStorage は残す
    expect(storage.getItem('problemRecord')).not.toBeNull()
  })

  it('2回目の起動では移行しない（ログが増えない・端末IDが変わらない）', async () => {
    const db = await freshDb()
    const first = await initStore(db, storage, NOW)
    await addAnswer(db, {
      ...first.answers[0],
      id: 'new',
      mode: 'anaume',
      result: 2,
      payload: null,
      answered_at: NOW,
    })
    const second = await initStore(db, storage, NOW + 1000)
    expect(second.answers).toHaveLength(3)
    expect(second.settings.deviceId.value).toBe(first.settings.deviceId.value)
  })

  it('localStorage が空でも起動できる', async () => {
    const snap = await initStore(await freshDb(), memoryStorage({}), NOW)
    expect(snap.answers).toEqual([])
    expect(snap.settings['migrated.v1'].value).toBe(true)
  })
})

describe('importRecords', () => {
  it('全体を置き換え、端末IDは残す', async () => {
    const db = await freshDb()
    const before = await initStore(db, legacyStorage(), NOW)
    const after = await importRecords(db, [], [
      { key: 'deviceId', value: 'other-device', updated_at: NOW },
      { key: 'examDate.tantou', value: '2027-05-09', updated_at: NOW },
    ])
    expect(after.answers).toEqual([])
    expect(after.settings.deviceId.value).toBe(before.settings.deviceId.value)
    expect(after.settings['examDate.tantou'].value).toBe('2027-05-09')
    expect(after.settings['habit.legacy']).toBeUndefined()
  })
})

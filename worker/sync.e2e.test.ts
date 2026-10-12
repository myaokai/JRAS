import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import worker from './index'
import { createD1 } from './d1.test-utils'
import { getAllAnswers, getAllSettings, openDb, putRecords } from '../src/store/db'
import { buildProblemRecord } from '../src/store/replay'
import { SyncError, syncOnce, UPLOAD_CHUNK } from '../src/store/sync'
import { SETTING_KEYS, type Answer } from '../src/store/types'

// 端末側の同期（src/store/sync.ts）を、本物の Worker と D1 相当のサーバーにつないで確かめる

const USER = 'me@example.com'
let server: D1Database
let dbCount = 0

// 本物の Worker（/api/sync）と、node:sqlite の D1 につなぐ fetch
function serverFetch(user: string | null = USER): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(new URL(String(input), 'https://jras.example'), init)
    const env = { ASSETS: {} as Fetcher, DB: server, ...(user && { DEV_USER: user }) }
    return worker.fetch(req, env)
  }) as typeof fetch
}

const device = () => openDb(`device-${++dbCount}`)

let seq = 0
function answer(device: string, question_id: string, result: 0 | 2, answered_at: number): Answer {
  return {
    id: `${device}-${++seq}`,
    question_id,
    mode: 'kakomon',
    result,
    choice: '1',
    session_id: 's',
    answered_at,
    device,
    payload: null,
    synced: 0,
  }
}

const T = new Date(2026, 9, 12, 10).getTime()

beforeEach(() => {
  server = createD1()
})

describe('syncOnce', () => {
  it('スマホで解いた記録がPCに反映され、復習状態も同じになる', async () => {
    const phone = await device()
    const pc = await device()
    await putRecords(phone, [answer('phone', 'R07_kanteishi_001', 2, T), answer('phone', 'R07_kanteishi_002', 0, T + 1)])

    const sent = await syncOnce(phone, serverFetch(), T + 10)
    expect(sent.sentIds).toHaveLength(2)
    expect((await getAllAnswers(phone)).every((a) => a.synced === 1)).toBe(true)

    const got = await syncOnce(pc, serverFetch(), T + 20)
    expect(got.received.map((a) => a.question_id).sort()).toEqual(['R07_kanteishi_001', 'R07_kanteishi_002'])
    expect(buildProblemRecord(await getAllAnswers(pc))).toEqual(buildProblemRecord(await getAllAnswers(phone)))
  })

  it('機内モードで解いた分は失敗しても残り、次の接続で送られる', async () => {
    const phone = await device()
    await putRecords(phone, [answer('phone', '1', 2, T)])
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await expect(syncOnce(phone, offline)).rejects.toMatchObject({ kind: 'offline' })
    expect((await getAllAnswers(phone))[0].synced).toBe(0)

    await syncOnce(phone, serverFetch())
    const pc = await device()
    expect((await syncOnce(pc, serverFetch())).received).toHaveLength(1)
  })

  it('2回目の同期では送り直さず、受け取るのは新しい分だけ', async () => {
    const phone = await device()
    const pc = await device()
    await putRecords(phone, [answer('phone', '1', 2, T)])
    await syncOnce(phone, serverFetch())
    await syncOnce(pc, serverFetch())

    await putRecords(pc, [answer('pc', '2', 2, T + 5)])
    const again = await syncOnce(pc, serverFetch())
    expect(again.sentIds).toHaveLength(1)
    expect(again.received).toEqual([])
    const back = await syncOnce(phone, serverFetch())
    expect(back.sentIds).toEqual([])
    expect(back.received.map((a) => a.question_id)).toEqual(['2'])
  })

  it(`${UPLOAD_CHUNK}件を超える未送信分は分けて送る`, async () => {
    const phone = await device()
    await putRecords(phone, Array.from({ length: UPLOAD_CHUNK + 20 }, (_, i) => answer('phone', String(i), 2, T + i)))
    const res = await syncOnce(phone, serverFetch())
    expect(res.sentIds).toHaveLength(UPLOAD_CHUNK + 20)
    const pc = await device()
    expect((await syncOnce(pc, serverFetch())).received).toHaveLength(UPLOAD_CHUNK + 20)
  })

  it('設定は後から書いた方を採用し、端末ごとの設定は送らない', async () => {
    const phone = await device()
    const pc = await device()
    await putRecords(phone, [], [
      { key: SETTING_KEYS.examDate, value: '2027-05-09', updated_at: 100 },
      { key: SETTING_KEYS.deviceId, value: 'phone', updated_at: 100 },
    ])
    await putRecords(pc, [], [
      { key: SETTING_KEYS.examDate, value: '2027-05-16', updated_at: 200 },
      { key: SETTING_KEYS.deviceId, value: 'pc', updated_at: 300 },
    ])
    await syncOnce(phone, serverFetch())
    await syncOnce(pc, serverFetch())
    await syncOnce(phone, serverFetch())

    const settingsOf = async (db: IDBDatabase) => Object.fromEntries((await getAllSettings(db)).map((s) => [s.key, s.value]))
    expect((await settingsOf(phone))[SETTING_KEYS.examDate]).toBe('2027-05-16')
    expect((await settingsOf(phone))[SETTING_KEYS.deviceId]).toBe('phone')
    expect((await settingsOf(pc))[SETTING_KEYS.deviceId]).toBe('pc')
    expect((await settingsOf(phone))[SETTING_KEYS.lastSyncedAt]).toEqual(expect.any(Number))
  })

  it('ログインが切れていれば expired として失敗する', async () => {
    const phone = await device()
    const redirect = (async () => ({ type: 'opaqueredirect', status: 0, ok: false }) as Response) as typeof fetch
    await expect(syncOnce(phone, redirect)).rejects.toBeInstanceOf(SyncError)
    await expect(syncOnce(phone, serverFetch(null))).rejects.toMatchObject({ kind: 'expired' })
  })
})

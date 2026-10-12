import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import worker from './index'
import type { Env } from './env'
import { MAX_DOWNLOAD } from './sync'

// node:sqlite で D1 の使う範囲（prepare/bind/all/run/batch）を模し、本物のマイグレーションと SQL を流す
function createD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as never[])), success: true }),
    run: async () => {
      sqlite.prepare(sql).run(...(params as never[]))
      return { success: true }
    },
  })
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      sqlite.exec('BEGIN')
      try {
        const out = []
        for (const s of stmts) out.push(await s.run())
        sqlite.exec('COMMIT')
        return out
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
  } as unknown as D1Database
}

const assets = { fetch: async () => new Response('asset') } as unknown as Fetcher
let db: D1Database

function api(path: string, user: string, body?: unknown) {
  const init: RequestInit = body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }
  const env: Env = { ASSETS: assets, DB: db, DEV_USER: user }
  return worker.fetch(new Request(`https://jras.example${path}`, init), env)
}

const ME = 'me@example.com'
const answer = (id: string, device = 'iphone', answered_at = 1_791_700_000_000) => ({
  id,
  question_id: 'R07_kanteishi_001',
  mode: 'kakomon',
  result: 2,
  choice: '3',
  session_id: 's1',
  answered_at,
  device,
  payload: null,
})

beforeEach(() => {
  db = createD1()
})

describe('/api/sync', () => {
  it('同じ解答を2回送っても1件になる', async () => {
    await api('/api/sync', ME, { cursor: 0, answers: [answer('a1')], settings: [] })
    const res = await api('/api/sync', ME, { cursor: 0, answers: [answer('a1')], settings: [] })
    const body = (await res.json()) as { answers: unknown[] }
    expect(res.status).toBe(200)
    expect(body.answers).toHaveLength(1)
  })

  it('別の端末IDで送ったログが cursor 以降として返る', async () => {
    const first = (await (await api('/api/sync', ME, { cursor: 0, answers: [answer('a1', 'iphone')] })).json()) as {
      cursor: number
    }
    await api('/api/sync', ME, { cursor: 0, answers: [answer('p1', 'pc')] })
    const res = (await (await api('/api/sync', ME, { cursor: first.cursor })).json()) as {
      cursor: number
      more: boolean
      answers: { id: string; device: string }[]
    }
    expect(res.answers.map((a) => [a.id, a.device])).toEqual([['p1', 'pc']])
    expect(res.cursor).toBeGreaterThan(first.cursor)
    expect(res.more).toBe(false)
    // 送ったときと同じ形で返る（seq・user は含めない）
    expect(Object.keys(res.answers[0]).sort()).toEqual(Object.keys(answer('x')).sort())
  })

  it('新しいログがなければ cursor はそのまま', async () => {
    const res = (await (await api('/api/sync', ME, { cursor: 5 })).json()) as { cursor: number; answers: unknown[] }
    expect(res).toMatchObject({ cursor: 5, answers: [] })
  })

  it('他の利用者のログと設定は返らない', async () => {
    await api('/api/sync', 'other@example.com', {
      answers: [answer('o1')],
      settings: [{ key: 'exam.date', value: '2027-05-09', updated_at: 1 }],
    })
    const res = (await (await api('/api/sync', ME, { cursor: 0 })).json()) as { answers: unknown[]; settings: unknown[] }
    expect(res.answers).toEqual([])
    expect(res.settings).toEqual([])
  })

  it('設定は後から書いた方が残る（古い更新は無視）', async () => {
    await api('/api/sync', ME, { settings: [{ key: 'goal.daily', value: 20, updated_at: 200 }] })
    await api('/api/sync', ME, { settings: [{ key: 'goal.daily', value: 10, updated_at: 100 }] })
    let res = (await (await api('/api/sync', ME, {})).json()) as { settings: unknown[] }
    expect(res.settings).toEqual([{ key: 'goal.daily', value: 20, updated_at: 200 }])
    await api('/api/sync', ME, { settings: [{ key: 'goal.daily', value: 30, updated_at: 300 }] })
    res = (await (await api('/api/sync', ME, {})).json()) as { settings: unknown[] }
    expect(res.settings).toEqual([{ key: 'goal.daily', value: 30, updated_at: 300 }])
  })

  it(`一度に返すのは${MAX_DOWNLOAD}件までで、続きは more で知らせる`, async () => {
    const all = Array.from({ length: MAX_DOWNLOAD + 5 }, (_, i) => answer(`b${i}`))
    for (let i = 0; i < all.length; i += 500) await api('/api/sync', ME, { answers: all.slice(i, i + 500) })
    const page1 = (await (await api('/api/sync', ME, { cursor: 0 })).json()) as { cursor: number; more: boolean; answers: unknown[] }
    expect(page1.answers).toHaveLength(MAX_DOWNLOAD)
    expect(page1.more).toBe(true)
    const page2 = (await (await api('/api/sync', ME, { cursor: page1.cursor })).json()) as { more: boolean; answers: unknown[] }
    expect(page2.answers).toHaveLength(5)
    expect(page2.more).toBe(false)
  })

  it.each([
    ['JSON でない', 'not json'],
    ['result が範囲外', { answers: [{ ...answer('x'), result: 3 }] }],
    ['mode が不明', { answers: [{ ...answer('x'), mode: 'quiz' }] }],
    ['answered_at がない', { answers: [{ ...answer('x'), answered_at: undefined }] }],
    ['件数が多すぎる', { answers: Array.from({ length: 501 }, (_, i) => answer(`c${i}`)) }],
    ['設定に updated_at がない', { settings: [{ key: 'goal.daily', value: 10 }] }],
  ])('不正な入力は 400（%s）で、何も保存しない', async (_label, body) => {
    const res =
      typeof body === 'string'
        ? await worker.fetch(new Request('https://jras.example/api/sync', { method: 'POST', body }), {
            ASSETS: assets,
            DB: db,
            DEV_USER: ME,
          })
        : await api('/api/sync', ME, body)
    expect(res.status).toBe(400)
    const after = (await (await api('/api/sync', ME, {})).json()) as { answers: unknown[] }
    expect(after.answers).toEqual([])
  })

  it('ログインしていなければ 401', async () => {
    const res = await worker.fetch(new Request('https://jras.example/api/sync', { method: 'POST', body: '{}' }), {
      ASSETS: assets,
      DB: db,
    })
    expect(res.status).toBe(401)
  })
})

describe('/api/export', () => {
  it('自分の全データを書き出し v2 の形式で返す', async () => {
    await api('/api/sync', ME, {
      answers: [answer('a1'), answer('a2', 'pc')],
      settings: [{ key: 'exam.date', value: '2027-05-09', updated_at: 1 }],
    })
    await api('/api/sync', 'other@example.com', { answers: [answer('o1')] })
    const body = (await (await api('/api/export', ME)).json()) as {
      app: string
      version: number
      answers: { id: string }[]
      settings: unknown[]
    }
    expect(body.app).toBe('jras')
    expect(body.version).toBe(2)
    expect(body.answers.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(body.settings).toEqual([{ key: 'exam.date', value: '2027-05-09', updated_at: 1 }])
  })
})

import { describe, expect, it } from 'vitest'
import worker from './index'
import type { Env } from './env'

const assets = {
  fetch: async (req: Request) =>
    new Response(`asset:${new URL(req.url).pathname}`, { headers: { 'Cache-Control': 'public, max-age=3600' } }),
} as unknown as Fetcher

const call = (path: string, env: Partial<Env> = {}, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://jras.example${path}`, { headers }), { ASSETS: assets, DB: {} as D1Database, ...env })

describe('worker', () => {
  it('/api/me は DEV_USER があれば利用者を返す', async () => {
    const res = await call('/api/me', { DEV_USER: 'dev@example.com' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: 'dev@example.com' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('/api/* は認証がなければ 401（JWT ヘッダーだけでは通さない）', async () => {
    expect((await call('/api/me')).status).toBe(401)
    expect((await call('/api/me', {}, { 'Cf-Access-Jwt-Assertion': 'x.y.z' })).status).toBe(401)
  })

  it('/api/login はログイン後にトップへ戻し、未ログインなら 401', async () => {
    const res = await call('/api/login', { DEV_USER: 'dev@example.com' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
    expect((await call('/api/login')).status).toBe(401)
  })

  it('未実装の /api/* は 404', async () => {
    expect((await call('/api/unknown', { DEV_USER: 'dev@example.com' })).status).toBe(404)
  })

  it('/audio/* は index.html にすり替えず 404', async () => {
    const res = await call('/audio/1.mp3')
    expect(res.status).toBe(404)
  })

  it('sw.js などは再検証させ、それ以外の静的ファイルはそのまま返す', async () => {
    const sw = await call('/sw.js')
    expect(sw.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
    const json = await call('/questions.json')
    expect(await json.text()).toBe('asset:/questions.json')
    expect(json.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })
})

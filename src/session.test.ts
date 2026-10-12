import { describe, expect, it } from 'vitest'
import { checkSession } from './session'

const respond = (init: Partial<Response> & { json?: () => Promise<unknown> }) =>
  (async () => ({ ok: false, status: 200, type: 'basic', json: async () => ({}), ...init }) as Response) as typeof fetch

describe('checkSession', () => {
  it('ログイン中なら利用者を返す', async () => {
    const s = await checkSession(respond({ ok: true, json: async () => ({ user: 'me@example.com' }) }))
    expect(s).toEqual({ status: 'ok', user: 'me@example.com' })
  })

  it('Access のログイン画面へのリダイレクトはログイン切れ', async () => {
    expect(await checkSession(respond({ type: 'opaqueredirect', status: 0 }))).toEqual({ status: 'expired' })
  })

  it('401 もログイン切れ', async () => {
    expect(await checkSession(respond({ status: 401 }))).toEqual({ status: 'expired' })
  })

  it('通信できなければオフライン', async () => {
    const fail = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await checkSession(fail)).toEqual({ status: 'offline' })
  })

  it('JSON でない応答はエラー（ログイン切れとは扱わない）', async () => {
    const s = await checkSession(
      respond({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      }),
    )
    expect(s.status).toBe('error')
  })
})

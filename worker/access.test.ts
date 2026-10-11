import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { clearCertsCache, verifyAccessJwt } from './access'

const TEAM = 'https://example.cloudflareaccess.com'
const AUD = 'aud-tag'
const NOW = Date.UTC(2026, 9, 12)

let privateKey: CryptoKey
let publicJwk: JsonWebKey & { kid: string }
let otherPrivateKey: CryptoKey

const b64url = (data: Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? new TextEncoder().encode(data) : data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function sign(claims: Record<string, unknown>, key = privateKey, kid = 'k1'): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }))
  const body = b64url(JSON.stringify(claims))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`
}

const validClaims = () => ({ email: 'me@example.com', aud: [AUD], iss: TEAM, exp: NOW / 1000 + 3600 })

async function genKey() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
}

beforeAll(async () => {
  const pair = await genKey()
  privateKey = pair.privateKey
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' }
  otherPrivateKey = (await genKey()).privateKey
})

function stubCerts() {
  const fetchMock = vi.fn(async () => Response.json({ keys: [publicJwk] }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearCertsCache()
})

describe('verifyAccessJwt', () => {
  it('正しい JWT ならメールアドレスを返し、公開鍵はキャッシュする', async () => {
    const fetchMock = stubCerts()
    const token = await sign(validClaims())
    expect(await verifyAccessJwt(token, TEAM, AUD, NOW)).toBe('me@example.com')
    expect(await verifyAccessJwt(token, TEAM, AUD, NOW)).toBe('me@example.com')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${TEAM}/cdn-cgi/access/certs`)
  })

  it.each([
    ['AUD が違う', { aud: ['other'] }],
    ['発行元が違う', { iss: 'https://evil.cloudflareaccess.com' }],
    ['期限切れ', { exp: NOW / 1000 - 1 }],
    ['まだ有効でない', { nbf: NOW / 1000 + 60 }],
  ])('%s なら拒否する', async (_, override) => {
    stubCerts()
    expect(await verifyAccessJwt(await sign({ ...validClaims(), ...override }), TEAM, AUD, NOW)).toBeNull()
  })

  it('別の鍵で署名されたものは拒否する', async () => {
    stubCerts()
    expect(await verifyAccessJwt(await sign(validClaims(), otherPrivateKey), TEAM, AUD, NOW)).toBeNull()
  })

  it('改ざんされた内容は拒否する', async () => {
    stubCerts()
    const [h, , s] = (await sign(validClaims())).split('.')
    const forged = b64url(JSON.stringify({ ...validClaims(), email: 'attacker@example.com' }))
    expect(await verifyAccessJwt(`${h}.${forged}.${s}`, TEAM, AUD, NOW)).toBeNull()
  })

  it('知らない kid なら鍵を取り直し、それでもなければ拒否する', async () => {
    const fetchMock = stubCerts()
    expect(await verifyAccessJwt(await sign(validClaims(), privateKey, 'unknown'), TEAM, AUD, NOW)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('形式が壊れたトークンは拒否する', async () => {
    stubCerts()
    expect(await verifyAccessJwt('abc', TEAM, AUD, NOW)).toBeNull()
    expect(await verifyAccessJwt('a.b.c', TEAM, AUD, NOW)).toBeNull()
  })
})

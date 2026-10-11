// Cloudflare Access の JWT（Cf-Access-Jwt-Assertion）を検証する。
// ヘッダーをそのまま信用せず、チームの公開鍵で署名を確かめ、AUD・発行元・有効期限を確認する。

interface Jwk extends JsonWebKey {
  kid: string
}

interface AccessClaims {
  email?: string
  aud: string | string[]
  iss: string
  exp: number
  nbf?: number
}

const CERTS_TTL_MS = 60 * 60 * 1000
let certsCache: { url: string; keys: Jwk[]; fetchedAt: number } | null = null

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function decodeJson<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T
}

async function getKeys(teamDomain: string, forceRefresh: boolean): Promise<Jwk[]> {
  const url = `${teamDomain}/cdn-cgi/access/certs`
  const now = Date.now()
  if (!forceRefresh && certsCache?.url === url && now - certsCache.fetchedAt < CERTS_TTL_MS) {
    return certsCache.keys
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`certs の取得に失敗しました（${res.status}）`)
  const { keys } = (await res.json()) as { keys: Jwk[] }
  certsCache = { url, keys, fetchedAt: now }
  return keys
}

export function clearCertsCache(): void {
  certsCache = null
}

// 検証できればメールアドレスを、できなければ null を返す
export async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  aud: string,
  now: number = Date.now(),
): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts

  let header: { alg?: string; kid?: string }
  let claims: AccessClaims
  try {
    header = decodeJson(h)
    claims = decodeJson(p)
  } catch {
    return null
  }
  if (header.alg !== 'RS256' || !header.kid) return null

  // 鍵の更新（ローテーション）に備え、見つからなければ1回だけ取り直す
  let jwk = (await getKeys(teamDomain, false)).find((k) => k.kid === header.kid)
  jwk ??= (await getKeys(teamDomain, true)).find((k) => k.kid === header.kid)
  if (!jwk) return null

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(sig),
    new TextEncoder().encode(`${h}.${p}`),
  )
  if (!valid) return null

  const nowSec = Math.floor(now / 1000)
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audiences.includes(aud)) return null
  if (claims.iss !== teamDomain) return null
  if (claims.exp <= nowSec) return null
  if (claims.nbf !== undefined && claims.nbf > nowSec) return null
  return claims.email ?? null
}

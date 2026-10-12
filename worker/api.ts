import type { Env } from './env'
import { verifyAccessJwt } from './access'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// ログインしている利用者（メールアドレス）を返す。開発時は DEV_USER を使う
export async function getUser(request: Request, env: Env): Promise<string | null> {
  if (env.DEV_USER) return env.DEV_USER
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null
  try {
    return await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD)
  } catch (e) {
    console.error('Access の JWT を検証できませんでした', e)
    return null
  }
}

export async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const user = await getUser(request, env)
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (pathname === '/api/me' && request.method === 'GET') {
    return json({ user })
  }
  // 再ログインの入口。Access のログインを通ってここに来たら、アプリのトップへ戻す
  if (pathname === '/api/login' && request.method === 'GET') {
    return new Response(null, { status: 302, headers: { Location: '/', 'Cache-Control': 'no-store' } })
  }
  // /api/sync・/api/export は段階2-8で追加する
  return json({ error: 'not_found' }, 404)
}

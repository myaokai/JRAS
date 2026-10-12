import { useCallback, useEffect, useState } from 'react'

// Cloudflare Access のログイン状態。アプリ全体を保護しているが、Service Worker が保存済みの画面を
// 返すため、ログインが切れていてもアプリは開ける。そのときは更新と同期だけが止まる
export type SessionState =
  | { status: 'checking' }
  | { status: 'ok'; user: string }
  | { status: 'expired' }
  | { status: 'offline' }
  | { status: 'error'; message: string }

// ここを開くと Access のログイン画面を経由してトップに戻る（worker/api.ts）。
// Service Worker は /api/ を横取りしない（vite.config.ts の navigateFallbackDenylist）
export const LOGIN_URL = '/api/login'

export async function checkSession(fetchImpl: typeof fetch = fetch): Promise<SessionState> {
  let res: Response
  try {
    // ログインが切れていると Access がログイン画面へリダイレクトする。追いかけると別オリジンで失敗するので止める
    res = await fetchImpl('/api/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' })
  } catch {
    return { status: 'offline' }
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) return { status: 'expired' }
  if (!res.ok) return { status: 'error', message: `エラー（${res.status}）` }
  try {
    const body = (await res.json()) as { user?: string }
    return body.user ? { status: 'ok', user: body.user } : { status: 'error', message: '応答が不正です' }
  } catch {
    return { status: 'error', message: '応答が不正です' }
  }
}

export function relogin(): void {
  location.assign(LOGIN_URL)
}

// 起動時とオンライン復帰時にログイン状態を確かめる
export function useSession() {
  const [session, setSession] = useState<SessionState>({ status: 'checking' })

  const refresh = useCallback(async () => {
    setSession({ status: 'checking' })
    setSession(await checkSession())
  }, [])

  useEffect(() => {
    void refresh()
    const onOnline = () => void refresh()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh])

  return { session, refresh }
}

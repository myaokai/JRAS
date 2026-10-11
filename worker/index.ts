import type { Env } from './env'
import { handleApi } from './api'

// PWAの更新検知はブラウザがこれらのファイルを再取得して初めて働くため、
// 既定の1時間キャッシュのままだと更新が反映されにくい。常に再検証させる。
const REVALIDATE_PATHS = new Set([
  '/',
  '/index.html',
  '/sw.js',
  '/registerSW.js',
  '/manifest.webmanifest',
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname.startsWith('/api/')) return handleApi(request, env, pathname)
    // 音声（R2）は段階3-1で追加する。それまでは index.html を返さないよう 404 にする
    if (pathname.startsWith('/audio/')) return new Response('Not Found', { status: 404 })

    const response = await env.ASSETS.fetch(request)
    if (!REVALIDATE_PATHS.has(pathname)) return response

    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
    return new Response(response.body, { status: response.status, headers })
  },
}

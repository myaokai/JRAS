interface Env {
  ASSETS: Fetcher
}

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
    const response = await env.ASSETS.fetch(request)
    const { pathname } = new URL(request.url)

    if (!REVALIDATE_PATHS.has(pathname)) return response

    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
    return new Response(response.body, { status: response.status, headers })
  },
}

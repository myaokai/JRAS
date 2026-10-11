export interface Env {
  ASSETS: Fetcher
  // 学習記録の同期用 D1「jras-db」（段階2-8で使い始める）
  DB: D1Database
  // Cloudflare Access のチームドメイン（例 https://example.cloudflareaccess.com）と、アプリの AUD タグ
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  // ローカル開発専用。.dev.vars でだけ設定し、wrangler.jsonc の vars には書かない
  DEV_USER?: string
}

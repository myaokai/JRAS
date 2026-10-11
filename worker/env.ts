export interface Env {
  ASSETS: Fetcher
  // Cloudflare Access のチームドメイン（例 https://example.cloudflareaccess.com）と、アプリの AUD タグ
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  // ローカル開発専用。.dev.vars でだけ設定し、wrangler.jsonc の vars には書かない
  DEV_USER?: string
}

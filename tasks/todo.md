# 2-8 同期のサーバー側（ブランチ `feat/stage2-8-sync-server`）

設計: [docs/infrastructure.md](../docs/infrastructure.md) 2・3節 / 認証は Access（0-7 で決定）

## 作業項目
- [x] `migrations/0001_init.sql`：`answers`（seq・id UNIQUE・user …）と `settings`（user, key 主キー）
- [x] `worker/sync.ts`：入力の検証（件数上限500、型、mode、result）
- [x] `POST /api/sync`：解答は `INSERT OR IGNORE`、設定は updated_at が新しいときだけ上書き。cursor より後の自分のログ（上限1000件、`more`）と全設定を返す
- [x] `GET /api/export`：自分の全データを書き出し v2 の形式で返す（設定画面の読み込みでそのまま使える）
- [x] 結合テスト：node:sqlite で D1 を模して、実際の SQL を流す
  - 同じ解答を2回送っても1件
  - 別の端末IDで送ったログが cursor 以降として返る
  - 他の利用者のログは返らない
  - 設定は後から書いた方が残る
  - 不正な入力は 400
- [x] 本番 D1 にマイグレーションを適用（`wrangler d1 migrations apply jras-db --remote`）
- [x] docs（infrastructure・roadmap）

## レビュー

**結果**：`npm test` 85件（同期の結合テスト14件を追加）、`tsc -b` が通る。
- 結合テストは node:sqlite で D1 を模し、本物のマイグレーションと SQL を流す。完了条件の「同じ解答を2回送っても1件」「別の端末IDで送ったログが cursor 以降として返る」を含む。
- `wrangler dev` のローカル D1 でも確認した：500件の一括送信、重複の無視、古い設定で上書きされないこと、書き出し。
- 本番 D1 に `0001_init.sql` を適用済み（answers・settings・索引）。

**設計から変えた点**
- D1 の無料枠（1回の呼び出しで50クエリまで）に収めるため、1件ずつの INSERT ではなく `json_each` で1文にまとめた。
- 設定の value は JSON 文字列ではなく、任意の JSON 値のまま送受信する（端末の IndexedDB と同じ形）。
- レスポンスに `more` を足した（1000件を超えるときの続き）。
- マイグレーションは Workers Builds に組み込まず、テーブル変更を含む PR のマージ前に手動で適用する。

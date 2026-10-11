# 段階0　基盤（ブランチ `feat/stage0`）

設計: [docs/roadmap.md](../docs/roadmap.md) 段階0 / [docs/infrastructure.md](../docs/infrastructure.md)

## 進め方

- 0-5（Vitest）を先に入れ、0-1・0-2 をテスト付きで作る。順序: 0-5a → 0-1 → 0-2 → 0-3 → 0-4 → 0-5b → 0-6 → 0-7（コードのみ）
- タスクごとにコミットし、最後に PR を作る（マージはレビュー後）

## 作業項目

### 0-5a テストの土台
- [x] Vitest と fake-indexeddb を追加し、`npm test` を用意する
- [x] `date.ts` を端末の日付（日本時間）で計算するよう直す（今は UTC のため、0〜9時は前日扱いになる）
- [x] `leitner.ts`・`habit.ts` の単体テスト

### 0-1 学習データの書き出し・読み込み
- [x] `src/backup.ts`: 書き出し形式 `{ app: "jras", version, exportedAt, ... }` の作成と、読み込み時の形式チェック
- [x] 読み込みは上書きの確認を出してから反映する
- [x] 形式チェックと往復（書き出し→読み込み）のテスト

### 0-2 解答ログ形式（IndexedDB）
- [x] `src/store/db.ts`: IndexedDB（`answers`・`settings` ストア）。依存を増やさず薄いラッパーで書く
- [x] 解答ログの型: id(UUID), question_id, mode, result(0/1/2), choice, session_id, answered_at, device, payload, synced
- [x] `src/store/replay.ts`（純粋関数）: ログから復習状態（ボックス・次回日）、連続日数・今日の解答数、過去問の履歴（session_id ごと）を計算する
- [x] `src/store/migrate.ts`: 初回起動時に `problemRecord` → snapshot、`habitRecord` → 設定 `habit.legacy`。移行済みフラグを持ち、元の localStorage は消さない
- [x] 既存のフック（useProblemRecord / useHabitRecord / useKakomonHistory）を、ログを読む1つのフックに置き換える
- [x] 書き出し形式を version 2（ログ＋設定）にし、version 1（localStorage の形）も読み込めるようにする（読み込み時に移行処理を通す）
- [x] 問題IDの規則を docs に書く（既存IDはそのまま、新科目は `<科目>:` の接頭辞）
- [x] テスト: 再生計算（正解・不正解の連続、snapshot からの継続、日付をまたぐ連続日数）、移行、書き出し・読み込み

### 0-3 画面遷移（ハッシュ）
- [x] `useHashRoute`: `#/`・`#/study`・`#/study/anaume`・`#/study/kakomon`・`#/quiz`・`#/result`・`#/textbook/:章/:節`・`#/records`・`#/settings`
- [x] スマホの「戻る」で前の画面に戻る。出題中の状態がないのに `#/quiz` を開いた場合は学習トップへ戻す

### 0-4 共通部品
- [x] 画面の枠・ヘッダー（戻る）・下部タブ・下部固定ボタン・チップ・カード・進捗バーを、ワイヤーに合わせて作る
- [x] 01 ホーム（連続日数・今日の目標・復習期限の件数）、02 学習トップ（モード一覧）、14 記録（仮）、15 設定（書き出し・読み込み・接続確認）
- [x] 穴埋め・過去問・教科書を新しい枠に載せ、出題中は下部タブを隠して下部固定ボタンにする

### 0-5b 画面の検証
- [x] `verify_checks.cjs` を新しい画面遷移に合わせて書き直す（ホーム→学習→出題→結果、教科書、設定の書き出し、戻る操作、移行）
- [x] `npm test`・`npm run build`・`verify_checks.cjs` がすべて通る

### 0-6 インフラの土台
- [x] Worker に `/api/*` と `/audio/*` の振り分けを足し、`run_worker_first` に追加する
- [x] Service Worker の `navigateFallbackDenylist` に `/api/`・`/audio/` を足す（index.html にすり替わらないように）
- [x] `/api/me` を仮実装する（開発時は `DEV_USER`、本番は Access の JWT。未設定なら 401）。`/audio/*` は R2 ができるまで 404
- [x] `wrangler` を devDependencies に入れ、`npm run dev:worker`（ビルド＋`wrangler dev`）を用意する。`.dev.vars` で `DEV_USER` を渡す
- [x] D1・R2 のバインディングは、実物を作る 2-8・3-1 で追加する（今入れると、デプロイ時にリソースが自動で作られる可能性があるため）
- [x] ローカルで `/api/me` と静的配信・`sw.js` の再検証ヘッダーを確認する

### 0-7 認証（コードまで）
- [x] Worker で `Cf-Access-Jwt-Assertion` を検証する（WebCrypto、チームの公開鍵を取得してキャッシュ、AUD・期限・発行元を確認）。単体テストあり
- [x] Access の設定手順と、iPhone での確認手順を docs に書く
- [ ] Cloudflare 側で Access を設定し、iPhone のホーム画面版で確認する（利用者が行う）

## 確認が必要なこと

- デプロイの方法: GitHub に Cloudflare のチェックが出ていないので、手動の `wrangler deploy` と推測している
- Cloudflare 側の作業（Access の設定、デプロイ）は、こちらでは行わない

## レビュー

**結果**：`npm test` 54件、`npm run build`、`verify_checks.cjs` 29/29 がすべて通る。`npm run dev:worker` で次を確認した。
- `/api/me` は `DEV_USER` があれば 200、なければ 401（偽の JWT ヘッダーを付けても 401）
- Service Worker の管理下で `/api/me` を開いても index.html にすり替わらない
- `/audio/*` は 404、`sw.js` には再検証のヘッダーが付く

**設計から変えた点・注意点**
- 過去問の履歴は、途中でやめたセットも解いた分だけ残る（以前は最後まで解いたセットのみ）。旧 `kakomonHistory`（直近5件）は設計どおり移していないため、移行後は履歴が空から始まる。
- 穴埋めの結果画面に「わかった」の割合を出すようにした。問題ごとの次回日の一覧は 2-2 で作る。
- D1・R2 のバインディングは入れていない（2-8・3-1 で実物と一緒に入れる）。
- `wrangler.jsonc` の `ACCESS_TEAM_DOMAIN`・`ACCESS_AUD` は空のまま。空の間、本番の `/api/me` は常に 401（アプリの動作には影響しない）。

**残り（利用者の作業）**
- デプロイ方法の確認。GitHub に Cloudflare のチェックが出ていないので、手動の `wrangler deploy` と推測している。
- 0-7 の実機検証（docs/infrastructure.md「設定手順」「iPhone での確認手順」）。

# 段階0　基盤（ブランチ `feat/stage0`）

設計: [docs/roadmap.md](../docs/roadmap.md) 段階0 / [docs/infrastructure.md](../docs/infrastructure.md)

## 進め方

- 0-5（Vitest）を先に入れ、0-1・0-2 をテスト付きで作る。順序: 0-5a → 0-1 → 0-2 → 0-3 → 0-4 → 0-5b → 0-6 → 0-7（コードのみ）
- タスクごとにコミットし、最後に PR を作る（マージはレビュー後）

## 作業項目

### 0-5a テストの土台
- [ ] Vitest と fake-indexeddb を追加し、`npm test` を用意する
- [ ] `date.ts` を端末の日付（日本時間）で計算するよう直す（今は UTC のため、0〜9時は前日扱いになる）
- [ ] `leitner.ts`・`habit.ts` の単体テスト

### 0-1 学習データの書き出し・読み込み
- [ ] `src/backup.ts`: 書き出し形式 `{ app: "jras", version, exportedAt, ... }` の作成と、読み込み時の形式チェック
- [ ] 読み込みは上書きの確認を出してから反映する
- [ ] 形式チェックと往復（書き出し→読み込み）のテスト

### 0-2 解答ログ形式（IndexedDB）
- [ ] `src/store/db.ts`: IndexedDB（`answers`・`settings` ストア）。依存を増やさず薄いラッパーで書く
- [ ] 解答ログの型: id(UUID), question_id, mode, result(0/1/2), choice, session_id, answered_at, device, payload, synced
- [ ] `src/store/replay.ts`（純粋関数）: ログから復習状態（ボックス・次回日）、連続日数・今日の解答数、過去問の履歴（session_id ごと）を計算する
- [ ] `src/store/migrate.ts`: 初回起動時に `problemRecord` → snapshot、`habitRecord` → 設定 `habit.legacy`。移行済みフラグを持ち、元の localStorage は消さない
- [ ] 既存のフック（useProblemRecord / useHabitRecord / useKakomonHistory）を、ログを読む1つのフックに置き換える
- [ ] 書き出し形式を version 2（ログ＋設定）にし、version 1（localStorage の形）も読み込めるようにする（読み込み時に移行処理を通す）
- [ ] 問題IDの規則を docs に書く（既存IDはそのまま、新科目は `<科目>:` の接頭辞）
- [ ] テスト: 再生計算（正解・不正解の連続、snapshot からの継続、日付をまたぐ連続日数）、移行、書き出し・読み込み

### 0-3 画面遷移（ハッシュ）
- [ ] `useHashRoute`: `#/`・`#/study`・`#/study/anaume`・`#/study/kakomon`・`#/quiz`・`#/result`・`#/textbook/:章/:節`・`#/records`・`#/settings`
- [ ] スマホの「戻る」で前の画面に戻る。出題中の状態がないのに `#/quiz` を開いた場合は学習トップへ戻す

### 0-4 共通部品
- [ ] 画面の枠・ヘッダー（戻る）・下部タブ・下部固定ボタン・チップ・カード・進捗バーを、ワイヤーに合わせて作る
- [ ] 01 ホーム（連続日数・今日の目標・復習期限の件数）、02 学習トップ（モード一覧）、14 記録（仮）、15 設定（書き出し・読み込み・接続確認）
- [ ] 穴埋め・過去問・教科書を新しい枠に載せ、出題中は下部タブを隠して下部固定ボタンにする

### 0-5b 画面の検証
- [ ] `verify_checks.cjs` を新しい画面遷移に合わせて書き直す（ホーム→学習→出題→結果、教科書、設定の書き出し、戻る操作、移行）
- [ ] `npm test`・`npm run build`・`verify_checks.cjs` がすべて通る

### 0-6 インフラの土台
- [ ] Worker に `/api/*` と `/audio/*` の振り分けを足し、`run_worker_first` に追加する
- [ ] Service Worker の `navigateFallbackDenylist` に `/api/`・`/audio/` を足す（index.html にすり替わらないように）
- [ ] `/api/me` を仮実装する（開発時は `DEV_USER`、本番は Access の JWT。未設定なら 401）。`/audio/*` は R2 ができるまで 404
- [ ] `wrangler` を devDependencies に入れ、`npm run dev:worker`（ビルド＋`wrangler dev`）を用意する。`.dev.vars` で `DEV_USER` を渡す
- [ ] D1・R2 のバインディングは、実物を作る 2-8・3-1 で追加する（今入れると、デプロイ時にリソースが自動で作られる可能性があるため）
- [ ] ローカルで `/api/me` と静的配信・`sw.js` の再検証ヘッダーを確認する

### 0-7 認証（コードまで）
- [ ] Worker で `Cf-Access-Jwt-Assertion` を検証する（WebCrypto、チームの公開鍵を取得してキャッシュ、AUD・期限・発行元を確認）。単体テストあり
- [ ] Access の設定手順と、iPhone での確認手順を docs に書く。Cloudflare 側の設定と実機での確認は利用者が行う

## 確認が必要なこと

- デプロイの方法: GitHub に Cloudflare のチェックが出ていないので、手動の `wrangler deploy` と推測している
- Cloudflare 側の作業（Access の設定、デプロイ）は、こちらでは行わない

## レビュー

（完了後に記入）

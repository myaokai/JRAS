# インフラ設計

利用者は自分1人（多くても数人）を前提とする。一般公開はしない。

## 方針

1. **端末側を正とする（ローカルファースト）**: 解答・閲覧はすべて端末内で完結させ、オフラインでも使えるようにする。サーバーとの通信は記録の同期だけにする。
2. **コンテンツは静的ファイルのまま**: 問題・基準本文・過去問は年に1回程度しか変わらず、内容も全員共通なので、ビルドに同梱する。データベースには入れない。
3. **記録は「解答ログ」で持つ**: 「最新の状態」ではなく「いつ・どの問題に・どう答えたか」を順に記録し、復習の状態はログから計算する。複数の端末から追記しても食い違わない。
4. **Cloudflare の無料枠に収める**: 構成は Workers ＋ 静的アセット ＋ D1 ＋ R2 ＋ Access。

## 全体構成

```
iPhone / PC（PWA）
├─ Service Worker ……… アプリ本体・コンテンツJSONを事前キャッシュ（オフライン動作）
├─ IndexedDB ………… 解答ログ・未送信キュー・設定・保存済み音声の一覧
└─ Cache Storage ……… 保存を選んだ章の音声（mp3）
        │  HTTPS（同じドメイン）
        ▼
Cloudflare
├─ Access ……………… /api/* だけを保護（自分のメールアドレスのみ許可）
└─ Worker「jras」
    ├─ 静的アセット（dist/）……… /, /assets/*, /questions.json, /kijun.json, /past_exams/*
    ├─ /api/* ………………………… 同期API（Access の JWT を検証）→ D1「jras-db」
    └─ /audio/* ……………………… 音声配信（Range 対応）→ R2「jras-audio」
```

## コンポーネント別の設計

### 1. 配信：Workers ＋ 静的アセット（現状を維持）

| 項目 | 内容 |
|---|---|
| 現状 | `wrangler.jsonc` の Worker「jras」が `dist/` を配信している。`index.html` / `sw.js` などは Worker を通し、常に再検証させている（`worker/index.ts`） |
| 変更点 | `/api/*` と `/audio/*` の振り分けを Worker に足す。`run_worker_first` に `/api/*` と `/audio/*` を加える |
| デプロイ | 今の方法（Workers Builds の Git 連携か `wrangler deploy` か）を確認し、D1 のマイグレーション適用をデプロイ手順に入れる |

### 2. 学習記録：D1「jras-db」

**テーブル**

```sql
-- 解答ログ（追記のみ。更新・削除はしない）
CREATE TABLE answers (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT, -- サーバー側の通し番号（同期の位置として使う）
  id           TEXT NOT NULL UNIQUE,              -- 端末で採番した UUID（二重送信を防ぐ）
  user         TEXT NOT NULL,                     -- Access のメールアドレス
  question_id  TEXT NOT NULL,                     -- 例: "123", "R07_kanteishi_001", "anshou:5-3-1"
  mode         TEXT NOT NULL,                     -- anaume | kakomon | anshou | card | drill | snapshot
  result       INTEGER NOT NULL,                  -- 0=不正解/書けなかった 1=一部 2=正解/書けた
  choice       TEXT,                              -- 過去問で選んだ選択肢（任意）
  session_id   TEXT,                              -- 1セット（10問など）の単位。履歴の集計に使う
  answered_at  INTEGER NOT NULL,                  -- 端末で答えた時刻（UNIXミリ秒）
  device       TEXT NOT NULL,                     -- 送信元の端末ID
  payload      TEXT                               -- snapshot 用の JSON（後述）
);
CREATE INDEX answers_user_seq ON answers(user, seq);

-- 設定（試験日・1日の目標など）。後から書いた方を採用する
CREATE TABLE settings (
  user        TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,                      -- JSON
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user, key)
);
```

- 過去問の履歴や連続学習日数は、`answers` を集計すれば出せるので、テーブルを分けない。
- マイグレーションは `migrations/` に置き、`wrangler d1 migrations apply` で適用する。

**容量の見積もり**：1日100問を解いて1年で約3.6万行、1行200バイトとして約7MB。無料枠（5GB）に十分収まる。

### 3. 同期API

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/sync` | 未送信の解答と変更した設定を送り、サーバー側の新しいログを受け取る |
| GET | `/api/export` | 自分の全データを JSON で返す（バックアップ用） |
| GET | `/api/me` | ログインしているかの確認（同期ボタンの表示切り替えに使う） |

```jsonc
// POST /api/sync リクエスト
{ "cursor": 1520,                       // 前回受け取った最後の seq
  "answers": [{ "id": "uuid", "question_id": "R07_kanteishi_001", "mode": "kakomon",
                "result": 2, "choice": "3", "session_id": "uuid", "answered_at": 1791700000000, "device": "iphone-xxxx" }],
  "settings": [{ "key": "examDate.tantou", "value": "\"2027-05-09\"", "updated_at": 1791700000000 }] }

// レスポンス
{ "cursor": 1544,                       // 次回送る seq
  "answers": [ /* cursor より後の自分のログ（他の端末の分を含む） */ ],
  "settings": [ /* 自分の全設定 */ ] }
```

- 解答は `INSERT OR IGNORE`（`id` が重複したら無視）なので、再送しても二重にならない。
- 同期するタイミング：起動時、セット完了時、オンラインに戻ったとき（`online` イベント）、設定画面の「今すぐ同期」。
- 1回で送る件数に上限（例：500件）を設け、残りは続けて送る。

### 4. 認証：Cloudflare Access

| 項目 | 内容 |
|---|---|
| 保護する範囲 | `/api/*` だけ。アプリ本体と静的ファイルは保護しない（オフライン起動や Service Worker の更新を妨げないため） |
| ログイン方法 | One-time PIN（自分のメールアドレスに届くコード）。許可するのは自分のメールアドレスのみ |
| セッションの長さ | 長め（例：1か月）。切れたら設定画面に「再ログイン」を出す |
| Worker 側 | `Cf-Access-Jwt-Assertion` の JWT を、チームの公開鍵と AUD で検証し、メールアドレスを `user` として使う。ヘッダーをそのまま信用しない |
| 設定値 | チームのドメインと AUD を `wrangler.jsonc` の `vars` に置く（秘密情報ではない） |

**最初に検証すること**：iPhone のホーム画面版（standalone 表示）で、Access のログイン後にアプリへ戻り、`/api/*` 用の Cookie が保たれるか。ホーム画面版の Cookie は Safari と別に管理されるため、実機で確認する。

**設定手順**（Cloudflare のダッシュボードで行う。コード側は実装済み：`worker/access.ts`）

1. Zero Trust → Settings → Authentication で、ログイン方法に One-time PIN を有効にする。
2. Zero Trust → Access → Applications で「Self-hosted」のアプリを追加する。ドメインは Worker のホスト名、パスは `api/*`。セッションの長さは 1 か月。
3. ポリシーを1つ作る。Action は Allow、Include は Emails に自分のメールアドレスだけを入れる。
4. 作ったアプリの「Application Audience (AUD) Tag」と、チームドメイン（`https://<チーム名>.cloudflareaccess.com`）を、`wrangler.jsonc` の `vars`（`ACCESS_AUD`・`ACCESS_TEAM_DOMAIN`）に入れてデプロイする。
5. PC のブラウザで `/api/me` を開き、PIN でログインして `{"user":"<メールアドレス>"}` が返ることを確かめる。

**iPhone での確認手順**

1. Safari でアプリを開き、ホーム画面に追加する（すでに追加済みなら、そのまま使う）。
2. ホーム画面のアプリから「設定」→「サーバーとの接続」の「確認」を押す。最初は「ログインしていません」になる。
3. ログイン画面をアプリの中で開く方法を確かめる（段階2-9で再ログインの導線を作るときの前提になる）。
   - 試すこと：アプリ内のリンクで `/api/me` を開く → PIN でログイン → アプリに戻って「確認」を押すと「ログイン中」になるか。
   - アプリを一度終了して開き直しても「ログイン中」のままか。
4. 結果をこの節に書く。通らなければ、下の代替案（トークン方式）にする。

**うまくいかなかったときの代替案**：Worker のシークレットに長いランダムのトークンを置き、設定画面で一度入力してもらう（`Authorization: Bearer`）。自分用で、扱うのが学習記録だけなので許容できる。

### 5. 音声：R2「jras-audio」

| 項目 | 内容 |
|---|---|
| 置き場所 | `scripts/generate_audio.py` で作った章ごとの mp3 を R2 に置く。git とビルドには含めない（`data/audio/` は git の管理外） |
| 配信 | Worker の `/audio/<章>.mp3` で R2 から返す。Range リクエストに対応し、シークできるようにする。`Cache-Control` は長め（ファイル名に版を付けて更新する） |
| オフライン保存 | 「保存」を押した章だけ、ファイル全体を Cache Storage に入れる。再生時は Service Worker が Range リクエストに対してキャッシュから該当部分を返す |
| アップロード | `wrangler r2 object put` をスクリプトにまとめる |

### 6. 端末側の保存

| データ | 保存先 | 備考 |
|---|---|---|
| 解答ログ・未送信キュー | IndexedDB | localStorage は5MB程度が上限で、ログが年単位で増えると足りないため |
| 復習の状態（ボックス・次回日） | メモリ（ログから計算）＋ IndexedDB にキャッシュ | ログを `answered_at` の順に再生して計算する。計算は日本時間の日付で行う |
| 設定 | IndexedDB | 試験日、1日の目標、端末ID、同期の位置（cursor） |
| 表示のちょっとした状態 | localStorage | 最後に開いた節、選んだチップなど（消えても困らないもの） |

**問題IDの規則**（解答ログの `question_id`）

| 種類 | 形式 | 例 |
|---|---|---|
| 基準 穴埋め（既存） | `questions.json` の `id` を文字列にしたもの | `"123"` |
| 短答 過去問（既存） | `<年度>_<科目>_<3桁の問題番号>` | `"R07_kanteishi_001"` |
| 今後追加する科目・モード | `<科目またはモード>:<ID>` | `"anshou:5-3-1"`、`"minpo:42"` |

既存の2種類は学習記録を引き継ぐため変えない。新しく足すものは `:` を含む接頭辞を付けて、既存IDとぶつからないようにする。

### 7. 既存データの移行

今の localStorage（`problemRecord` / `habitRecord` / `kakomonHistory`）には「最新の状態」しかなく、解答ログにはできない。そのため、次のように移す。

1. 初回起動時、`problemRecord` の各問題を `mode: "snapshot"` のログ1件に変換する。`payload` にはボックス・次回日・最後の結果を入れる。
2. 復習状態を計算するときは、snapshot を初期値とし、その後のログを再生する。
3. `habitRecord` の連続日数と最長記録は、設定（`habit.legacy`）として引き継ぐ。`kakomonHistory` は直近5件しかないので、移さない。
4. 移行の前に、段階0-1の書き出しで JSON を保存しておく。

## バックアップと復旧

| 手段 | 内容 |
|---|---|
| 書き出し・読み込み | 設定画面から全データを JSON で保存・復元（段階0-1） |
| `/api/export` | サーバー上の全ログを JSON で取得 |
| D1 Time Travel | 一定期間内の任意の時点に D1 を戻せる（保持期間はプランによる。無料プランでも短期間は使える） |
| 端末から復元 | 解答ログは各端末にもあるため、D1 が消えても端末から送り直せば戻る |

## 費用

自分用の利用量なら、すべて無料枠に収まる見込み。

| サービス | 想定される使い方 | 無料枠の目安 |
|---|---|---|
| Workers | 1日数百リクエスト | 1日10万リクエスト |
| D1 | 1日数百行の書き込み、合計数十MB | 合計5GB、1日10万行の書き込み |
| R2 | 音声 数百MB | 10GB |
| Access | 1人 | 50人まで無料 |

無料枠の値は2026年10月時点の理解なので、導入時に Cloudflare の料金ページで確認する。

## 開発環境

| 環境 | 内容 |
|---|---|
| ローカル | `cp .dev.vars.example .dev.vars` のあと `npm run dev:worker`（ビルドして `wrangler dev`、http://localhost:8787）。Access の代わりに `.dev.vars` の `DEV_USER` でログイン扱いにする（`wrangler.jsonc` の `vars` には書かない）。D1・R2 は、実物を作る段階2-8・3-1でバインディングを足してから使う |
| 本番 | Worker「jras」。D1・R2 のバインディングを `wrangler.jsonc` に追加する |
| プレビュー環境 | 自分用なので作らない。必要になったら `env.preview` を足す |

## 実装の順序

[roadmap.md](roadmap.md) の段階に次のように組み込む。

| 段階 | 内容 |
|---|---|
| 0-1 | 書き出し・読み込み（今の localStorage のまま） |
| 0-2 | 端末側を解答ログ形式に切り替える（IndexedDB、snapshot での移行、ログからの復習状態の計算とテスト） |
| 0-6 | インフラの土台：デプロイ方法の確認、Worker の `/api/*`・`/audio/*` の振り分け、`/api/me` の仮実装、ローカル開発環境 |
| 0-7 | Access の実機検証：iPhone のホーム画面版でログインと `/api/me` の呼び出しが通るか。だめならトークン方式に切り替える |
| 2-8 | 同期のサーバー側：D1 のテーブル、`/api/sync`・`/api/export` |
| 2-9 | 同期の端末側：未送信キュー、同期のタイミング、設定画面の同期表示。短答式までにスマホとPCで記録を共有できるようにする |
| 3-1 | R2 と `/audio/*` の配信 |

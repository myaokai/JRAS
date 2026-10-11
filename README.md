# 不動産鑑定評価基準 穴埋め問題集

不動産鑑定評価基準（JRAS）の穴埋め問題集 PWA。
穴埋め部分をクリックすると答えが表示されます。

Vite + React + TypeScript 製。ビルド後は完全に静的なファイルになるため、
サーバーを常時起動しておく必要はありません（Cloudflare Pages 等にデプロイして使う想定）。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

起動後、表示されたURL（通常 `http://localhost:5173`）をブラウザで開いてください。

## ビルド・動作確認

```bash
npm run build      # dist/ に静的ファイルを生成
npm run preview    # ビルド結果をローカルで確認
```

## ファイル構成

```
JRAS/
├── index.html            # Viteのエントリ（<head>のメタ情報等）
├── src/
│   ├── main.tsx           # エントリポイント
│   ├── App.tsx            # 画面遷移・状態管理の中心
│   ├── types.ts           # 型定義
│   ├── constants.ts
│   ├── shuffle.ts
│   ├── questionText.ts    # 穴埋めテキストのパース
│   ├── style.css
│   ├── route.ts           # URLハッシュによる画面遷移
│   ├── backup.ts          # 学習データの書き出し・読み込み
│   ├── store/             # 解答ログ（IndexedDB）・ログからの集計・旧データの移行
│   ├── data/loadData.ts   # questions.json / past_exams のfetch
│   ├── hooks/             # useStudyLog（学習記録）
│   └── components/        # 画面コンポーネント（layout/ に共通の枠）
├── worker/                # Cloudflare Worker（配信・/api・Access の JWT 検証）
├── public/
│   ├── questions.json      # 穴埋め問題データ（章・節・問題）
│   ├── past_exams/         # 過去問データ（短答式）
│   └── icons/
├── scripts/
│   ├── validate_questions.js  # 問題データの整合性チェック
│   └── download_kanteishi.py  # 過去問PDFのダウンロード
└── vite.config.ts          # vite-plugin-pwa の設定含む
```

## 問題データの追加

[public/questions.json](public/questions.json) を編集します。

### 問題の追加

`"questions"` 配列にオブジェクトを追記します。

```json
{
  "id": 13,
  "chapter": 2,
  "section": 1,
  "text": "不動産の種別とは、{{土地}}の種別と{{建物}}の種別とに分けられる。"
}
```

| フィールド | 説明 |
|-----------|------|
| `id` | 一意の整数（既存の最大値+1） |
| `chapter` | 章番号（1〜12） |
| `section` | 節番号 |
| `text` | 問題文。`{{答え}}` で穴埋め箇所を指定 |

### 章の追加

`"chapters"` オブジェクトに章を追加します。

```json
"13": {
  "title": "新しい章のタイトル",
  "sections": {
    "1": "第１節 節のタイトル"
  }
}
```

## データ検証

`public/questions.json` / `public/past_exams/*.json` を編集したら、コミット前に検証スクリプトを実行してください。

```bash
node scripts/validate_questions.js
```

以下をチェックします。

- `questions.json`: id の重複、`chapter`/`section` が `chapters` に存在するか、`{{...}}` の対応
- `past_exams/*.json`: id の重複・命名規則(`{examId}_{3桁連番}`)、`answer` が `choices` に存在するか、`index.json` の `count` と実際の問題数の一致

## 過去問データの追加手順（次年度分など）

1. `scripts/download_kanteishi.py` で国土交通省サイトから過去問PDFを取得（`不動産鑑定士試験_過去問/`配下、gitignore対象）
2. PDFから問題・選択肢・正解を抽出し、既存の`public/past_exams/*.json`と同じ形式でJSON化
3. `public/past_exams/index.json` に新しいエントリを追加
4. `node scripts/validate_questions.js` で検証
5. `npm run build` でビルドが通ることを確認（`vite-plugin-pwa`がキャッシュを自動更新するため、手動でのバージョン管理は不要）

## PWA / Service Worker

`vite-plugin-pwa` がビルド時にService Worker・manifestを自動生成します
（コンテンツハッシュベースのキャッシュ更新のため、手動でのバージョン管理は不要です）。

## PWA としてインストール

モバイル・デスクトップどちらでもホーム画面に追加（インストール）できます。
オフラインでも動作します（初回アクセス後）。

## テスト・Worker のローカル実行

```bash
npm test             # 単体テスト（Vitest）
cp .dev.vars.example .dev.vars
npm run dev:worker   # ビルドして wrangler dev（http://localhost:8787、/api/me が使える）
```

## デプロイ

Cloudflare Workers（`wrangler.jsonc` の Worker「jras」）で配信します。`dist/` を静的アセットとして返し、
`/api/*`（同期API）と `/audio/*`（音声）は `worker/index.ts` で処理します。設計は [docs/infrastructure.md](docs/infrastructure.md)。

- ビルドコマンド: `npm run build`
- デプロイ: `main` へのマージで自動（Cloudflare Workers Builds）。手動で出すときは `npx wrangler deploy`

デプロイ後に発行されるHTTPS URLをiPhone Safariで開き、「ホーム画面に追加」してください。

## 動作確認スクリプト

`verify_checks.cjs`（Playwright）でクイズの主要フローを自動確認できます。

```bash
npm run build
npm run preview -- --port 8091 &
node verify_checks.cjs
```

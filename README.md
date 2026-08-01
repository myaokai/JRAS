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
│   ├── data/loadData.ts   # questions.json / past_exams のfetch
│   ├── hooks/              # localStorage永続化フック
│   └── components/         # 画面コンポーネント
├── public/
│   ├── questions.json      # 穴埋め問題データ（章・節・問題）
│   ├── past_exams/         # 過去問データ（短答式）
│   └── icons/
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

## PWA / Service Worker

`vite-plugin-pwa` がビルド時にService Worker・manifestを自動生成します
（コンテンツハッシュベースのキャッシュ更新のため、手動でのバージョン管理は不要です）。

## PWA としてインストール

モバイル・デスクトップどちらでもホーム画面に追加（インストール）できます。
オフラインでも動作します（初回アクセス後）。

## デプロイ

Cloudflare Pages 等の静的ホスティングにデプロイします。

- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`

デプロイ後に発行されるHTTPS URLをiPhone Safariで開き、「ホーム画面に追加」してください。

## 動作確認スクリプト

`verify_checks.cjs`（Playwright）でクイズの主要フローを自動確認できます。

```bash
npm run build
npm run preview -- --port 8091 &
node verify_checks.cjs
```

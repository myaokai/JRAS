# 不動産鑑定評価基準 穴埋め問題集

不動産鑑定評価基準（JRAS）の穴埋め問題集 PWA。
穴埋め部分をクリックすると答えが表示されます。

## サーバーの起動

静的HTTPサーバーであれば何でも使えます。

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

起動後、ブラウザで `http://localhost:8000` を開いてください。

> **注意:** `file://` で直接開くと `fetch` によるデータ読み込みが失敗するため、必ずHTTPサーバー経由でアクセスしてください。

## ファイル構成

```
JRAS/
├── index.html        # メインHTML
├── app.js            # アプリケーションロジック
├── questions.json    # 問題データ（章・節・問題）
├── style.css         # スタイル
├── sw.js             # Service Worker（オフライン対応）
└── manifest.json     # PWAマニフェスト
```

## 問題データの追加

[questions.json](questions.json) を編集します。

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

## Service Worker のキャッシュ更新

`questions.json` などのファイルを変更した場合、[sw.js](sw.js) の `CACHE_NAME` のバージョンを上げると、ブラウザが新しいキャッシュを取得します。

```js
const CACHE_NAME = 'quiz-app-v0.0.3'; // バージョンを上げる
```

## PWA としてインストール

モバイル・デスクトップどちらでもホーム画面に追加（インストール）できます。
オフラインでも動作します（初回アクセス後）。

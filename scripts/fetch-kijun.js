#!/usr/bin/env node
//
// 不動産鑑定評価基準PDFからテキストを抽出し、穴埋め問題のベースとなるJSONを生成する
//
// 使い方:
//   1. npm install pdf-parse  (初回のみ)
//   2. node scripts/fetch-kijun.js
//
// 出力: data/kijun-text.json（章・節ごとに分割されたテキスト）
//

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PDF_URL = 'https://www.mlit.go.jp/common/001204083.pdf';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const PDF_PATH = path.join(OUTPUT_DIR, 'kijun.pdf');
const TEXT_JSON_PATH = path.join(OUTPUT_DIR, 'kijun-text.json');

const CHAPTER_PATTERNS = {
  souron: [
    { chapter: 1, regex: /第[１1]章\s*不動産の鑑定評価に関する基本的考察/ },
    { chapter: 2, regex: /第[２2]章\s*不動産の種別及び類型/ },
    { chapter: 3, regex: /第[３3]章\s*不動産の価格を形成する要因/ },
    { chapter: 4, regex: /第[４4]章\s*不動産の価格に関する諸原則/ },
    { chapter: 5, regex: /第[５5]章\s*鑑定評価の基本的事項/ },
    { chapter: 6, regex: /第[６6]章\s*地域分析及び個別分析/ },
    { chapter: 7, regex: /第[７7]章\s*鑑定評価の方式/ },
    { chapter: 8, regex: /第[８8]章\s*鑑定評価の手順/ },
    { chapter: 9, regex: /第[９9]章\s*鑑定評価報告書/ },
  ],
  kakuron: [
    { chapter: 10, regex: /第[１1]章\s*価格に関する鑑定評価/ },
    { chapter: 11, regex: /第[２2]章\s*賃料に関する鑑定評価/ },
    { chapter: 12, regex: /第[３3]章\s*証券化対象不動産/ },
  ]
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`[ダウンロード] ${url}`);
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function extractText(pdfPath) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    console.error('[エラー] pdf-parse がインストールされていません');
    console.error('  npm install pdf-parse を実行してください');
    process.exit(1);
  }

  console.log('[抽出] PDFからテキストを抽出中...');
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return data.text;
}

function splitIntoChapters(text) {
  const result = {};
  const lines = text.split('\n');

  let currentPart = '';
  let currentChapter = null;
  let currentSection = null;
  let buffer = [];

  const sectionRegex = /第[１２３４５６７８９０\d]+節\s+(.+)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^総\s*論/.test(trimmed)) { currentPart = 'souron'; continue; }
    if (/^各\s*論/.test(trimmed)) { currentPart = 'kakuron'; continue; }

    const patterns = currentPart ? CHAPTER_PATTERNS[currentPart] : [...CHAPTER_PATTERNS.souron, ...CHAPTER_PATTERNS.kakuron];
    let matched = false;
    for (const p of patterns) {
      if (p.regex.test(trimmed)) {
        if (currentChapter && buffer.length > 0) {
          const key = `${currentChapter}-${currentSection || 0}`;
          if (!result[currentChapter]) result[currentChapter] = { sections: {} };
          if (currentSection) {
            result[currentChapter].sections[currentSection] = (result[currentChapter].sections[currentSection] || '') + buffer.join('\n');
          } else {
            result[currentChapter].intro = buffer.join('\n');
          }
        }
        currentChapter = p.chapter;
        currentSection = null;
        buffer = [];
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const secMatch = trimmed.match(sectionRegex);
    if (secMatch && currentChapter) {
      if (buffer.length > 0) {
        if (!result[currentChapter]) result[currentChapter] = { sections: {} };
        if (currentSection) {
          result[currentChapter].sections[currentSection] = (result[currentChapter].sections[currentSection] || '') + buffer.join('\n');
        } else {
          result[currentChapter].intro = buffer.join('\n');
        }
      }
      const secNum = trimmed.match(/第([１２３４５６７８９０\d]+)節/);
      currentSection = secNum ? secNum[1].replace(/[１２３４５６７８９０]/g, c => '１２３４５６７８９０'.indexOf(c) + 1) : null;
      buffer = [];
      continue;
    }

    buffer.push(trimmed);
  }

  if (currentChapter && buffer.length > 0) {
    if (!result[currentChapter]) result[currentChapter] = { sections: {} };
    if (currentSection) {
      result[currentChapter].sections[currentSection] = (result[currentChapter].sections[currentSection] || '') + buffer.join('\n');
    } else {
      result[currentChapter].intro = buffer.join('\n');
    }
  }

  return result;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (!fs.existsSync(PDF_PATH)) {
    try {
      await download(PDF_URL, PDF_PATH);
      console.log(`[完了] PDF保存先: ${PDF_PATH}`);
    } catch (err) {
      console.error(`[エラー] ダウンロード失敗: ${err.message}`);
      console.error('手動でPDFをダウンロードして以下に配置してください:');
      console.error(`  ${PDF_PATH}`);
      console.error(`  URL: ${PDF_URL}`);
      process.exit(1);
    }
  } else {
    console.log(`[スキップ] PDF既存: ${PDF_PATH}`);
  }

  const text = await extractText(PDF_PATH);
  console.log(`[抽出] テキスト長: ${text.length}文字`);

  const chapters = splitIntoChapters(text);
  fs.writeFileSync(TEXT_JSON_PATH, JSON.stringify(chapters, null, 2), 'utf-8');
  console.log(`[完了] テキストJSON保存先: ${TEXT_JSON_PATH}`);
  console.log('[完了] 次のステップ: node scripts/generate-questions.js で穴埋め問題を生成');
})();

#!/usr/bin/env node
//
// data/kijun-text.json から穴埋め問題を生成し questions.js に追加する
//
// 使い方:
//   node scripts/generate-questions.js
//
// 前提:
//   - data/kijun-text.json が存在すること（fetch-kijun.js で生成）
//   - 問題テキストを手動で用意する場合は data/kijun-text.json を直接編集可能
//
// 出力: data/new-questions.js（questions.js に追記する用の問題データ）
//
// 注意:
//   このスクリプトは基準テキストから重要語句を自動検出して穴埋めにする。
//   自動検出の精度には限界があるため、生成後に手動で確認・調整することを推奨。
//

const fs = require('fs');
const path = require('path');

const TEXT_JSON_PATH = path.join(__dirname, '..', 'data', 'kijun-text.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'new-questions.js');

// 穴埋めにすべき重要語句パターン（正規表現）
// 基準テキスト特有の専門用語や重要概念を優先的に穴埋めにする
const IMPORTANT_TERMS = [
  // 不動産関連の基本概念
  /土地とその定着物/g,
  /有用性/g,
  /経済価値/g,
  /市場価値/g,
  /適正な価格/g,
  /貨幣額/g,
  /価格秩序/g,

  // 価格形成要因
  /一般的要因/g,
  /地域要因/g,
  /個別的要因/g,
  /自然的要因/g,
  /社会的要因/g,
  /経済的要因/g,
  /行政的要因/g,

  // 地域・個別分析
  /近隣地域/g,
  /類似地域/g,
  /同一需給圏/g,
  /標準的使用/g,
  /最有効使用/g,

  // 鑑定評価の手法
  /原価法/g,
  /取引事例比較法/g,
  /収益還元法/g,
  /直接還元法/g,
  /DCF法/g,
  /積算法/g,
  /賃貸事例比較法/g,
  /収益分析法/g,
  /開発法/g,

  // 価格・賃料の種類
  /正常価格/g,
  /限定価格/g,
  /特定価格/g,
  /特殊価格/g,
  /正常賃料/g,
  /限定賃料/g,
  /継続賃料/g,

  // 価格に関する諸原則
  /需要と供給の原則/g,
  /変動の原則/g,
  /代替の原則/g,
  /最有効使用の原則/g,
  /均衡の原則/g,
  /収益逓増及び逓減の原則/g,
  /寄与の原則/g,
  /適合の原則/g,
  /競争の原則/g,
  /予測の原則/g,

  // その他の重要概念
  /再調達原価/g,
  /減価修正/g,
  /取引事例/g,
  /事情補正/g,
  /時点修正/g,
  /地域要因の比較/g,
  /個別的要因の比較/g,
  /純収益/g,
  /還元利回り/g,
  /割引率/g,
  /復帰価格/g,
  /試算価格/g,
  /試算賃料/g,
  /鑑定評価額/g,

  // 不動産の種別・類型
  /宅地/g,
  /農地/g,
  /林地/g,
  /更地/g,
  /建付地/g,
  /借地権/g,
  /底地/g,
  /区分地上権/g,
  /自用の建物及びその敷地/g,
  /貸家及びその敷地/g,
  /借地権付建物/g,
  /区分所有建物及びその敷地/g,
];

function loadTextData() {
  if (!fs.existsSync(TEXT_JSON_PATH)) {
    console.error(`[エラー] ${TEXT_JSON_PATH} が見つかりません`);
    console.error('  先に node scripts/fetch-kijun.js を実行してください');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TEXT_JSON_PATH, 'utf-8'));
}

function splitIntoSentences(text) {
  // 。で文を分割し、短すぎるものは前の文と結合
  const raw = text.split(/。/).filter(s => s.trim().length > 0);
  const sentences = [];
  let buffer = '';

  for (const s of raw) {
    const trimmed = s.trim();
    if (buffer) {
      buffer += '。' + trimmed;
    } else {
      buffer = trimmed;
    }

    // 十分な長さがあれば文として確定
    if (buffer.length >= 30) {
      sentences.push(buffer + '。');
      buffer = '';
    }
  }
  if (buffer) {
    if (sentences.length > 0) {
      sentences[sentences.length - 1] += buffer + '。';
    } else {
      sentences.push(buffer + '。');
    }
  }

  return sentences;
}

function createBlankQuestion(sentence) {
  let result = sentence;
  let blankCount = 0;

  for (const pattern of IMPORTANT_TERMS) {
    // 各パターンのlastIndexをリセット
    pattern.lastIndex = 0;

    if (pattern.test(result)) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, (match) => {
        blankCount++;
        return `{{${match}}}`;
      });
    }

    // 穴埋めが多すぎると問題として成立しない
    if (blankCount >= 8) break;
  }

  return { text: result, blankCount };
}

function generateQuestions(textData) {
  const questions = [];
  let nextId = 13; // 既存の最大id=12の次から

  for (const [chapterStr, chapterData] of Object.entries(textData)) {
    const chapter = parseInt(chapterStr);

    // introテキストから問題生成
    if (chapterData.intro) {
      const sentences = splitIntoSentences(chapterData.intro);
      for (const sentence of sentences) {
        const { text, blankCount } = createBlankQuestion(sentence);
        if (blankCount >= 2 && sentence.length >= 40) {
          questions.push({
            id: nextId++,
            chapter,
            section: 0,
            text
          });
        }
      }
    }

    // 各節のテキストから問題生成
    if (chapterData.sections) {
      for (const [sectionStr, sectionText] of Object.entries(chapterData.sections)) {
        const section = parseInt(sectionStr);
        const sentences = splitIntoSentences(sectionText);
        for (const sentence of sentences) {
          const { text, blankCount } = createBlankQuestion(sentence);
          if (blankCount >= 2 && sentence.length >= 40) {
            questions.push({
              id: nextId++,
              chapter,
              section,
              text
            });
          }
        }
      }
    }
  }

  return questions;
}

function formatQuestionsJS(questions) {
  const lines = [
    '// 自動生成された問題データ',
    '// 生成日: ' + new Date().toISOString().split('T')[0],
    '// 注意: 内容を確認・調整してから questions.js に追加してください',
    '//',
    '// questions.js の questions 配列の末尾に以下を追加:',
    '',
    'const newQuestions = [',
  ];

  for (const q of questions) {
    lines.push('    {');
    lines.push(`        id: ${q.id},`);
    lines.push(`        chapter: ${q.chapter},`);
    lines.push(`        section: ${q.section},`);
    lines.push(`        text: ${JSON.stringify(q.text)}`);
    lines.push('    },');
  }

  lines.push('];');
  lines.push('');
  lines.push(`// 合計: ${questions.length}問`);

  return lines.join('\n');
}

// メイン処理
const textData = loadTextData();
console.log(`[読込] ${Object.keys(textData).length}章分のテキストデータ`);

const questions = generateQuestions(textData);
console.log(`[生成] ${questions.length}問の穴埋め問題を生成`);

// 章別の集計
const byChapter = {};
for (const q of questions) {
  byChapter[q.chapter] = (byChapter[q.chapter] || 0) + 1;
}
console.log('\n[章別内訳]');
for (const [ch, count] of Object.entries(byChapter)) {
  console.log(`  第${ch}章: ${count}問`);
}

const output = formatQuestionsJS(questions);
fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
console.log(`\n[完了] 出力先: ${OUTPUT_PATH}`);
console.log('[次のステップ]');
console.log('  1. data/new-questions.js の内容を確認');
console.log('  2. 穴埋め箇所（{{}}で囲まれた部分）が適切か確認・調整');
console.log('  3. 問題として成立するか確認（穴埋めが多すぎないか等）');
console.log('  4. questions.js の questions 配列に追加');

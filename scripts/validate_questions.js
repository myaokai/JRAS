#!/usr/bin/env node
// public/questions.json と public/past_exams/*.json の整合性を検証する。
// 新しいデータを追加した際に `node scripts/validate_questions.js` で実行する。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC_DIR = path.join(ROOT, 'public')

const errors = []

function readJson(relPath) {
  const abs = path.join(PUBLIC_DIR, relPath)
  return JSON.parse(fs.readFileSync(abs, 'utf-8'))
}

function checkBlankTags(text, label) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      if (depth > 0) errors.push(`${label}: {{ が入れ子になっています`)
      depth++
      i++
    } else if (text.startsWith('}}', i)) {
      if (depth === 0) errors.push(`${label}: 対応する {{ のない }} があります`)
      else depth--
      i++
    }
  }
  if (depth > 0) errors.push(`${label}: 閉じられていない {{ があります`)
}

function validateQuestionsJson() {
  const data = readJson('questions.json')
  const seenIds = new Set()

  for (const q of data.questions) {
    const label = `questions.json (id=${q.id})`
    if (seenIds.has(q.id)) errors.push(`${label}: idが重複しています`)
    seenIds.add(q.id)

    const chapter = data.chapters[String(q.chapter)]
    if (!chapter) {
      errors.push(`${label}: chapter=${q.chapter} が chapters に存在しません`)
    } else if (!(String(q.section) in chapter.sections)) {
      errors.push(`${label}: section=${q.section} が chapter ${q.chapter} に存在しません`)
    }

    checkBlankTags(q.text, label)
  }

  console.log(`questions.json: ${data.questions.length}問を検証しました`)
  return data
}

// 節ごとの穴埋め問題の下限。本文が短い節（1〜2文）は1問でよい。
const MIN_QUESTIONS = 3
const SHORT_SECTION_CHARS = 300

// questions.json の章・節が kijun.json に本文付きで収録されているか、節ごとの問題数が足りているかを確かめる
function validateCoverage(questionsData) {
  const kijun = readJson('kijun.json')

  for (const [chapterId, chapter] of Object.entries(questionsData.chapters)) {
    const kChapter = kijun[chapterId]
    if (!kChapter) {
      errors.push(`kijun.json: 章 ${chapterId}（${chapter.title}）が収録されていません`)
      continue
    }
    for (const sectionId of Object.keys(chapter.sections)) {
      // 節のない章（総論第4章）は section "0" とし、章の前文を本文とみなす
      const body = sectionId === '0' ? kChapter.intro : kChapter.sections[sectionId]?.text
      const label = `${chapter.title} ${sectionId === '0' ? '' : `第${sectionId}節`}`.trim()
      if (!body) {
        errors.push(`kijun.json: ${label} の本文が空です`)
        continue
      }
      const min = body.length < SHORT_SECTION_CHARS ? 1 : MIN_QUESTIONS
      const count = questionsData.questions.filter(
        (q) => String(q.chapter) === chapterId && String(q.section) === sectionId,
      ).length
      if (count < min) errors.push(`questions.json: ${label} の問題が${count}問です（${min}問以上必要）`)
    }
  }

  console.log(`kijun.json: ${Object.keys(questionsData.chapters).length}章の本文と節ごとの問題数を検証しました`)
}

// 任意項目 explanation（文字列）と kijunRef（kijun.json にある章・節）を確かめる（FR-11・FR-12）
function checkOptionalFields(item, label, kijun) {
  if (item.explanation !== undefined && (typeof item.explanation !== 'string' || item.explanation.trim() === '')) {
    errors.push(`${label}: explanation は空でない文字列にしてください`)
  }
  const ref = item.kijunRef
  if (ref === undefined) return
  const chapter = typeof ref?.chapter === 'string' ? kijun[ref.chapter] : undefined
  if (!chapter) {
    errors.push(`${label}: kijunRef.chapter=${ref?.chapter} が kijun.json にありません`)
  } else if (ref.section !== undefined && !chapter.sections[ref.section]) {
    errors.push(`${label}: kijunRef.section=${ref.section} が kijun.json の章 ${ref.chapter} にありません`)
  }
}

function validatePastExams() {
  const index = readJson('past_exams/index.json')
  const kijun = readJson('kijun.json')
  let explained = 0
  const globalIds = new Set()

  for (const exam of index) {
    const data = readJson(exam.file)
    const localIds = new Set()

    if (data.questions.length !== exam.count) {
      errors.push(
        `${exam.id}: index.jsonのcount(${exam.count})と実際の問題数(${data.questions.length})が一致しません`,
      )
    }

    for (const q of data.questions) {
      const label = `${exam.file} (id=${q.id})`

      if (localIds.has(q.id)) errors.push(`${label}: idがファイル内で重複しています`)
      localIds.add(q.id)

      if (globalIds.has(q.id)) errors.push(`${label}: idが他の試験ファイルと重複しています`)
      globalIds.add(q.id)

      const expectedId = `${exam.id}_${String(q.number).padStart(3, '0')}`
      if (q.id !== expectedId) {
        errors.push(`${label}: idが命名規則(${expectedId})と一致しません`)
      }

      const answerKeys = q.choices.map((c) => c.key)
      if (!answerKeys.includes(q.answer)) {
        errors.push(`${label}: answer=${q.answer} が choices に存在しません`)
      }

      checkOptionalFields(q, label, kijun)
      q.choices.forEach((c) => checkOptionalFields(c, `${label} 選択肢${c.key}`, kijun))
      if (q.explanation) explained++
    }
  }

  console.log(`past_exams: ${index.length}ファイル・${globalIds.size}問を検証しました（解説あり ${explained}問）`)
}

validateCoverage(validateQuestionsJson())
validatePastExams()

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length}件のエラーが見つかりました:`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}

console.log('\n✓ すべてのチェックを通過しました')

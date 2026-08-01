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
}

function validatePastExams() {
  const index = readJson('past_exams/index.json')
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
    }
  }

  console.log(`past_exams: ${index.length}ファイル・${globalIds.size}問を検証しました`)
}

validateQuestionsJson()
validatePastExams()

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length}件のエラーが見つかりました:`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}

console.log('\n✓ すべてのチェックを通過しました')

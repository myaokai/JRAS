export interface Chapter {
  title: string
  sections: Record<string, string>
}

export interface AnaumeQuestion {
  id: number
  chapter: number
  section: number
  text: string
}

export interface QuestionsData {
  chapters: Record<string, Chapter>
  questions: AnaumeQuestion[]
}

export interface ExamMeta {
  id: string
  label: string
  file: string
  count: number
}

// 基準本文の該当箇所（kijun.json の章・節のキー）。節のない章は section を省く
export interface KijunRef {
  chapter: string
  section?: string
}

export interface KakomonChoice {
  key: string
  text: string
  explanation?: string
  kijunRef?: KijunRef
}

export interface KakomonQuestion {
  id: string
  number: number
  instruction: string
  choices: KakomonChoice[]
  answer: string
  explanation?: string
  kijunRef?: KijunRef
  _examLabel?: string
}

export interface ExamData {
  meta: {
    year: string
    subject: string
    exam_type: string
    source_pdf: string
    answer_pdf: string
  }
  questions: KakomonQuestion[]
}

export type Mode = 'anaume' | 'kakomon' | 'textbook'

export interface KijunSection {
  title: string
  text: string
}

export interface KijunChapter {
  title: string
  intro: string
  sections: Record<string, KijunSection>
}

export type KijunData = Record<string, KijunChapter>

export interface HabitRecord {
  lastStudyDate: string
  currentStreak: number
  longestStreak: number
  todayDate: string
  todayCount: number
}

export interface ProblemRecordEntry {
  box: number
  dueDate: string
  lastResult: boolean
  ts: number
}

export type ProblemRecord = Record<string, ProblemRecordEntry>

export interface KakomonHistoryEntry {
  timestamp: number
  dateStr: string
  examIds: string[]
  total: number
  correct: number
}

export type KakomonHistory = KakomonHistoryEntry[]

// 暗唱チェックの単位（public/anshou.json。scripts/extract_anshou.py で基準本文から作る）
export interface AnshouUnit {
  id: string
  chapter: number
  section: number
  // 「総論 第５章 第３節 ＞ 価格」のような位置
  context: string
  title: string
  // お題（例「限定価格とは」）
  prompt: string
  // 基準の本文（手を加えない）
  text: string
}

export interface AnshouData {
  units: AnshouUnit[]
}

export function isAnshouUnit(item: AnaumeQuestion | KakomonQuestion | AnshouUnit): item is AnshouUnit {
  return 'prompt' in item
}

export function isKakomonQuestion(
  item: AnaumeQuestion | KakomonQuestion | AnshouUnit,
): item is KakomonQuestion {
  return 'choices' in item
}

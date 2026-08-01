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

export interface KakomonChoice {
  key: string
  text: string
}

export interface KakomonQuestion {
  id: string
  number: number
  instruction: string
  choices: KakomonChoice[]
  answer: string
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

export type Mode = 'anaume' | 'kakomon'

export interface QuizProgress {
  completedQuestions: number[]
}

export interface ProblemRecordEntry {
  lastCorrect: boolean
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

export function isKakomonQuestion(
  item: AnaumeQuestion | KakomonQuestion,
): item is KakomonQuestion {
  return 'choices' in item
}

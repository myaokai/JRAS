import type { ExamData, ExamMeta, KijunData, QuestionsData } from '../types'

export async function loadQuestionsData(): Promise<QuestionsData> {
  const res = await fetch('./questions.json')
  return res.json()
}

export async function loadKijunData(): Promise<KijunData> {
  const res = await fetch('./kijun.json')
  return res.json()
}

export async function loadExamIndex(): Promise<ExamMeta[]> {
  try {
    const res = await fetch('./past_exams/index.json')
    return await res.json()
  } catch (e) {
    console.warn('過去問インデックスの読み込みに失敗しました', e)
    return []
  }
}

export async function loadExamData(exam: ExamMeta): Promise<ExamData | null> {
  try {
    const res = await fetch(`./${exam.file}`)
    const data: ExamData = await res.json()
    data.questions.forEach((q) => {
      q._examLabel = exam.label
    })
    return data
  } catch (e) {
    console.error(`過去問の読み込みに失敗しました: ${exam.id}`, e)
    return null
  }
}

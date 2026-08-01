import { useLocalStorageState } from './useLocalStorageState'
import type { QuizProgress } from '../types'

const STORAGE_KEY = 'quizProgress'

export function useQuizProgress() {
  const [progress, setProgress] = useLocalStorageState<QuizProgress>(STORAGE_KEY, {
    completedQuestions: [],
  })

  const markCompleted = (questionId: number) => {
    setProgress((prev) =>
      prev.completedQuestions.includes(questionId)
        ? prev
        : { completedQuestions: [...prev.completedQuestions, questionId] },
    )
  }

  return { completedQuestions: progress.completedQuestions, markCompleted }
}

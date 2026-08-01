import { useMemo } from 'react'
import { useLocalStorageState } from './useLocalStorageState'
import { isDue, nextEntry } from '../leitner'
import type { ProblemRecord } from '../types'

const PROBLEM_RECORD_KEY = 'problemRecord'

export function useProblemRecord() {
  const [problemRecord, setProblemRecord] = useLocalStorageState<ProblemRecord>(
    PROBLEM_RECORD_KEY,
    {},
  )

  const updateProblemRecord = (questionId: string, correct: boolean) => {
    setProblemRecord((prev) => ({
      ...prev,
      [questionId]: nextEntry(prev[questionId], correct),
    }))
  }

  const isQuestionDue = (questionId: string) => isDue(problemRecord[questionId])

  const dueIds = useMemo(
    () => Object.keys(problemRecord).filter((id) => isDue(problemRecord[id])),
    [problemRecord],
  )

  return { problemRecord, updateProblemRecord, isQuestionDue, dueIds }
}

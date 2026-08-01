import { useMemo } from 'react'
import { useLocalStorageState } from './useLocalStorageState'
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
      [questionId]: { lastCorrect: correct, ts: Date.now() },
    }))
  }

  const wrongIds = useMemo(
    () =>
      Object.entries(problemRecord)
        .filter(([, r]) => !r.lastCorrect)
        .map(([id]) => id),
    [problemRecord],
  )

  return { problemRecord, updateProblemRecord, wrongIds }
}

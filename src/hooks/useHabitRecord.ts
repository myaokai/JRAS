import { useLocalStorageState } from './useLocalStorageState'
import { EMPTY_HABIT_RECORD, recordStudy } from '../habit'
import type { HabitRecord } from '../types'

const HABIT_RECORD_KEY = 'habitRecord'

export function useHabitRecord() {
  const [habitRecord, setHabitRecord] = useLocalStorageState<HabitRecord>(
    HABIT_RECORD_KEY,
    EMPTY_HABIT_RECORD,
  )

  const recordStudyAction = () => setHabitRecord((prev) => recordStudy(prev))

  return { habitRecord, recordStudyAction }
}

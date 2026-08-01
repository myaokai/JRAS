import { useLocalStorageState } from './useLocalStorageState'
import type { KakomonHistory } from '../types'

const KAKOMON_HISTORY_KEY = 'kakomonHistory'
const MAX_HISTORY = 5

export function useKakomonHistory() {
  const [history, setHistory] = useLocalStorageState<KakomonHistory>(
    KAKOMON_HISTORY_KEY,
    [],
  )

  const addResult = (examIds: string[], total: number, correct: number) => {
    const entry = {
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }),
      examIds,
      total,
      correct,
    }
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY))
  }

  return { history, addResult }
}

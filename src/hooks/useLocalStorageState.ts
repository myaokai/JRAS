import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initialValue
    } catch (e) {
      console.error(`${key} の読み込みに失敗しました`, e)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (e) {
      console.error(`${key} の保存に失敗しました`, e)
    }
  }, [key, state])

  return [state, setState]
}

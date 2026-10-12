import { useCallback, useEffect, useState } from 'react'

// 画面は URL のハッシュで表す（例 #/study/anaume）。スマホの「戻る」で前の画面に戻れる
export type Route =
  | { name: 'home' }
  | { name: 'study' }
  | { name: 'study-anaume' }
  | { name: 'study-kakomon' }
  | { name: 'study-drill' }
  | { name: 'quiz' }
  | { name: 'result' }
  // fromQuiz: 出題中・計算ドリルの基準リンクから開いた（戻るボタンで問題に戻る）
  | { name: 'textbook'; chapterId?: string; sectionId?: string; fromQuiz?: boolean }
  | { name: 'records' }
  | { name: 'settings' }

export type Tab = 'home' | 'study' | 'textbook' | 'records' | 'settings'

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case undefined:
      return { name: 'home' }
    case 'study':
      if (parts[1] === 'anaume') return { name: 'study-anaume' }
      if (parts[1] === 'kakomon') return { name: 'study-kakomon' }
      if (parts[1] === 'drill') return { name: 'study-drill' }
      return { name: 'study' }
    case 'quiz':
      return { name: 'quiz' }
    case 'result':
      return { name: 'result' }
    case 'textbook':
      return {
        name: 'textbook',
        chapterId: parts[1],
        sectionId: parts[2],
        ...(new URLSearchParams(query).get('from') === 'quiz' && { fromQuiz: true }),
      }
    case 'records':
      return { name: 'records' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'home' }
  }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'study-anaume':
      return '#/study/anaume'
    case 'study-kakomon':
      return '#/study/kakomon'
    case 'study-drill':
      return '#/study/drill'
    case 'textbook':
      return ['#/textbook', route.chapterId, route.sectionId]
        .filter((p) => p !== undefined)
        .map((p, i) => (i === 0 ? p : encodeURIComponent(p as string)))
        .join('/') + (route.fromQuiz ? '?from=quiz' : '')
    default:
      return `#/${route.name}`
  }
}

export function tabOf(route: Route): Tab {
  switch (route.name) {
    case 'study':
    case 'study-anaume':
    case 'study-kakomon':
    case 'study-drill':
    case 'quiz':
    case 'result':
      return 'study'
    default:
      return route.name
  }
}

export type Navigate = (route: Route, options?: { replace?: boolean }) => void

export function useHashRoute(): [Route, Navigate] {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback<Navigate>((next, options) => {
    const hash = toHash(next)
    if (options?.replace) {
      // replaceState では hashchange が起きないので、自分で反映する
      history.replaceState(null, '', hash)
      setRoute(parseHash(hash))
    } else if (location.hash !== hash) {
      location.hash = hash
    }
    window.scrollTo(0, 0)
  }, [])

  return [route, navigate]
}

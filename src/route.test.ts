import { describe, expect, it } from 'vitest'
import { parseHash, tabOf, toHash, type Route } from './route'

describe('route', () => {
  it.each<[string, Route]>([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/study', { name: 'study' }],
    ['#/study/anaume', { name: 'study-anaume' }],
    ['#/study/kakomon', { name: 'study-kakomon' }],
    ['#/quiz', { name: 'quiz' }],
    ['#/textbook', { name: 'textbook', chapterId: undefined, sectionId: undefined }],
    ['#/textbook/5/2', { name: 'textbook', chapterId: '5', sectionId: '2' }],
    ['#/textbook/8/4?from=quiz', { name: 'textbook', chapterId: '8', sectionId: '4', fromQuiz: true }],
    ['#/settings', { name: 'settings' }],
    ['#/unknown', { name: 'home' }],
  ])('%s を解釈する', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })

  it('ハッシュとの往復で同じ画面になる', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'study-kakomon' },
      { name: 'textbook', chapterId: '3' },
      { name: 'textbook', chapterId: '3', sectionId: '1' },
      { name: 'textbook', chapterId: '4', fromQuiz: true },
      { name: 'records' },
    ]
    for (const r of routes) expect(parseHash(toHash(r))).toMatchObject(r)
  })

  it('出題中・結果は「学習」タブに属する', () => {
    expect(tabOf({ name: 'quiz' })).toBe('study')
    expect(tabOf({ name: 'textbook', chapterId: '1' })).toBe('textbook')
  })
})

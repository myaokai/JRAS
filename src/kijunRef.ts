import type { KijunData, KijunRef } from './types'

// 「総論 第８章 第４節」のような短い表示名。kijun.json にない参照は null
export function kijunRefLabel(kijun: KijunData, ref: KijunRef): string | null {
  const chapter = kijun[ref.chapter]
  if (!chapter) return null
  const chapterLabel = chapter.title.split(' ').slice(0, 2).join(' ')
  if (!ref.section) return chapterLabel
  const section = chapter.sections[ref.section]
  if (!section) return null
  return `${chapterLabel} ${section.title.split(' ')[0]}`
}

// 穴埋め問題の章・節を参照にする（総論第4章などの section 0 は章だけ）
export function refOf(chapter: number, section: number): KijunRef {
  return section === 0 ? { chapter: String(chapter) } : { chapter: String(chapter), section: String(section) }
}

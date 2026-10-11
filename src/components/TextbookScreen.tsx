import { useMemo } from 'react'
import type { KijunData } from '../types'
import type { Navigate } from '../route'
import { AppShell } from './layout/AppShell'

interface Props {
  navigate: Navigate
  kijunData: KijunData
  chapterId?: string
  sectionId?: string
}

interface Leaf {
  chapterId: string
  sectionId: string | null
}

function sortedIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => Number(a) - Number(b))
}

function buildLeaves(kijunData: KijunData): Leaf[] {
  const leaves: Leaf[] = []
  for (const chapterId of sortedIds(Object.keys(kijunData))) {
    const sectionIds = sortedIds(Object.keys(kijunData[chapterId].sections))
    if (sectionIds.length === 0) {
      leaves.push({ chapterId, sectionId: null })
    } else {
      sectionIds.forEach((sectionId) => leaves.push({ chapterId, sectionId }))
    }
  }
  return leaves
}

function leafTitle(kijunData: KijunData, leaf: Leaf): string {
  const chapter = kijunData[leaf.chapterId]
  return leaf.sectionId ? chapter.sections[leaf.sectionId].title : chapter.title
}

function TextbookBody({ text }: { text: string }) {
  return (
    <div className="textbook-body">
      {text.split('\n\n').map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  )
}

export function TextbookScreen({ navigate, kijunData, chapterId, sectionId }: Props) {
  const leaves = useMemo(() => buildLeaves(kijunData), [kijunData])
  const chapter = chapterId ? kijunData[chapterId] : undefined
  const section = chapter && sectionId ? chapter.sections[sectionId] : undefined

  const goToLeaf = (leaf: Leaf) =>
    navigate({ name: 'textbook', chapterId: leaf.chapterId, sectionId: leaf.sectionId ?? undefined })

  const renderLeafNav = (cid: string, sid: string | null) => {
    const index = leaves.findIndex((l) => l.chapterId === cid && l.sectionId === sid)
    const prev = index > 0 ? leaves[index - 1] : null
    const next = index >= 0 && index < leaves.length - 1 ? leaves[index + 1] : null
    if (!prev && !next) return null
    return (
      <div className="textbook-nav">
        {prev ? (
          <button className="btn-secondary" onClick={() => goToLeaf(prev)} type="button">
            ← {leafTitle(kijunData, prev)}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="btn-secondary" onClick={() => goToLeaf(next)} type="button">
            {leafTitle(kijunData, next)} →
          </button>
        )}
      </div>
    )
  }

  // 節の本文
  if (chapterId && chapter && sectionId && section) {
    return (
      <AppShell
        title={chapter.title}
        onBack={() => navigate({ name: 'textbook', chapterId })}
        tab="textbook"
        navigate={navigate}
        screenId="textbookScreen"
      >
        <h2 className="page-title">{section.title}</h2>
        <TextbookBody text={section.text} />
        {renderLeafNav(chapterId, sectionId)}
      </AppShell>
    )
  }

  // 章（節の一覧、節がない章は本文）
  if (chapterId && chapter) {
    const sectionIds = sortedIds(Object.keys(chapter.sections))
    return (
      <AppShell
        title={chapter.title}
        onBack={() => navigate({ name: 'textbook' })}
        tab="textbook"
        navigate={navigate}
        screenId="textbookScreen"
      >
        {chapter.intro && <TextbookBody text={chapter.intro} />}
        {sectionIds.length > 0 && (
          <div className="list">
            {sectionIds.map((sid) => (
              <button
                key={sid}
                className="list-item"
                onClick={() => navigate({ name: 'textbook', chapterId, sectionId: sid })}
                type="button"
              >
                <span>{chapter.sections[sid].title}</span>
                <span className="chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
        {sectionIds.length === 0 && !chapter.intro && <p className="muted">本文はまだ収録されていません。</p>}
        {sectionIds.length === 0 && renderLeafNav(chapterId, null)}
      </AppShell>
    )
  }

  // 目次
  return (
    <AppShell title="教科書" tab="textbook" navigate={navigate} screenId="textbookScreen">
      <p className="muted">不動産鑑定評価基準の本文を章・節ごとに読めます。</p>
      <div className="list">
        {sortedIds(Object.keys(kijunData)).map((id) => (
          <button key={id} className="list-item" onClick={() => navigate({ name: 'textbook', chapterId: id })} type="button">
            <span>{kijunData[id].title}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </AppShell>
  )
}

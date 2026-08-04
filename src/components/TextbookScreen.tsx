import { useMemo, useState } from 'react'
import type { KijunData, Mode } from '../types'
import { ModeTabs } from './ModeTabs'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  kijunData: KijunData
}

type View =
  | { level: 'chapters' }
  | { level: 'chapter'; chapterId: string }
  | { level: 'section'; chapterId: string; sectionId: string }

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

export function TextbookScreen({ mode, onModeChange, kijunData }: Props) {
  const [view, setView] = useState<View>({ level: 'chapters' })
  const leaves = useMemo(() => buildLeaves(kijunData), [kijunData])

  const goToLeaf = (leaf: Leaf) => {
    setView(
      leaf.sectionId
        ? { level: 'section', chapterId: leaf.chapterId, sectionId: leaf.sectionId }
        : { level: 'chapter', chapterId: leaf.chapterId },
    )
  }

  const renderLeafNav = (chapterId: string, sectionId: string | null) => {
    const index = leaves.findIndex(
      (l) => l.chapterId === chapterId && l.sectionId === sectionId,
    )
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

  return (
    <div className="screen" id="textbookScreen">
      <ModeTabs mode={mode} onChange={onModeChange} />

      {view.level === 'chapters' && (
        <>
          <h2>教科書</h2>
          <p>不動産鑑定評価基準の本文を章・節ごとに読めます</p>
          <div className="chapter-selection">
            <div className="chapter-list">
              {sortedIds(Object.keys(kijunData)).map((id) => (
                <div
                  key={id}
                  className="chapter-item"
                  onClick={() => setView({ level: 'chapter', chapterId: id })}
                >
                  <label>{kijunData[id].title}</label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view.level === 'chapter' &&
        (() => {
          const chapter = kijunData[view.chapterId]
          const sectionIds = sortedIds(Object.keys(chapter.sections))
          return (
            <>
              <button
                className="btn-secondary"
                onClick={() => setView({ level: 'chapters' })}
                type="button"
              >
                章一覧へ戻る
              </button>
              <h2>{chapter.title}</h2>
              {chapter.intro && <TextbookBody text={chapter.intro} />}
              {sectionIds.length > 0 && (
                <div className="chapter-selection">
                  <div className="chapter-list">
                    {sectionIds.map((sid) => (
                      <div
                        key={sid}
                        className="chapter-item"
                        onClick={() =>
                          setView({ level: 'section', chapterId: view.chapterId, sectionId: sid })
                        }
                      >
                        <label>{chapter.sections[sid].title}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sectionIds.length === 0 && renderLeafNav(view.chapterId, null)}
            </>
          )
        })()}

      {view.level === 'section' &&
        (() => {
          const chapter = kijunData[view.chapterId]
          const section = chapter.sections[view.sectionId]
          return (
            <>
              <button
                className="btn-secondary"
                onClick={() => setView({ level: 'chapter', chapterId: view.chapterId })}
                type="button"
              >
                章に戻る
              </button>
              <h2>{section.title}</h2>
              <TextbookBody text={section.text} />
              {renderLeafNav(view.chapterId, view.sectionId)}
            </>
          )
        })()}
    </div>
  )
}

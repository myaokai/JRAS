import { useState } from 'react'
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

function sortedIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => Number(a) - Number(b))
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
            </>
          )
        })()}
    </div>
  )
}

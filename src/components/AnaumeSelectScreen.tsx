import type { Navigate } from '../route'
import type { Chapter } from '../types'
import { QUIZ_SIZES, type PoolMethod } from '../quizPool'
import { AppShell } from './layout/AppShell'
import { ChapterSelector } from './ChapterSelector'
import { SectionTitle, Segmented } from './ui'

interface Props {
  navigate: Navigate
  // 穴埋めと暗唱チェックで共用する
  title: string
  chapters: Record<string, Chapter>
  // 出題対象（章・節ごとの件数をツリーに出す）
  items: { chapter: number; section: number }[]
  selectedSections: Set<string>
  onSectionsChange: (next: Set<string>) => void
  method: PoolMethod
  onMethodChange: (method: PoolMethod) => void
  size: number
  onSizeChange: (size: number) => void
  // 選択中の範囲・出題方法に当てはまる問題数
  poolCount: number
  onStart: () => void
}

const METHODS: { value: PoolMethod; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'due', label: '要復習のみ' },
  { value: 'new', label: '未学習のみ' },
]

export function AnaumeSelectScreen(props: Props) {
  const { navigate, poolCount } = props
  const count = Math.min(poolCount, props.size)
  return (
    <AppShell
      title={props.title}
      onBack={() => navigate({ name: 'study' })}
      navigate={navigate}
      screenId="startScreen"
      footer={
        <button id="startBtn" className="btn-primary btn-block" onClick={props.onStart} disabled={count === 0} type="button">
          {count === 0 ? '当てはまる問題がありません' : `${poolCount}問から${count}問をはじめる`}
        </button>
      }
    >
      <SectionTitle>出題方法</SectionTitle>
      <Segmented id="methodSelect" label="出題方法" options={METHODS} value={props.method} onChange={props.onMethodChange} />
      <SectionTitle>問題数</SectionTitle>
      <Segmented
        id="sizeSelect"
        label="問題数"
        options={QUIZ_SIZES.map((n) => ({ value: n, label: `${n}問` }))}
        value={props.size}
        onChange={props.onSizeChange}
      />
      <ChapterSelector
        chapters={props.chapters}
        questions={props.items}
        selected={props.selectedSections}
        onChange={props.onSectionsChange}
      />
    </AppShell>
  )
}

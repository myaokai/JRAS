import type { Navigate } from '../route'
import type { QuestionsData } from '../types'
import { QUESTIONS_PER_QUIZ } from '../constants'
import { AppShell } from './layout/AppShell'
import { ChapterSelector } from './ChapterSelector'
import { FilterBar } from './FilterBar'

interface Props {
  navigate: Navigate
  questionsData: QuestionsData
  selectedChapters: Set<number>
  onChaptersChange: (next: Set<number>) => void
  filterUnlearned: boolean
  onToggleFilterUnlearned: () => void
  unlearnedCount: number
  onStart: () => void
}

export function AnaumeSelectScreen(props: Props) {
  const { navigate, filterUnlearned, unlearnedCount } = props
  const count = filterUnlearned ? Math.min(unlearnedCount, QUESTIONS_PER_QUIZ) : QUESTIONS_PER_QUIZ
  return (
    <AppShell
      title="基準 穴埋め"
      onBack={() => navigate({ name: 'study' })}
      navigate={navigate}
      screenId="startScreen"
      footer={
        <button id="startBtn" className="btn-primary btn-block" onClick={props.onStart} type="button">
          {filterUnlearned ? `未習得 ${unlearnedCount}問から${count}問をはじめる` : `${count}問をはじめる`}
        </button>
      }
    >
      <p className="muted">穴埋め部分をタップすると答えが表示されます。</p>
      <FilterBar
        barId="anaumeFilterBar"
        btnId="filterUnlearnedBtn"
        countId="filterUnlearnedCount"
        label="未習得・要復習だけ"
        count={unlearnedCount}
        active={filterUnlearned}
        onToggle={props.onToggleFilterUnlearned}
      />
      <ChapterSelector
        chapters={props.questionsData.chapters}
        questions={props.questionsData.questions}
        selectedChapters={props.selectedChapters}
        onChange={props.onChaptersChange}
      />
    </AppShell>
  )
}

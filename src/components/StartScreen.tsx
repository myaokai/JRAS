import type { ExamMeta, KakomonHistory, Mode, QuestionsData } from '../types'
import { QUESTIONS_PER_QUIZ } from '../constants'
import { ModeTabs } from './ModeTabs'
import { ChapterSelector } from './ChapterSelector'
import { ExamSelector } from './ExamSelector'
import { FilterBar } from './FilterBar'
import { KakomonHistoryList } from './KakomonHistoryList'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  questionsData: QuestionsData
  examIndex: ExamMeta[]
  selectedChapters: Set<number>
  onChaptersChange: (next: Set<number>) => void
  selectedExams: Set<string>
  onExamsChange: (next: Set<string>) => void
  filterUnlearned: boolean
  onToggleFilterUnlearned: () => void
  filterWrong: boolean
  onToggleFilterWrong: () => void
  unlearnedCount: number
  dueIds: string[]
  history: KakomonHistory
  onStart: () => void
}

export function StartScreen({
  mode,
  onModeChange,
  questionsData,
  examIndex,
  selectedChapters,
  onChaptersChange,
  selectedExams,
  onExamsChange,
  filterUnlearned,
  onToggleFilterUnlearned,
  filterWrong,
  onToggleFilterWrong,
  unlearnedCount,
  dueIds,
  history,
  onStart,
}: Props) {
  return (
    <div id="startScreen" className="screen">
      <ModeTabs mode={mode} onChange={onModeChange} />
      <h2>学習を始めましょう</h2>
      <p>
        {mode === 'anaume'
          ? '穴埋め部分をクリックすると答えが表示されます'
          : '選択した試験からランダムに10問出題されます'}
      </p>

      {mode === 'anaume' ? (
        <div>
          <ChapterSelector
            chapters={questionsData.chapters}
            questions={questionsData.questions}
            selectedChapters={selectedChapters}
            onChange={onChaptersChange}
          />

          <FilterBar
            barId="anaumeFilterBar"
            btnId="filterUnlearnedBtn"
            countId="filterUnlearnedCount"
            label="未習得問題を練習"
            count={unlearnedCount}
            active={filterUnlearned}
            onToggle={onToggleFilterUnlearned}
          />

          <div className="start-options">
            <p className="question-count">
              {filterUnlearned ? (
                <>
                  未習得 {unlearnedCount}問 から{' '}
                  <strong>{Math.min(unlearnedCount, QUESTIONS_PER_QUIZ)}問</strong>{' '}
                  出題します
                </>
              ) : (
                <>
                  選択した章からランダムに<strong>10問</strong>出題されます
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <ExamSelector exams={examIndex} selectedExams={selectedExams} onChange={onExamsChange} />

          <FilterBar
            barId="kakomonFilterBar"
            btnId="filterWrongBtn"
            countId="filterWrongCount"
            label="直近の間違いを練習"
            count={dueIds.length}
            active={filterWrong}
            onToggle={onToggleFilterWrong}
          />

          <div className="start-options">
            <p className="question-count">
              {filterWrong ? (
                <>
                  直近の間違い {dueIds.length}問 から{' '}
                  <strong>{Math.min(dueIds.length, QUESTIONS_PER_QUIZ)}問</strong>{' '}
                  出題します
                </>
              ) : (
                <>
                  選択した試験からランダムに<strong>10問</strong>出題されます
                </>
              )}
            </p>
          </div>

          <KakomonHistoryList history={history} exams={examIndex} />
        </div>
      )}

      <button id="startBtn" className="btn-primary" onClick={onStart} type="button">
        スタート
      </button>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { AnaumeQuestion, ExamMeta, KakomonQuestion, Mode, QuestionsData } from './types'
import { loadExamData, loadExamIndex, loadQuestionsData } from './data/loadData'
import { useQuizProgress } from './hooks/useQuizProgress'
import { useProblemRecord } from './hooks/useProblemRecord'
import { useKakomonHistory } from './hooks/useKakomonHistory'
import { StartScreen } from './components/StartScreen'
import { QuizScreen } from './components/QuizScreen'
import { ResultScreen } from './components/ResultScreen'
import { shuffled } from './shuffle'
import { QUESTIONS_PER_QUIZ } from './constants'

type Screen = 'start' | 'quiz' | 'result'
type QuizItem = AnaumeQuestion | KakomonQuestion

function App() {
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null)
  const [examIndex, setExamIndex] = useState<ExamMeta[]>([])

  const [mode, setMode] = useState<Mode>('anaume')
  const [screen, setScreen] = useState<Screen>('start')

  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set())
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set())
  const [filterUnlearned, setFilterUnlearned] = useState(false)
  const [filterWrong, setFilterWrong] = useState(false)

  const [currentQuestions, setCurrentQuestions] = useState<QuizItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const { completedQuestions, markCompleted } = useQuizProgress()
  const { updateProblemRecord, wrongIds } = useProblemRecord()
  const { history, addResult } = useKakomonHistory()

  useEffect(() => {
    loadQuestionsData()
      .then((data) => {
        setQuestionsData(data)
        const chaptersWithQuestions = new Set(
          Object.keys(data.chapters)
            .filter((id) => data.questions.some((q) => q.chapter === Number(id)))
            .map(Number),
        )
        setSelectedChapters(chaptersWithQuestions)
      })
      .catch((e) => console.error('問題データの読み込みに失敗しました', e))

    loadExamIndex().then((exams) => {
      setExamIndex(exams)
      setSelectedExams(new Set(exams.map((e) => e.id)))
    })
  }, [])

  const unlearnedCount = useMemo(() => {
    if (!questionsData) return 0
    return questionsData.questions.filter(
      (q) => selectedChapters.has(q.chapter) && !completedQuestions.includes(q.id),
    ).length
  }, [questionsData, selectedChapters, completedQuestions])

  useEffect(() => {
    if (unlearnedCount === 0 && filterUnlearned) setFilterUnlearned(false)
  }, [unlearnedCount, filterUnlearned])

  useEffect(() => {
    if (wrongIds.length === 0 && filterWrong) setFilterWrong(false)
  }, [wrongIds.length, filterWrong])

  const handleModeChange = (m: Mode) => {
    setMode(m)
    if (m !== 'kakomon') setFilterWrong(false)
  }

  const startAnaumeQuiz = () => {
    if (!questionsData) return
    if (selectedChapters.size === 0) {
      alert('出題範囲を1つ以上選択してください')
      return
    }
    let pool = questionsData.questions.filter((q) => selectedChapters.has(q.chapter))
    if (filterUnlearned) {
      const unlearned = pool.filter((q) => !completedQuestions.includes(q.id))
      if (unlearned.length > 0) pool = unlearned
    }
    if (pool.length === 0) {
      alert('選択した章に問題がありません')
      return
    }
    setCurrentQuestions(shuffled(pool).slice(0, QUESTIONS_PER_QUIZ))
    setCurrentIndex(0)
    setScreen('quiz')
  }

  const loadQuestionsFromExams = async (exams: ExamMeta[]): Promise<KakomonQuestion[]> => {
    const results = await Promise.all(exams.map(loadExamData))
    return results.filter((d): d is NonNullable<typeof d> => d !== null).flatMap((d) => d.questions)
  }

  const startKakomonFilteredQuiz = async () => {
    if (wrongIds.length === 0) {
      alert('練習する間違い問題がありません')
      return
    }
    const examsNeeded = examIndex.filter((e) => wrongIds.some((id) => id.startsWith(e.id)))
    const allQuestions = await loadQuestionsFromExams(examsNeeded)
    const filteredQuestions = allQuestions.filter((q) => wrongIds.includes(q.id))
    if (filteredQuestions.length === 0) {
      alert('問題を読み込めませんでした')
      return
    }
    setCurrentQuestions(shuffled(filteredQuestions).slice(0, QUESTIONS_PER_QUIZ))
    setCurrentIndex(0)
    setCorrectCount(0)
    setScreen('quiz')
  }

  const startKakomonQuiz = async () => {
    if (filterWrong) {
      await startKakomonFilteredQuiz()
      return
    }
    if (selectedExams.size === 0) {
      alert('試験を1つ以上選択してください')
      return
    }
    const exams = examIndex.filter((e) => selectedExams.has(e.id))
    const allQuestions = await loadQuestionsFromExams(exams)
    if (allQuestions.length === 0) {
      alert('問題を読み込めませんでした')
      return
    }
    setCurrentQuestions(shuffled(allQuestions).slice(0, QUESTIONS_PER_QUIZ))
    setCurrentIndex(0)
    setCorrectCount(0)
    setScreen('quiz')
  }

  const handleStart = () => {
    if (mode === 'kakomon') void startKakomonQuiz()
    else startAnaumeQuiz()
  }

  const handleNext = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex >= currentQuestions.length) {
      if (mode === 'kakomon') {
        addResult([...selectedExams], currentQuestions.length, correctCount)
      }
      setScreen('result')
    } else {
      setCurrentIndex(nextIndex)
    }
  }

  if (!questionsData) return null

  return (
    <div className="container" id="appContainer">
      <header>
        <h1>不動産鑑定評価基準</h1>
        <button
          id="resetBtn"
          className="btn-secondary"
          onClick={() => setScreen('start')}
          type="button"
        >
          リセット
        </button>
      </header>
      <main>
        {screen === 'start' && (
          <StartScreen
            mode={mode}
            onModeChange={handleModeChange}
            questionsData={questionsData}
            examIndex={examIndex}
            selectedChapters={selectedChapters}
            onChaptersChange={setSelectedChapters}
            selectedExams={selectedExams}
            onExamsChange={setSelectedExams}
            filterUnlearned={filterUnlearned}
            onToggleFilterUnlearned={() => setFilterUnlearned((v) => !v)}
            filterWrong={filterWrong}
            onToggleFilterWrong={() => setFilterWrong((v) => !v)}
            unlearnedCount={unlearnedCount}
            wrongIds={wrongIds}
            history={history}
            onStart={handleStart}
          />
        )}
        {screen === 'quiz' && (
          <QuizScreen
            mode={mode}
            chapters={questionsData.chapters}
            currentQuestions={currentQuestions}
            currentIndex={currentIndex}
            onNext={handleNext}
            onAnaumeAllRevealed={markCompleted}
            onKakomonAnswered={(questionId, correct) => {
              updateProblemRecord(questionId, correct)
              if (correct) setCorrectCount((c) => c + 1)
            }}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            mode={mode}
            total={currentQuestions.length}
            correctCount={correctCount}
            onRetry={() => setScreen('start')}
          />
        )}
      </main>
    </div>
  )
}

export default App

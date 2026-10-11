import { useEffect, useMemo, useState } from 'react'
import type { AnaumeQuestion, ExamMeta, KakomonQuestion, KijunData, QuestionsData } from './types'
import { loadExamData, loadExamIndex, loadKijunData, loadQuestionsData } from './data/loadData'
import { useStudyLog } from './hooks/useStudyLog'
import { useHashRoute } from './route'
import { HomeScreen } from './components/HomeScreen'
import { StudyScreen } from './components/StudyScreen'
import { AnaumeSelectScreen } from './components/AnaumeSelectScreen'
import { KakomonSelectScreen } from './components/KakomonSelectScreen'
import { QuizScreen } from './components/QuizScreen'
import { ResultScreen } from './components/ResultScreen'
import { TextbookScreen } from './components/TextbookScreen'
import { RecordsScreen } from './components/RecordsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { shuffled } from './shuffle'
import { QUESTIONS_PER_QUIZ } from './constants'
import { examIdOf } from './store/replay'

type QuizItem = AnaumeQuestion | KakomonQuestion

interface Quiz {
  mode: 'anaume' | 'kakomon'
  questions: QuizItem[]
  index: number
  correctCount: number
  sessionId: string
}

const WEEK_MS = 7 * 86400000
const RECENT_ANSWERS = 50

function App() {
  const [route, navigate] = useHashRoute()
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null)
  const [kijunData, setKijunData] = useState<KijunData | null>(null)
  const [examIndex, setExamIndex] = useState<ExamMeta[]>([])

  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set())
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set())
  const [filterUnlearned, setFilterUnlearned] = useState(false)
  const [filterWrong, setFilterWrong] = useState(false)
  const [quiz, setQuiz] = useState<Quiz | null>(null)

  const log = useStudyLog()
  const { dueIds, isQuestionDue, recordAnswer } = log

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

    loadKijunData()
      .then(setKijunData)
      .catch((e) => console.error('教科書データの読み込みに失敗しました', e))

    loadExamIndex().then((exams) => {
      setExamIndex(exams)
      setSelectedExams(new Set(exams.map((e) => e.id)))
    })
  }, [])

  // 出題中の状態はメモリにしかないので、再読み込み後などに #/quiz・#/result を開いたら学習トップへ戻す
  useEffect(() => {
    if (!quiz && (route.name === 'quiz' || route.name === 'result')) navigate({ name: 'study' }, { replace: true })
  }, [quiz, route.name, navigate])

  const examIds = useMemo(() => new Set(examIndex.map((e) => e.id)), [examIndex])
  const kakomonWrongIds = useMemo(() => dueIds.filter((id) => examIds.has(examIdOf(id))), [dueIds, examIds])
  const anaumeReviewIds = useMemo(() => dueIds.filter((id) => !examIds.has(examIdOf(id))), [dueIds, examIds])

  const anaumeDueCount = useMemo(() => {
    if (!questionsData) return 0
    return questionsData.questions.filter(
      (q) => selectedChapters.has(q.chapter) && isQuestionDue(String(q.id)),
    ).length
  }, [questionsData, selectedChapters, isQuestionDue])

  const studied = useMemo(() => log.answers.filter((a) => a.mode !== 'snapshot'), [log.answers])
  const weekCount = useMemo(() => {
    const since = Date.now() - WEEK_MS
    return studied.filter((a) => a.answered_at >= since).length
  }, [studied])
  const recentAccuracy = useMemo(() => {
    const recent = [...studied].sort((a, b) => b.answered_at - a.answered_at).slice(0, RECENT_ANSWERS)
    if (recent.length === 0) return null
    return Math.round((recent.filter((a) => a.result === 2).length / recent.length) * 100)
  }, [studied])

  useEffect(() => {
    if (anaumeDueCount === 0 && filterUnlearned) setFilterUnlearned(false)
  }, [anaumeDueCount, filterUnlearned])

  useEffect(() => {
    if (kakomonWrongIds.length === 0 && filterWrong) setFilterWrong(false)
  }, [kakomonWrongIds.length, filterWrong])

  const beginQuiz = (mode: Quiz['mode'], pool: QuizItem[]) => {
    setQuiz({
      mode,
      questions: shuffled(pool).slice(0, QUESTIONS_PER_QUIZ),
      index: 0,
      correctCount: 0,
      sessionId: crypto.randomUUID(),
    })
    navigate({ name: 'quiz' })
  }

  const startAnaumeQuiz = () => {
    if (!questionsData) return
    if (selectedChapters.size === 0) {
      alert('出題範囲を1つ以上選択してください')
      return
    }
    let pool = questionsData.questions.filter((q) => selectedChapters.has(q.chapter))
    if (filterUnlearned) {
      const due = pool.filter((q) => isQuestionDue(String(q.id)))
      if (due.length > 0) pool = due
    }
    if (pool.length === 0) {
      alert('選択した章に問題がありません')
      return
    }
    beginQuiz('anaume', pool)
  }

  const startAnaumeReview = () => {
    if (!questionsData) return
    const ids = new Set(anaumeReviewIds)
    const pool = questionsData.questions.filter((q) => ids.has(String(q.id)))
    if (pool.length > 0) beginQuiz('anaume', pool)
  }

  const loadQuestionsFromExams = async (exams: ExamMeta[]): Promise<KakomonQuestion[]> => {
    const results = await Promise.all(exams.map(loadExamData))
    return results.filter((d): d is NonNullable<typeof d> => d !== null).flatMap((d) => d.questions)
  }

  const startKakomonReview = async () => {
    if (kakomonWrongIds.length === 0) {
      alert('練習する間違い問題がありません')
      return
    }
    const ids = new Set(kakomonWrongIds)
    const examsNeeded = examIndex.filter((e) => kakomonWrongIds.some((id) => examIdOf(id) === e.id))
    const pool = (await loadQuestionsFromExams(examsNeeded)).filter((q) => ids.has(q.id))
    if (pool.length === 0) {
      alert('問題を読み込めませんでした')
      return
    }
    beginQuiz('kakomon', pool)
  }

  const startKakomonQuiz = async () => {
    if (filterWrong) {
      await startKakomonReview()
      return
    }
    if (selectedExams.size === 0) {
      alert('試験を1つ以上選択してください')
      return
    }
    const pool = await loadQuestionsFromExams(examIndex.filter((e) => selectedExams.has(e.id)))
    if (pool.length === 0) {
      alert('問題を読み込めませんでした')
      return
    }
    beginQuiz('kakomon', pool)
  }

  const handleNext = () => {
    if (!quiz) return
    if (quiz.index + 1 >= quiz.questions.length) {
      // 結果画面から「戻る」で解き終えた問題に戻らないよう、履歴を置き換える
      navigate({ name: 'result' }, { replace: true })
    } else {
      setQuiz({ ...quiz, index: quiz.index + 1 })
    }
  }

  const recordResult = (questionId: string, correct: boolean, choice: string | null) => {
    if (!quiz) return
    recordAnswer({
      question_id: questionId,
      mode: quiz.mode,
      result: correct ? 2 : 0,
      choice,
      session_id: quiz.sessionId,
    })
    if (correct) setQuiz((q) => q && { ...q, correctCount: q.correctCount + 1 })
  }

  if (!questionsData || !kijunData || !log.loaded) return null

  const common = { navigate }

  switch (route.name) {
    case 'home':
      return (
        <HomeScreen
          {...common}
          habit={log.habit}
          anaumeReviewCount={anaumeReviewIds.length}
          kakomonReviewCount={kakomonWrongIds.length}
          onStartAnaumeReview={startAnaumeReview}
          onStartKakomonReview={() => void startKakomonReview()}
        />
      )
    case 'study':
      return (
        <StudyScreen
          {...common}
          anaumeReviewCount={anaumeReviewIds.length}
          kakomonReviewCount={kakomonWrongIds.length}
          weekCount={weekCount}
          totalCount={studied.length}
        />
      )
    case 'study-anaume':
      return (
        <AnaumeSelectScreen
          {...common}
          questionsData={questionsData}
          selectedChapters={selectedChapters}
          onChaptersChange={setSelectedChapters}
          filterUnlearned={filterUnlearned}
          onToggleFilterUnlearned={() => setFilterUnlearned((v) => !v)}
          unlearnedCount={anaumeDueCount}
          onStart={startAnaumeQuiz}
        />
      )
    case 'study-kakomon':
      return (
        <KakomonSelectScreen
          {...common}
          examIndex={examIndex}
          selectedExams={selectedExams}
          onExamsChange={setSelectedExams}
          filterWrong={filterWrong}
          onToggleFilterWrong={() => setFilterWrong((v) => !v)}
          wrongCount={kakomonWrongIds.length}
          history={log.history}
          onStart={() => void startKakomonQuiz()}
        />
      )
    case 'quiz':
      return quiz ? (
        <QuizScreen
          {...common}
          chapters={questionsData.chapters}
          currentQuestions={quiz.questions}
          currentIndex={quiz.index}
          onNext={handleNext}
          onAnaumeAssessed={(id, correct) => recordResult(String(id), correct, null)}
          onKakomonAnswered={(id, choice, correct) => recordResult(id, correct, choice)}
        />
      ) : null
    case 'result':
      return quiz ? (
        <ResultScreen {...common} mode={quiz.mode} total={quiz.questions.length} correctCount={quiz.correctCount} />
      ) : null
    case 'textbook':
      return <TextbookScreen {...common} kijunData={kijunData} chapterId={route.chapterId} sectionId={route.sectionId} />
    case 'records':
      return (
        <RecordsScreen
          {...common}
          habit={log.habit}
          totalCount={studied.length}
          recentAccuracy={recentAccuracy}
          history={log.history}
          examIndex={examIndex}
        />
      )
    case 'settings':
      return (
        <SettingsScreen
          {...common}
          lastBackupAt={log.lastBackupAt}
          onExport={log.exportBackup}
          onImport={log.importBackup}
        />
      )
  }
}

export default App

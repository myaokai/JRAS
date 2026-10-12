import { useEffect, useMemo, useState } from 'react'
import type { AnaumeQuestion, AnshouUnit, ExamMeta, KakomonQuestion, KijunData, QuestionsData } from './types'
import { isAnshouUnit, isKakomonQuestion } from './types'
import { loadAnshouData, loadExamData, loadExamIndex, loadKijunData, loadQuestionsData } from './data/loadData'
import { useStudyLog } from './hooks/useStudyLog'
import { useHashRoute } from './route'
import { useSession } from './session'
import { HomeScreen } from './components/HomeScreen'
import { StudyScreen } from './components/StudyScreen'
import { AnaumeSelectScreen } from './components/AnaumeSelectScreen'
import { KakomonSelectScreen } from './components/KakomonSelectScreen'
import { QuizScreen } from './components/QuizScreen'
import { ResultScreen } from './components/ResultScreen'
import { TextbookScreen } from './components/TextbookScreen'
import { RecordsScreen } from './components/RecordsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { DrillScreen, newDrill, type DrillState } from './components/DrillScreen'
import { DRILL_TYPES } from './drill/drillTypes'
import { shuffled } from './shuffle'
import { QUESTIONS_PER_QUIZ } from './constants'
import { examIdOf } from './store/replay'
import { SETTING_KEYS } from './store/types'
import { anaumePool, anshouPool, inExamOrder, pickRandom, sectionKey, splitDueIds, type PoolMethod } from './quizPool'
import type { AnswerResult } from './store/types'
import { EMPTY_RESPONSE, type QuizResponse } from './components/QuizScreen'
import type { ResultItem } from './components/ResultScreen'
import type { KakomonFormat, KakomonTab } from './components/KakomonSelectScreen'

type QuizItem = AnaumeQuestion | KakomonQuestion | AnshouUnit

interface Quiz {
  mode: 'anaume' | 'kakomon' | 'anshou'
  questions: QuizItem[]
  index: number
  responses: QuizResponse[]
  sessionId: string
}

const WEEK_MS = 7 * 86400000
const RECENT_ANSWERS = 50
const LABEL_CHARS = 24

function questionLabel(q: QuizItem): string {
  if (isKakomonQuestion(q)) return `${q._examLabel ?? ''} 問${q.number}`
  if (isAnshouUnit(q)) return q.title
  const plain = q.text.replace(/\{\{|\}\}/g, '')
  return plain.length > LABEL_CHARS ? `${plain.slice(0, LABEL_CHARS)}…` : plain
}

function App() {
  const [route, navigate] = useHashRoute()
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null)
  const [kijunData, setKijunData] = useState<KijunData | null>(null)
  const [examIndex, setExamIndex] = useState<ExamMeta[]>([])
  const [anshouUnits, setAnshouUnits] = useState<AnshouUnit[]>([])

  // 穴埋めの出題条件
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [method, setMethod] = useState<PoolMethod>('all')
  const [quizSize, setQuizSize] = useState<number>(QUESTIONS_PER_QUIZ)
  // 暗唱チェックの出題条件
  const [anshouSections, setAnshouSections] = useState<Set<string>>(new Set())
  const [anshouMethod, setAnshouMethod] = useState<PoolMethod>('all')
  const [anshouSize, setAnshouSize] = useState<number>(QUESTIONS_PER_QUIZ)
  // 過去問の出題条件
  const [kakomonTab, setKakomonTab] = useState<KakomonTab>('year')
  const [kakomonFormat, setKakomonFormat] = useState<KakomonFormat>('random')
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set())
  const [realExam, setRealExam] = useState('')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [drill, setDrill] = useState<DrillState | null>(null)

  const log = useStudyLog()
  const { session, refresh: refreshSession } = useSession()
  const { dueIds, problemRecord, today, recordAnswer } = log

  useEffect(() => {
    loadQuestionsData()
      .then((data) => {
        setQuestionsData(data)
        setSelectedSections(new Set(data.questions.map((q) => sectionKey(q.chapter, q.section))))
      })
      .catch((e) => console.error('問題データの読み込みに失敗しました', e))

    loadKijunData()
      .then(setKijunData)
      .catch((e) => console.error('教科書データの読み込みに失敗しました', e))

    loadAnshouData()
      .then((data) => {
        setAnshouUnits(data.units)
        setAnshouSections(new Set(data.units.map((u) => sectionKey(u.chapter, u.section))))
      })
      .catch((e) => console.error('暗唱チェックのデータの読み込みに失敗しました', e))

    loadExamIndex().then((exams) => {
      setExamIndex(exams)
      setSelectedExams(new Set(exams.map((e) => e.id)))
      setRealExam(exams[0]?.id ?? '')
    })
  }, [])

  // 出題中の状態はメモリにしかないので、再読み込み後などに #/quiz・#/result を開いたら学習トップへ戻す
  useEffect(() => {
    if (!quiz && (route.name === 'quiz' || route.name === 'result')) navigate({ name: 'study' }, { replace: true })
  }, [quiz, route.name, navigate])

  // 計算ドリルは初めて開いたときに1問目を作る。以後は教科書へ行って戻っても同じ問題のまま
  useEffect(() => {
    if (route.name === 'study-drill' && !drill) setDrill(newDrill(DRILL_TYPES[0].id))
  }, [route.name, drill])

  const examIds = useMemo(() => new Set(examIndex.map((e) => e.id)), [examIndex])
  const dueByMode = useMemo(() => splitDueIds(dueIds, (id) => examIds.has(examIdOf(id))), [dueIds, examIds])
  const { kakomon: kakomonWrongIds, anaume: anaumeReviewIds, anshou: anshouReviewIds } = dueByMode

  const anaumeCandidates = useMemo(
    () => (questionsData ? anaumePool(questionsData.questions, selectedSections, method, problemRecord, today) : []),
    [questionsData, selectedSections, method, problemRecord, today],
  )

  const anshouCandidates = useMemo(
    () => anshouPool(anshouUnits, anshouSections, anshouMethod, problemRecord, today),
    [anshouUnits, anshouSections, anshouMethod, problemRecord, today],
  )

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

  // questions は出題順に並べたもの
  const beginQuiz = (mode: Quiz['mode'], questions: QuizItem[], options?: { replace?: boolean }) => {
    if (questions.length === 0) return
    setQuiz({
      mode,
      questions,
      index: 0,
      responses: questions.map(() => EMPTY_RESPONSE),
      sessionId: crypto.randomUUID(),
    })
    navigate({ name: 'quiz' }, options)
  }

  const startAnaumeQuiz = () => beginQuiz('anaume', pickRandom(anaumeCandidates, quizSize))

  const startAnaumeReview = () => {
    if (!questionsData) return
    const ids = new Set(anaumeReviewIds)
    beginQuiz('anaume', pickRandom(questionsData.questions.filter((q) => ids.has(String(q.id))), QUESTIONS_PER_QUIZ))
  }

  const startAnshouQuiz = () => beginQuiz('anshou', pickRandom(anshouCandidates, anshouSize))

  const startAnshouReview = () => {
    const ids = new Set(anshouReviewIds)
    beginQuiz('anshou', pickRandom(anshouUnits.filter((u) => ids.has(u.id)), QUESTIONS_PER_QUIZ))
  }

  const loadQuestionsFromExams = async (exams: ExamMeta[]): Promise<KakomonQuestion[]> => {
    const results = await Promise.all(exams.map(loadExamData))
    return results.filter((d): d is NonNullable<typeof d> => d !== null).flatMap((d) => d.questions)
  }

  const startKakomonReview = async () => {
    const ids = new Set(kakomonWrongIds)
    const examsNeeded = examIndex.filter((e) => kakomonWrongIds.some((id) => examIdOf(id) === e.id))
    const pool = (await loadQuestionsFromExams(examsNeeded)).filter((q) => ids.has(q.id))
    beginQuiz('kakomon', pickRandom(pool, QUESTIONS_PER_QUIZ))
  }

  const startKakomonQuiz = async () => {
    if (kakomonTab === 'wrong') return startKakomonReview()
    if (kakomonFormat === 'exam') {
      const exam = examIndex.find((e) => e.id === realExam)
      if (exam) beginQuiz('kakomon', inExamOrder(await loadQuestionsFromExams([exam])))
      return
    }
    const pool = await loadQuestionsFromExams(examIndex.filter((e) => selectedExams.has(e.id)))
    beginQuiz('kakomon', pickRandom(pool, QUESTIONS_PER_QUIZ))
  }

  const handleNext = () => {
    if (!quiz) return
    if (quiz.index + 1 >= quiz.questions.length) {
      // 結果画面から「戻る」で解き終えた問題に戻らないよう、履歴を置き換える
      navigate({ name: 'result' }, { replace: true })
      // セットを解き終えたら同期する（失敗しても次の機会に送られる）
      void log.syncNow()
    } else {
      setQuiz({ ...quiz, index: quiz.index + 1 })
    }
  }

  const setResponse = (response: QuizResponse) =>
    setQuiz((q) => q && { ...q, responses: q.responses.map((r, i) => (i === q.index ? response : r)) })

  const recordResult = (questionId: string, correct: boolean, choice: string | null) => {
    if (!quiz) return
    recordAnswer({
      question_id: questionId,
      mode: quiz.mode,
      result: correct ? 2 : 0,
      choice,
      session_id: quiz.sessionId,
    })
  }

  // 暗唱は3段階（0=書けなかった 1=一部 2=書けた）で記録する
  const recordAnshou = (unitId: string, grade: AnswerResult) => {
    if (!quiz) return
    recordAnswer({ question_id: unitId, mode: 'anshou', result: grade, session_id: quiz.sessionId })
  }

  // 計算ドリルは1問ずつ記録する。復習の対象にはしない（buildProblemRecord で除外）
  const recordDrill = (typeId: string, correct: boolean, input: string | null) => {
    if (!drill) return
    recordAnswer({ question_id: `drill:${typeId}`, mode: 'drill', result: correct ? 2 : 0, choice: input, session_id: drill.sessionId })
  }

  const retryWrong = () => {
    if (!quiz) return
    const wrong = quiz.questions.filter((_, i) => quiz.responses[i].correct === false)
    // 結果画面を出題で置き換え、戻る操作で古い結果に戻らないようにする
    beginQuiz(quiz.mode, shuffled(wrong), { replace: true })
  }

  if (!questionsData || !kijunData || !log.loaded) return null

  const common = { navigate }

  switch (route.name) {
    case 'home':
      return (
        <HomeScreen
          {...common}
          habit={log.habit}
          sessionExpired={session.status === 'expired'}
          today={today}
          examDate={log.examDate}
          dailyGoal={log.dailyGoal}
          anaumeReviewCount={anaumeReviewIds.length}
          kakomonReviewCount={kakomonWrongIds.length}
          anshouReviewCount={anshouReviewIds.length}
          onStartAnshouReview={startAnshouReview}
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
          anshouReviewCount={anshouReviewIds.length}
          weekCount={weekCount}
          totalCount={studied.length}
        />
      )
    case 'study-anaume':
      return (
        <AnaumeSelectScreen
          {...common}
          title="基準 穴埋め"
          chapters={questionsData.chapters}
          items={questionsData.questions}
          selectedSections={selectedSections}
          onSectionsChange={setSelectedSections}
          method={method}
          onMethodChange={setMethod}
          size={quizSize}
          onSizeChange={setQuizSize}
          poolCount={anaumeCandidates.length}
          onStart={startAnaumeQuiz}
        />
      )
    case 'study-anshou':
      return (
        <AnaumeSelectScreen
          {...common}
          title="暗唱チェック"
          chapters={questionsData.chapters}
          items={anshouUnits}
          selectedSections={anshouSections}
          onSectionsChange={setAnshouSections}
          method={anshouMethod}
          onMethodChange={setAnshouMethod}
          size={anshouSize}
          onSizeChange={setAnshouSize}
          poolCount={anshouCandidates.length}
          onStart={startAnshouQuiz}
        />
      )
    case 'study-kakomon':
      return (
        <KakomonSelectScreen
          {...common}
          examIndex={examIndex}
          tab={kakomonTab}
          onTabChange={setKakomonTab}
          format={kakomonFormat}
          onFormatChange={setKakomonFormat}
          selectedExams={selectedExams}
          onExamsChange={setSelectedExams}
          realExam={realExam}
          onRealExamChange={setRealExam}
          wrongCount={kakomonWrongIds.length}
          history={log.history}
          onStart={() => void startKakomonQuiz()}
        />
      )
    case 'study-drill':
      return drill ? (
        <DrillScreen
          {...common}
          kijunData={kijunData}
          state={drill}
          onChange={setDrill}
          onAnswered={recordDrill}
        />
      ) : null
    case 'quiz':
      return quiz ? (
        <QuizScreen
          {...common}
          chapters={questionsData.chapters}
          kijunData={kijunData}
          currentQuestions={quiz.questions}
          currentIndex={quiz.index}
          response={quiz.responses[quiz.index]}
          onResponseChange={setResponse}
          onNext={handleNext}
          onAnaumeAssessed={(id, correct) => recordResult(String(id), correct, null)}
          onKakomonAnswered={(id, choice, correct) => recordResult(id, correct, choice)}
          onAnshouAssessed={recordAnshou}
        />
      ) : null
    case 'result':
      return quiz ? (
        <ResultScreen
          {...common}
          mode={quiz.mode}
          items={quiz.questions.map(
            (q, i): ResultItem => ({
              id: String(q.id),
              label: questionLabel(q),
              correct: quiz.responses[i].correct === true,
              partial: quiz.responses[i].grade === 1,
              dueDate: problemRecord[String(q.id)]?.dueDate ?? null,
            }),
          )}
          today={today}
          todayCount={log.habit.todayCount}
          dailyGoal={log.dailyGoal}
          onRetryWrong={retryWrong}
        />
      ) : null
    case 'textbook':
      return (
        <TextbookScreen
          {...common}
          kijunData={kijunData}
          chapterId={route.chapterId}
          sectionId={route.sectionId}
          fromQuiz={route.fromQuiz === true && (quiz !== null || drill !== null)}
        />
      )
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
          session={session}
          onRefreshSession={() => void refreshSession()}
          syncStatus={log.syncStatus}
          lastSyncedAt={log.lastSyncedAt}
          pendingCount={log.pendingCount}
          onSyncNow={() => void log.syncNow()}
          lastBackupAt={log.lastBackupAt}
          examDate={log.examDate}
          dailyGoal={log.dailyGoal}
          onExamDateChange={(v) => log.updateSetting(SETTING_KEYS.examDate, v)}
          onDailyGoalChange={(v) => log.updateSetting(SETTING_KEYS.dailyGoal, v)}
          onExport={log.exportBackup}
          onImport={log.importBackup}
        />
      )
  }
}

export default App

// 問題データ
let questions = [];
let chapters = {};
let availableExams = [];

// アプリケーションの状態
const state = {
    currentQuestions: [],
    currentIndex: 0,
    completedQuestions: new Set(),
    revealedBlanks: new Set(),
    selectedChapters: new Set(),
    selectedExams: new Set(),
    mode: 'anaume', // 'anaume' | 'kakomon'
    correctCount: 0,
    answerSelected: false,
    isAuthenticated: false
};

// 設定
const QUESTIONS_PER_QUIZ = 10;

// DOM要素
const elements = {
    appContainer: document.getElementById('appContainer'),
    startScreen: document.getElementById('startScreen'),
    quizScreen: document.getElementById('quizScreen'),
    resultScreen: document.getElementById('resultScreen'),
    startBtn: document.getElementById('startBtn'),
    nextBtn: document.getElementById('nextBtn'),
    showAllBtn: document.getElementById('showAllBtn'),
    retryBtn: document.getElementById('retryBtn'),
    resetBtn: document.getElementById('resetBtn'),
    chapterList: document.getElementById('chapterList'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    questionNumber: document.getElementById('questionNumber'),
    questionCategory: document.getElementById('questionCategory'),
    questionText: document.getElementById('questionText'),
    choicesContainer: document.getElementById('choicesContainer'),
    progress: document.getElementById('progress'),
    resultText: document.getElementById('resultText')
};

// LocalStorage キー
const STORAGE_KEY = 'quizProgress';

// 初期化
async function init() {
    try {
        const res = await fetch('./questions.json');
        const data = await res.json();
        questions = data.questions;
        chapters = data.chapters;
    } catch (e) {
        console.error('問題データの読み込みに失敗しました', e);
        return;
    }

    try {
        const res = await fetch('./past_exams/index.json');
        availableExams = await res.json();
    } catch (e) {
        console.warn('過去問インデックスの読み込みに失敗しました', e);
    }

    initApp();
}

// アプリの初期化
function initApp() {
    loadProgress();
    updateProgressDisplay();
    generateChapterList();
    generateExamList();
    setupEventListeners();
}

// イベントリスナーの設定
function setupEventListeners() {
    elements.startBtn.addEventListener('click', startQuiz);
    elements.nextBtn.addEventListener('click', nextQuestion);
    elements.showAllBtn.addEventListener('click', showAllBlanks);
    elements.retryBtn.addEventListener('click', retryQuiz);
    elements.resetBtn.addEventListener('click', resetProgress);
    elements.selectAllBtn.addEventListener('click', selectAllChapters);
    elements.deselectAllBtn.addEventListener('click', deselectAllChapters);

    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });
}

// モード切り替え
function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    document.getElementById('anaumeSection').classList.toggle('hidden', mode !== 'anaume');
    document.getElementById('kakomonSection').classList.toggle('hidden', mode !== 'kakomon');

    document.getElementById('modeDesc').textContent = mode === 'anaume'
        ? '穴埋め部分をクリックすると答えが表示されます'
        : '選択した試験からランダムに10問出題されます';
}

// 進捗の読み込み
function loadProgress() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.completedQuestions = new Set(data.completedQuestions || []);
        }
    } catch (e) {
        console.error('進捗の読み込みに失敗しました', e);
    }
}

// 進捗の保存
function saveProgress() {
    try {
        const data = {
            completedQuestions: Array.from(state.completedQuestions)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('進捗の保存に失敗しました', e);
    }
}

// 進捗表示の更新
function updateProgressDisplay() {
    const completed = state.completedQuestions.size;
    const total = questions.length;
    elements.progress.textContent = `${completed} / ${total} 問完了`;
}

// 章リストを生成
function generateChapterList() {
    elements.chapterList.innerHTML = '';

    const questionCountByChapter = {};
    questions.forEach(q => {
        questionCountByChapter[q.chapter] = (questionCountByChapter[q.chapter] || 0) + 1;
    });

    Object.keys(chapters).forEach(chapterId => {
        const chapter = chapters[chapterId];
        const questionCount = questionCountByChapter[chapterId] || 0;

        if (questionCount === 0) return;

        const div = document.createElement('div');
        div.className = 'chapter-item selected';
        div.innerHTML = `
            <input type="checkbox" id="chapter-${chapterId}" checked>
            <label for="chapter-${chapterId}">${chapter.title}</label>
            <span class="question-badge">${questionCount}問</span>
        `;

        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', () => {
            toggleChapter(chapterId, checkbox.checked);
            div.classList.toggle('selected', checkbox.checked);
        });

        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                checkbox.checked = !checkbox.checked;
                toggleChapter(chapterId, checkbox.checked);
                div.classList.toggle('selected', checkbox.checked);
            }
        });

        elements.chapterList.appendChild(div);
        state.selectedChapters.add(parseInt(chapterId));
    });
}

// 試験リストを生成
function generateExamList() {
    const list = document.getElementById('examList');
    if (!list || availableExams.length === 0) return;
    list.innerHTML = '';

    availableExams.forEach(exam => {
        const div = document.createElement('div');
        div.className = 'chapter-item selected';
        div.innerHTML = `
            <input type="checkbox" id="exam-${exam.id}" checked>
            <label for="exam-${exam.id}">${exam.label}</label>
            <span class="question-badge">${exam.count}問</span>
        `;

        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                state.selectedExams.add(exam.id);
            } else {
                state.selectedExams.delete(exam.id);
            }
            div.classList.toggle('selected', checkbox.checked);
        });

        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    state.selectedExams.add(exam.id);
                } else {
                    state.selectedExams.delete(exam.id);
                }
                div.classList.toggle('selected', checkbox.checked);
            }
        });

        list.appendChild(div);
        state.selectedExams.add(exam.id);
    });
}

// 章の選択を切り替え
function toggleChapter(chapterId, selected) {
    if (selected) {
        state.selectedChapters.add(parseInt(chapterId));
    } else {
        state.selectedChapters.delete(parseInt(chapterId));
    }
}

// すべての章を選択
function selectAllChapters() {
    const checkboxes = elements.chapterList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const chapterId = parseInt(checkbox.id.replace('chapter-', ''));
        state.selectedChapters.add(chapterId);
        checkbox.closest('.chapter-item').classList.add('selected');
    });
}

// すべての章を解除
function deselectAllChapters() {
    const checkboxes = elements.chapterList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const chapterId = parseInt(checkbox.id.replace('chapter-', ''));
        state.selectedChapters.delete(chapterId);
        checkbox.closest('.chapter-item').classList.remove('selected');
    });
}

// クイズ開始（モードに応じて分岐）
async function startQuiz() {
    if (state.mode === 'kakomon') {
        await startKakomonQuiz();
    } else {
        startAnaumeQuiz();
    }
}

// 穴埋めクイズ開始
function startAnaumeQuiz() {
    if (state.selectedChapters.size === 0) {
        alert('出題範囲を1つ以上選択してください');
        return;
    }

    const filteredQuestions = questions.filter(q =>
        state.selectedChapters.has(q.chapter)
    );

    if (filteredQuestions.length === 0) {
        alert('選択した章に問題がありません');
        return;
    }

    shuffleArray(filteredQuestions);
    state.currentQuestions = filteredQuestions.slice(0, QUESTIONS_PER_QUIZ);
    state.currentIndex = 0;
    state.revealedBlanks.clear();

    showScreen('quiz');
    displayQuestion();
}

// 過去問クイズ開始
async function startKakomonQuiz() {
    if (state.selectedExams.size === 0) {
        alert('試験を1つ以上選択してください');
        return;
    }

    let allQuestions = [];
    for (const examId of state.selectedExams) {
        const exam = availableExams.find(e => e.id === examId);
        if (!exam) continue;
        try {
            const res = await fetch(`./${exam.file}`);
            const data = await res.json();
            data.questions.forEach(q => { q._examLabel = exam.label; });
            allQuestions = allQuestions.concat(data.questions);
        } catch (e) {
            console.error(`過去問の読み込みに失敗しました: ${examId}`, e);
        }
    }

    if (allQuestions.length === 0) {
        alert('問題を読み込めませんでした');
        return;
    }

    shuffleArray(allQuestions);
    state.currentQuestions = allQuestions.slice(0, QUESTIONS_PER_QUIZ);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.answerSelected = false;

    showScreen('quiz');
    displayKakomonQuestion();
}

// 配列をシャッフル (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 穴埋め問題を表示
function displayQuestion() {
    const question = state.currentQuestions[state.currentIndex];

    elements.questionNumber.textContent =
        `問題 ${state.currentIndex + 1} / ${state.currentQuestions.length}`;
    const chapter = chapters[question.chapter];
    const sectionName = chapter.sections[question.section] || '';
    elements.questionCategory.textContent = `${chapter.title} / ${sectionName}`;

    elements.questionText.innerHTML = parseQuestionText(question.text, question.id);

    elements.showAllBtn.classList.remove('hidden');
    elements.nextBtn.disabled = false;
    elements.choicesContainer.classList.add('hidden');

    setupBlankEvents();
    state.revealedBlanks.clear();
}

// 過去問を表示
function displayKakomonQuestion() {
    const question = state.currentQuestions[state.currentIndex];
    state.answerSelected = false;

    elements.questionNumber.textContent =
        `問題 ${state.currentIndex + 1} / ${state.currentQuestions.length}`;
    elements.questionCategory.textContent =
        `${question._examLabel}　問${question.number}`;

    elements.questionText.innerHTML = escapeHtml(question.instruction).replace(/\n/g, '<br>');

    elements.showAllBtn.classList.add('hidden');
    elements.nextBtn.disabled = true;
    elements.choicesContainer.classList.remove('hidden');
    elements.choicesContainer.innerHTML = '';

    question.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `<span class="choice-key">${escapeHtml(choice.key)}</span><span class="choice-text">${escapeHtml(choice.text)}</span>`;
        btn.addEventListener('click', () => selectChoice(btn, question));
        elements.choicesContainer.appendChild(btn);
    });
}

// 選択肢を選択
function selectChoice(btn, question) {
    if (state.answerSelected) return;
    state.answerSelected = true;

    const allBtns = elements.choicesContainer.querySelectorAll('.choice-btn');
    allBtns.forEach(b => { b.disabled = true; });

    const selectedKey = btn.querySelector('.choice-key').textContent;
    if (selectedKey === question.answer) {
        btn.classList.add('choice-correct');
        state.correctCount++;
    } else {
        btn.classList.add('choice-wrong');
        allBtns.forEach(b => {
            if (b.querySelector('.choice-key').textContent === question.answer) {
                b.classList.add('choice-correct');
            }
        });
    }

    elements.nextBtn.disabled = false;
}

// 問題テキストをパース（穴埋め用）
function parseQuestionText(text, questionId) {
    let blankIndex = 0;
    return text.replace(/\{\{(.+?)\}\}/g, (match, answer) => {
        const blankId = `${questionId}-${blankIndex++}`;
        return `<span class="blank" data-answer="${escapeHtml(answer)}" data-blank-id="${blankId}"></span>`;
    });
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 穴埋め部分のイベント設定
function setupBlankEvents() {
    const blanks = elements.questionText.querySelectorAll('.blank');
    blanks.forEach(blank => {
        blank.addEventListener('click', () => revealBlank(blank));
    });
}

// 穴埋め部分を表示
function revealBlank(blank) {
    if (blank.classList.contains('revealed')) return;

    const answer = blank.dataset.answer;
    blank.textContent = answer;
    blank.classList.add('revealed');

    state.revealedBlanks.add(blank.dataset.blankId);
    checkAllRevealed();
}

// すべての穴が表示されたか確認
function checkAllRevealed() {
    const blanks = elements.questionText.querySelectorAll('.blank');
    const allRevealed = Array.from(blanks).every(b => b.classList.contains('revealed'));

    if (allRevealed) {
        const question = state.currentQuestions[state.currentIndex];
        state.completedQuestions.add(question.id);
        saveProgress();
        updateProgressDisplay();
    }
}

// すべての穴埋めを表示
function showAllBlanks() {
    const blanks = elements.questionText.querySelectorAll('.blank');
    blanks.forEach(blank => revealBlank(blank));
}

// 次の問題へ
function nextQuestion() {
    state.currentIndex++;

    if (state.currentIndex >= state.currentQuestions.length) {
        showResult();
    } else {
        if (state.mode === 'kakomon') {
            displayKakomonQuestion();
        } else {
            displayQuestion();
        }
    }
}

// 結果画面を表示
function showResult() {
    const resultTitle = document.querySelector('#resultScreen h2');
    if (state.mode === 'kakomon') {
        const total = state.currentQuestions.length;
        const correct = state.correctCount;
        const pct = Math.round(correct / total * 100);
        resultTitle.textContent = '結果発表！';
        elements.resultText.textContent =
            `${total}問中 ${correct}問正解（正答率 ${pct}%）`;
    } else {
        resultTitle.textContent = '学習完了!';
        const completed = state.completedQuestions.size;
        const total = questions.length;
        elements.resultText.textContent =
            `全${state.currentQuestions.length}問を学習しました。累計 ${completed} / ${total} 問完了です。`;
    }
    showScreen('result');
}

// やり直し
function retryQuiz() {
    showScreen('start');
}

// 進捗リセット
function resetProgress() {
    if (confirm('進捗をリセットしますか?')) {
        state.completedQuestions.clear();
        localStorage.removeItem(STORAGE_KEY);
        updateProgressDisplay();
        showScreen('start');
    }
}

// 画面切り替え
function showScreen(screen) {
    elements.startScreen.classList.add('hidden');
    elements.quizScreen.classList.add('hidden');
    elements.resultScreen.classList.add('hidden');

    switch (screen) {
        case 'start':
            elements.startScreen.classList.remove('hidden');
            break;
        case 'quiz':
            elements.quizScreen.classList.remove('hidden');
            break;
        case 'result':
            elements.resultScreen.classList.remove('hidden');
            break;
    }
}

// アプリ起動
init();

// Service Worker登録
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
}

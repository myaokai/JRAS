// アプリケーションの状態
const state = {
    currentQuestions: [],
    currentIndex: 0,
    completedQuestions: new Set(),
    revealedBlanks: new Set(),
    selectedChapters: new Set()
};

// 設定
const QUESTIONS_PER_QUIZ = 10;

// DOM要素
const elements = {
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
    progress: document.getElementById('progress'),
    resultText: document.getElementById('resultText')
};

// LocalStorage キー
const STORAGE_KEY = 'quizProgress';

// 初期化
function init() {
    loadProgress();
    updateProgressDisplay();
    generateChapterList();
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

    // 各章の問題数をカウント
    const questionCountByChapter = {};
    questions.forEach(q => {
        questionCountByChapter[q.chapter] = (questionCountByChapter[q.chapter] || 0) + 1;
    });

    // 章リストを生成
    Object.keys(chapters).forEach(chapterId => {
        const chapter = chapters[chapterId];
        const questionCount = questionCountByChapter[chapterId] || 0;

        // 問題がない章はスキップ
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

        // 初期状態ですべて選択
        state.selectedChapters.add(parseInt(chapterId));
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

// クイズ開始
function startQuiz() {
    // 選択された章がない場合はアラート
    if (state.selectedChapters.size === 0) {
        alert('出題範囲を1つ以上選択してください');
        return;
    }

    // 選択された章の問題をフィルタリング
    const filteredQuestions = questions.filter(q =>
        state.selectedChapters.has(q.chapter)
    );

    if (filteredQuestions.length === 0) {
        alert('選択した章に問題がありません');
        return;
    }

    // シャッフルしてランダムに10問選択
    shuffleArray(filteredQuestions);
    state.currentQuestions = filteredQuestions.slice(0, QUESTIONS_PER_QUIZ);

    state.currentIndex = 0;
    state.revealedBlanks.clear();

    showScreen('quiz');
    displayQuestion();
}

// 配列をシャッフル (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 問題を表示
function displayQuestion() {
    const question = state.currentQuestions[state.currentIndex];

    elements.questionNumber.textContent =
        `問題 ${state.currentIndex + 1} / ${state.currentQuestions.length}`;
    const chapter = chapters[question.chapter];
    const sectionName = chapter.sections[question.section] || "";
    elements.questionCategory.textContent = `${chapter.title} / ${sectionName}`;

    // 穴埋め部分を変換
    const html = parseQuestionText(question.text, question.id);
    elements.questionText.innerHTML = html;

    // 穴埋め部分にイベントを設定
    setupBlankEvents();

    state.revealedBlanks.clear();
}

// 問題テキストをパース
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

    // すべて表示したか確認
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
        displayQuestion();
    }
}

// 結果画面を表示
function showResult() {
    const completed = state.completedQuestions.size;
    const total = questions.length;
    elements.resultText.textContent =
        `全${state.currentQuestions.length}問を学習しました。累計 ${completed} / ${total} 問完了です。`;
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

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
    mode: 'anaume',        // 'anaume' | 'kakomon'
    correctCount: 0,
    answerSelected: false,
    filterWrong: false,       // 過去問：誤答フィルター
    filterUnlearned: false,   // 穴埋め：未習得フィルター
    isAuthenticated: false
};

const QUESTIONS_PER_QUIZ    = 10;
const STORAGE_KEY           = 'quizProgress';
const KAKOMON_HISTORY_KEY   = 'kakomonHistory';
const PROBLEM_RECORD_KEY    = 'problemRecord';

const elements = {
    appContainer:     document.getElementById('appContainer'),
    startScreen:      document.getElementById('startScreen'),
    quizScreen:       document.getElementById('quizScreen'),
    resultScreen:     document.getElementById('resultScreen'),
    startBtn:         document.getElementById('startBtn'),
    nextBtn:          document.getElementById('nextBtn'),
    showAllBtn:       document.getElementById('showAllBtn'),
    retryBtn:         document.getElementById('retryBtn'),
    resetBtn:         document.getElementById('resetBtn'),
    chapterList:      document.getElementById('chapterList'),
    selectAllBtn:     document.getElementById('selectAllBtn'),
    deselectAllBtn:   document.getElementById('deselectAllBtn'),
    questionNumber:   document.getElementById('questionNumber'),
    questionCategory: document.getElementById('questionCategory'),
    questionText:     document.getElementById('questionText'),
    choicesContainer: document.getElementById('choicesContainer'),
    resultText:       document.getElementById('resultText')
};

// ── 初期化 ────────────────────────────────────────────────

async function init() {
    try {
        const res = await fetch('./questions.json');
        const data = await res.json();
        questions = data.questions;
        chapters  = data.chapters;
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

function initApp() {
    loadProgress();
    generateChapterList();
    generateExamList();
    setupEventListeners();
    renderAnaumeFilter();
}

function setupEventListeners() {
    elements.startBtn.addEventListener('click', startQuiz);
    elements.nextBtn.addEventListener('click', nextQuestion);
    elements.showAllBtn.addEventListener('click', showAllBlanks);
    elements.retryBtn.addEventListener('click', retryQuiz);
    elements.resetBtn.addEventListener('click', () => showScreen('start'));
    elements.selectAllBtn.addEventListener('click', selectAllChapters);
    elements.deselectAllBtn.addEventListener('click', deselectAllChapters);

    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    document.getElementById('filterWrongBtn')
        ?.addEventListener('click', toggleFilterWrong);
    document.getElementById('filterUnlearnedBtn')
        ?.addEventListener('click', toggleFilterUnlearned);
}

// ── モード切り替え ─────────────────────────────────────────

function switchMode(mode) {
    state.mode = mode;

    // 穴埋めに戻ったらフィルターをリセット
    if (mode !== 'kakomon' && state.filterWrong) {
        state.filterWrong = false;
        document.getElementById('filterWrongBtn')?.classList.remove('active');
    }

    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    document.getElementById('anaumeSection').classList.toggle('hidden', mode !== 'anaume');
    document.getElementById('kakomonSection').classList.toggle('hidden', mode !== 'kakomon');
    document.getElementById('modeDesc').textContent = mode === 'anaume'
        ? '穴埋め部分をクリックすると答えが表示されます'
        : '選択した試験からランダムに10問出題されます';

    if (mode === 'kakomon') renderKakomonHistory();
    if (mode === 'anaume')  renderAnaumeFilter();
}

// ── 進捗（穴埋め）──────────────────────────────────────────

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

function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            completedQuestions: Array.from(state.completedQuestions)
        }));
    } catch (e) {
        console.error('進捗の保存に失敗しました', e);
    }
}

// ── チャプター選択 ─────────────────────────────────────────

function generateChapterList() {
    elements.chapterList.innerHTML = '';
    const countByChapter = {};
    questions.forEach(q => {
        countByChapter[q.chapter] = (countByChapter[q.chapter] || 0) + 1;
    });

    Object.keys(chapters).forEach(chapterId => {
        const chapter = chapters[chapterId];
        const count = countByChapter[chapterId] || 0;
        if (count === 0) return;

        const div = document.createElement('div');
        div.className = 'chapter-item selected';
        div.innerHTML = `
            <input type="checkbox" id="chapter-${chapterId}" checked>
            <label for="chapter-${chapterId}">${chapter.title}</label>
            <span class="question-badge">${count}問</span>
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

function toggleChapter(chapterId, selected) {
    if (selected) state.selectedChapters.add(parseInt(chapterId));
    else          state.selectedChapters.delete(parseInt(chapterId));
    renderAnaumeFilter();
}

function selectAllChapters() {
    elements.chapterList.querySelectorAll('input').forEach(cb => {
        cb.checked = true;
        state.selectedChapters.add(parseInt(cb.id.replace('chapter-', '')));
        cb.closest('.chapter-item').classList.add('selected');
    });
    renderAnaumeFilter();
}

function deselectAllChapters() {
    elements.chapterList.querySelectorAll('input').forEach(cb => {
        cb.checked = false;
        state.selectedChapters.delete(parseInt(cb.id.replace('chapter-', '')));
        cb.closest('.chapter-item').classList.remove('selected');
    });
    renderAnaumeFilter();
}

// ── 試験選択 ───────────────────────────────────────────────

const SUBJECT_ORDER  = ['kanteishi', 'gyosei'];
const SUBJECT_LABELS = { kanteishi: '鑑定評価理論', gyosei: '行政法規' };

function getExamSubject(examId) {
    return examId.endsWith('_kanteishi') ? 'kanteishi' : 'gyosei';
}

function generateExamList() {
    const list = document.getElementById('examList');
    if (!list || availableExams.length === 0) return;
    list.innerHTML = '';

    const groups = {};
    availableExams.forEach(exam => {
        const subject = getExamSubject(exam.id);
        if (!groups[subject]) groups[subject] = [];
        groups[subject].push(exam);
    });

    SUBJECT_ORDER.forEach(subject => {
        const exams = groups[subject];
        if (!exams || exams.length === 0) return;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'exam-subject-header selected';
        headerDiv.innerHTML = `
            <input type="checkbox" id="subject-${subject}" checked>
            <label for="subject-${subject}">${SUBJECT_LABELS[subject]}</label>
            <span class="question-badge">${exams.reduce((s, e) => s + e.count, 0)}問</span>
        `;

        const subjectCb = headerDiv.querySelector('input');
        subjectCb.addEventListener('change', () => {
            exams.forEach(exam => {
                const examCb = document.getElementById(`exam-${exam.id}`);
                if (!examCb) return;
                examCb.checked = subjectCb.checked;
                if (subjectCb.checked) state.selectedExams.add(exam.id);
                else                   state.selectedExams.delete(exam.id);
                examCb.closest('.chapter-item').classList.toggle('selected', subjectCb.checked);
            });
            headerDiv.classList.toggle('selected', subjectCb.checked);
        });
        headerDiv.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                subjectCb.checked = !subjectCb.checked;
                subjectCb.dispatchEvent(new Event('change'));
            }
        });

        list.appendChild(headerDiv);

        exams.forEach(exam => {
            const yearLabel = exam.label.replace(/\s*(鑑定評価理論|行政法規)/, '').trim();
            const div = document.createElement('div');
            div.className = 'chapter-item selected exam-child-item';
            div.innerHTML = `
                <input type="checkbox" id="exam-${exam.id}" checked>
                <label for="exam-${exam.id}">${yearLabel}</label>
                <span class="question-badge">${exam.count}問</span>
            `;

            const checkbox = div.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) state.selectedExams.add(exam.id);
                else                  state.selectedExams.delete(exam.id);
                div.classList.toggle('selected', checkbox.checked);
                syncSubjectCheckbox(subject, exams);
            });
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            list.appendChild(div);
            state.selectedExams.add(exam.id);
        });
    });

    renderKakomonHistory();
}

function syncSubjectCheckbox(subject, exams) {
    const subjectCb = document.getElementById(`subject-${subject}`);
    if (!subjectCb) return;
    const allChecked  = exams.every(e => state.selectedExams.has(e.id));
    const noneChecked = exams.every(e => !state.selectedExams.has(e.id));
    subjectCb.checked       = allChecked;
    subjectCb.indeterminate = !allChecked && !noneChecked;
    subjectCb.closest('.exam-subject-header').classList.toggle('selected', allChecked || !noneChecked);
}

// ── 問題単位の正誤記録 ────────────────────────────────────

function getProblemRecord() {
    try {
        return JSON.parse(localStorage.getItem(PROBLEM_RECORD_KEY) || '{}');
    } catch { return {}; }
}

function saveProblemRecord(record) {
    try {
        localStorage.setItem(PROBLEM_RECORD_KEY, JSON.stringify(record));
    } catch (e) {
        console.error('問題記録の保存に失敗しました', e);
    }
}

function updateProblemRecord(questionId, correct) {
    const record = getProblemRecord();
    record[questionId] = { lastCorrect: correct, ts: Date.now() };
    saveProblemRecord(record);
}

function getWrongIds() {
    const record = getProblemRecord();
    return Object.entries(record)
        .filter(([, r]) => !r.lastCorrect)
        .map(([id]) => id);
}

// ── 過去問 履歴 ────────────────────────────────────────────

function getKakomonHistory() {
    try {
        return JSON.parse(localStorage.getItem(KAKOMON_HISTORY_KEY) || '[]');
    } catch { return []; }
}

function saveKakomonResult() {
    const history = getKakomonHistory();
    history.unshift({
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('ja-JP',
            { year: 'numeric', month: 'numeric', day: 'numeric' }),
        examIds: [...state.selectedExams],
        total:   state.currentQuestions.length,
        correct: state.correctCount
    });
    if (history.length > 5) history.length = 5;
    localStorage.setItem(KAKOMON_HISTORY_KEY, JSON.stringify(history));
}

function renderKakomonHistory() {
    const history      = getKakomonHistory();
    const filterBar    = document.getElementById('kakomonFilterBar');
    const histSection  = document.getElementById('kakomonHistorySection');
    const histList     = document.getElementById('kakomonHistoryList');
    const countEl      = document.getElementById('filterWrongCount');
    const qCountEl     = document.getElementById('kakomonQuestionCount');
    if (!filterBar || !histSection || !histList) return;

    // フィルターボタン
    const wrongIds = getWrongIds();
    if (wrongIds.length > 0) {
        countEl.textContent = `${wrongIds.length}問`;
        filterBar.classList.remove('hidden');
    } else {
        filterBar.classList.add('hidden');
        if (state.filterWrong) {
            state.filterWrong = false;
            document.getElementById('filterWrongBtn')?.classList.remove('active');
        }
    }

    // 出題数テキスト更新
    if (qCountEl) {
        if (state.filterWrong) {
            const wIds = getWrongIds();
            const outOf = Math.min(wIds.length, QUESTIONS_PER_QUIZ);
            qCountEl.innerHTML = `直近の間違い ${wIds.length}問 から <strong>${outOf}問</strong> 出題します`;
        } else {
            qCountEl.innerHTML = `選択した試験からランダムに<strong>10問</strong>出題されます`;
        }
    }

    // 履歴リスト
    if (history.length === 0) {
        histSection.classList.add('hidden');
        return;
    }
    histSection.classList.remove('hidden');
    histList.innerHTML = '';

    history.forEach(entry => {
        const pct = Math.round(entry.correct / entry.total * 100);
        const examLabels = entry.examIds
            .map(id => availableExams.find(e => e.id === id)?.label || id)
            .join('・');

        const div = document.createElement('div');
        div.className = 'history-entry';
        div.innerHTML = `
            <span class="history-date">${entry.dateStr}</span>
            <span class="history-score">${entry.correct}<em>/${entry.total}</em></span>
            <span class="history-pct">${pct}%</span>
            <span class="history-exams">${escapeHtml(examLabels)}</span>
        `;
        histList.appendChild(div);
    });
}

function toggleFilterWrong() {
    state.filterWrong = !state.filterWrong;
    document.getElementById('filterWrongBtn')?.classList.toggle('active', state.filterWrong);
    renderKakomonHistory();
}

// ── 穴埋め フィルター ─────────────────────────────────────

function getUnlearnedForChapters() {
    return questions.filter(q =>
        state.selectedChapters.has(q.chapter) && !state.completedQuestions.has(q.id)
    );
}

function renderAnaumeFilter() {
    const filterBar = document.getElementById('anaumeFilterBar');
    const countEl   = document.getElementById('filterUnlearnedCount');
    const qCountEl  = document.getElementById('anaumeQuestionCount');
    if (!filterBar) return;

    const unlearned = getUnlearnedForChapters();
    if (unlearned.length > 0) {
        countEl.textContent = `${unlearned.length}問`;
        filterBar.classList.remove('hidden');
    } else {
        filterBar.classList.add('hidden');
        if (state.filterUnlearned) {
            state.filterUnlearned = false;
            document.getElementById('filterUnlearnedBtn')?.classList.remove('active');
        }
    }

    if (qCountEl) {
        if (state.filterUnlearned) {
            const outOf = Math.min(unlearned.length, QUESTIONS_PER_QUIZ);
            qCountEl.innerHTML = `未習得 ${unlearned.length}問 から <strong>${outOf}問</strong> 出題します`;
        } else {
            qCountEl.innerHTML = `選択した章からランダムに<strong>10問</strong>出題されます`;
        }
    }
}

function toggleFilterUnlearned() {
    state.filterUnlearned = !state.filterUnlearned;
    document.getElementById('filterUnlearnedBtn')?.classList.toggle('active', state.filterUnlearned);
    renderAnaumeFilter();
}

// ── クイズ開始 ─────────────────────────────────────────────

async function startQuiz() {
    if (state.mode === 'kakomon') await startKakomonQuiz();
    else                          startAnaumeQuiz();
}

function startAnaumeQuiz() {
    if (state.selectedChapters.size === 0) {
        alert('出題範囲を1つ以上選択してください');
        return;
    }
    let pool = questions.filter(q => state.selectedChapters.has(q.chapter));
    if (state.filterUnlearned) {
        const unlearned = pool.filter(q => !state.completedQuestions.has(q.id));
        if (unlearned.length > 0) pool = unlearned;
    }
    if (pool.length === 0) {
        alert('選択した章に問題がありません');
        return;
    }
    shuffleArray(pool);
    state.currentQuestions = pool.slice(0, QUESTIONS_PER_QUIZ);
    state.currentIndex = 0;
    state.revealedBlanks.clear();
    showScreen('quiz');
    displayQuestion();
}

async function startKakomonQuiz() {
    if (state.filterWrong) {
        await startKakomonFilteredQuiz();
        return;
    }

    if (state.selectedExams.size === 0) {
        alert('試験を1つ以上選択してください');
        return;
    }

    let allQuestions = [];
    for (const examId of state.selectedExams) {
        const exam = availableExams.find(e => e.id === examId);
        if (!exam) continue;
        try {
            const res  = await fetch(`./${exam.file}`);
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
    state.currentQuestions  = allQuestions.slice(0, QUESTIONS_PER_QUIZ);
    state.currentIndex      = 0;
    state.correctCount      = 0;
    state.answerSelected    = false;
    showScreen('quiz');
    displayKakomonQuestion();
}

async function startKakomonFilteredQuiz() {
    const wrongIds = getWrongIds();
    if (wrongIds.length === 0) {
        alert('練習する間違い問題がありません');
        return;
    }
    // 必要な試験ファイルを特定（問題IDのプレフィックスから）
    const examIdsNeeded = [...new Set(
        wrongIds.map(id => availableExams.find(e => id.startsWith(e.id))?.id)
                .filter(Boolean)
    )];

    let allQuestions = [];
    for (const examId of examIdsNeeded) {
        const exam = availableExams.find(e => e.id === examId);
        if (!exam) continue;
        try {
            const res  = await fetch(`./${exam.file}`);
            const data = await res.json();
            data.questions.forEach(q => { q._examLabel = exam.label; });
            allQuestions = allQuestions.concat(data.questions);
        } catch (e) {
            console.error(`過去問の読み込みに失敗しました: ${examId}`, e);
        }
    }

    const filteredQuestions = allQuestions.filter(q => wrongIds.includes(q.id));
    if (filteredQuestions.length === 0) {
        alert('問題を読み込めませんでした');
        return;
    }

    shuffleArray(filteredQuestions);
    state.currentQuestions  = filteredQuestions.slice(0, QUESTIONS_PER_QUIZ);
    state.currentIndex      = 0;
    state.correctCount      = 0;
    state.answerSelected    = false;
    showScreen('quiz');
    displayKakomonQuestion();
}

// ── 問題表示 ───────────────────────────────────────────────

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

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

function displayKakomonQuestion() {
    const question = state.currentQuestions[state.currentIndex];
    state.answerSelected = false;

    elements.questionNumber.textContent =
        `問題 ${state.currentIndex + 1} / ${state.currentQuestions.length}`;
    elements.questionCategory.textContent =
        `${question._examLabel}　問${question.number}`;
    elements.questionText.innerHTML =
        escapeHtml(question.instruction).replace(/\n/g, '<br>');

    elements.showAllBtn.classList.add('hidden');
    elements.nextBtn.disabled = true;
    elements.choicesContainer.classList.remove('hidden');
    elements.choicesContainer.innerHTML = '';

    question.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML =
            `<span class="choice-key">${escapeHtml(choice.key)}</span>` +
            `<span class="choice-text">${escapeHtml(choice.text)}</span>`;
        btn.addEventListener('click', () => selectChoice(btn, question));
        elements.choicesContainer.appendChild(btn);
    });
}

function selectChoice(btn, question) {
    if (state.answerSelected) return;
    state.answerSelected = true;

    const allBtns = elements.choicesContainer.querySelectorAll('.choice-btn');
    allBtns.forEach(b => { b.disabled = true; });

    const selectedKey = btn.querySelector('.choice-key').textContent;
    const correct = selectedKey === question.answer;
    updateProblemRecord(question.id, correct);
    if (correct) {
        btn.classList.add('choice-correct');
        state.correctCount++;
    } else {
        btn.classList.add('choice-wrong');
        allBtns.forEach(b => {
            if (b.querySelector('.choice-key').textContent === question.answer)
                b.classList.add('choice-correct');
        });
    }
    elements.nextBtn.disabled = false;
}

// ── 穴埋め ────────────────────────────────────────────────

function parseQuestionText(text, questionId) {
    let blankIndex = 0;
    return text.replace(/\{\{(.+?)\}\}/g, (match, answer) => {
        const blankId = `${questionId}-${blankIndex++}`;
        return `<span class="blank" data-answer="${escapeHtml(answer)}" data-blank-id="${blankId}"></span>`;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupBlankEvents() {
    elements.questionText.querySelectorAll('.blank').forEach(blank => {
        blank.addEventListener('click', () => revealBlank(blank));
    });
}

function revealBlank(blank) {
    if (blank.classList.contains('revealed')) return;
    blank.textContent = blank.dataset.answer;
    blank.classList.add('revealed');
    state.revealedBlanks.add(blank.dataset.blankId);
    checkAllRevealed();
}

function checkAllRevealed() {
    const blanks = elements.questionText.querySelectorAll('.blank');
    if (Array.from(blanks).every(b => b.classList.contains('revealed'))) {
        const question = state.currentQuestions[state.currentIndex];
        state.completedQuestions.add(question.id);
        saveProgress();
    }
}

function showAllBlanks() {
    elements.questionText.querySelectorAll('.blank').forEach(b => revealBlank(b));
}

// ── ナビゲーション ─────────────────────────────────────────

function nextQuestion() {
    state.currentIndex++;
    if (state.currentIndex >= state.currentQuestions.length) {
        showResult();
    } else {
        if (state.mode === 'kakomon') displayKakomonQuestion();
        else                          displayQuestion();
    }
}

function showResult() {
    const resultTitle = document.querySelector('#resultScreen h2');
    if (state.mode === 'kakomon') {
        saveKakomonResult();
        const pct = Math.round(state.correctCount / state.currentQuestions.length * 100);
        resultTitle.textContent = '結果発表';
        elements.resultText.innerHTML =
            `<span class="result-score">${state.correctCount}<em>/${state.currentQuestions.length}</em></span>` +
            `<span class="result-pct">正答率 ${pct}%</span>`;
    } else {
        resultTitle.textContent = '学習完了';
        elements.resultText.textContent =
            `全${state.currentQuestions.length}問を学習しました。`;
    }
    showScreen('result');
}

function retryQuiz() {
    showScreen('start');
}


function showScreen(screen) {
    elements.startScreen.classList.add('hidden');
    elements.quizScreen.classList.add('hidden');
    elements.resultScreen.classList.add('hidden');

    switch (screen) {
        case 'start':
            elements.startScreen.classList.remove('hidden');
            if (state.mode === 'kakomon') renderKakomonHistory();
            if (state.mode === 'anaume')  renderAnaumeFilter();
            break;
        case 'quiz':
            elements.quizScreen.classList.remove('hidden');
            break;
        case 'result':
            elements.resultScreen.classList.remove('hidden');
            break;
    }
}

// ── 起動 ──────────────────────────────────────────────────

init();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
}

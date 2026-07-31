const { chromium } = require('/Users/murakiy/.nodebrew/node/v22.21.1/lib/node_modules/playwright');
const http = require('http');

const PORT = 8091;
const BASE_URL = 'http://localhost:' + PORT;
const SS_DIR = '/Users/murakiy/sandbox/pwa/screenshots';

function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:' + port, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

async function waitForQuizScreen(page, timeout = 5000) {
  await page.waitForFunction(() => {
    const qs = document.getElementById('quizScreen');
    return qs && !qs.classList.contains('hidden');
  }, { timeout });
}

async function waitForResultScreen(page, timeout = 5000) {
  await page.waitForFunction(() => {
    const rs = document.getElementById('resultScreen');
    return rs && !rs.classList.contains('hidden');
  }, { timeout });
}

async function waitForStartScreen(page, timeout = 5000) {
  await page.waitForFunction(() => {
    const ss = document.getElementById('startScreen');
    return ss && !ss.classList.contains('hidden');
  }, { timeout });
}

(async () => {
  const alreadyRunning = await isPortInUse(PORT);
  if (!alreadyRunning) {
    console.error('ERROR: Server is not running on port ' + PORT);
    process.exit(1);
  }
  console.log('[Server] Running on port ' + PORT);

  const browser = await chromium.launch({ headless: true });

  try {
    // ===== CHECK 1: Progress hidden on start screen =====
    console.log('\n=== CHECK 1: Progress area hidden on start screen ===');
    const page1 = await browser.newPage();
    await page1.setViewportSize({ width: 1280, height: 720 });
    await page1.goto(BASE_URL);
    await page1.waitForTimeout(2000); // wait for JS init + fetch
    await page1.screenshot({ path: SS_DIR + '/check1-start-screen.png', fullPage: true });

    const check1 = await page1.evaluate(() => {
      const progressInfo = document.querySelector('.progress-info');
      const progressSpan = document.getElementById('progress');
      const resetBtn = document.getElementById('resetBtn');
      const startScreen = document.getElementById('startScreen');

      const getInfo = (el, name) => {
        if (!el) return { name, found: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          name,
          found: true,
          visibility: style.visibility,
          display: style.display,
          inlineVisibility: el.style.visibility,
          hidden: el.hidden,
          hasHiddenClass: el.classList.contains('hidden'),
          isActuallyVisible: style.visibility === 'visible' && style.display !== 'none' && rect.width > 0 && rect.height > 0
        };
      };

      return {
        progressInfo: getInfo(progressInfo, 'progress-info'),
        progressSpan: getInfo(progressSpan, 'progress span'),
        resetBtn: getInfo(resetBtn, 'resetBtn'),
        startScreen: getInfo(startScreen, 'startScreen'),
        progressText: progressSpan ? progressSpan.textContent : 'not found'
      };
    });
    console.log('Check 1 result:', JSON.stringify(check1, null, 2));

    // The progress-info has inline style visibility:hidden on start screen
    const progressHidden = check1.progressInfo.visibility === 'hidden' || check1.progressInfo.inlineVisibility === 'hidden';
    console.log('>>> CHECK 1 PASS:', progressHidden ? 'YES - Progress is hidden on start screen' : 'NO - Progress is VISIBLE on start screen');

    await page1.close();

    // ===== CHECK 2: Progress visible during quiz =====
    console.log('\n=== CHECK 2: Progress visible during quiz (過去問 mode) ===');
    const page2 = await browser.newPage();
    await page2.setViewportSize({ width: 1280, height: 720 });
    await page2.goto(BASE_URL);
    await page2.waitForTimeout(2000);

    // Click 過去問（短答式）tab
    await page2.click('[data-mode="kakomon"]');
    await page2.waitForTimeout(500);
    await page2.screenshot({ path: SS_DIR + '/check2-kakomon-tab-selected.png', fullPage: true });
    console.log('Clicked 過去問 tab');

    // Click スタート
    await page2.click('#startBtn');
    console.log('Clicked start button, waiting for quiz screen...');
    await waitForQuizScreen(page2, 8000);
    await page2.waitForTimeout(500);
    await page2.screenshot({ path: SS_DIR + '/check2-quiz-started.png', fullPage: true });
    console.log('Quiz screen is now visible');

    const check2 = await page2.evaluate(() => {
      const progressInfo = document.querySelector('.progress-info');
      const progressSpan = document.getElementById('progress');
      const resetBtn = document.getElementById('resetBtn');
      const quizScreen = document.getElementById('quizScreen');

      const getInfo = (el, name) => {
        if (!el) return { name, found: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          name,
          found: true,
          visibility: style.visibility,
          display: style.display,
          inlineVisibility: el.style.visibility,
          isActuallyVisible: style.visibility === 'visible' && style.display !== 'none' && rect.width > 0 && rect.height > 0
        };
      };

      return {
        progressInfo: getInfo(progressInfo, 'progress-info'),
        progressSpan: getInfo(progressSpan, 'progress span'),
        resetBtn: getInfo(resetBtn, 'resetBtn'),
        quizScreen: getInfo(quizScreen, 'quizScreen'),
        progressText: progressSpan ? progressSpan.textContent : 'not found'
      };
    });
    console.log('Check 2 result:', JSON.stringify(check2, null, 2));

    const progressVisibleDuringQuiz = check2.progressInfo.visibility === 'visible';
    console.log('>>> CHECK 2 PASS:', progressVisibleDuringQuiz ? 'YES - Progress is visible during quiz' : 'NO - Progress is HIDDEN during quiz');

    await page2.close();

    // ===== CHECK 3: Full 10-question quiz (過去問 mode) =====
    console.log('\n=== CHECK 3: Play through full 10-question quiz ===');
    const page3 = await browser.newPage();
    await page3.setViewportSize({ width: 1280, height: 720 });
    await page3.goto(BASE_URL);
    await page3.waitForTimeout(2000);

    // Switch to kakomon mode
    await page3.click('[data-mode="kakomon"]');
    await page3.waitForTimeout(500);

    // Start quiz
    await page3.click('#startBtn');
    await waitForQuizScreen(page3, 8000);
    await page3.waitForTimeout(500);
    await page3.screenshot({ path: SS_DIR + '/check3-q1-before-answer.png', fullPage: true });

    // Play through 10 questions
    for (let i = 0; i < 10; i++) {
      console.log('Question ' + (i + 1) + ' of 10...');

      // Check if result screen appeared early
      const resultEarly = await page3.evaluate(() => {
        const rs = document.getElementById('resultScreen');
        return rs && !rs.classList.contains('hidden');
      });
      if (resultEarly) {
        console.log('  Result screen appeared early at question ' + (i + 1));
        break;
      }

      // In kakomon mode, choices appear in #choicesContainer
      // Click the first choice button
      const choiceVisible = await page3.waitForSelector('#choicesContainer .choice-btn', { timeout: 5000 }).catch(() => null);
      if (!choiceVisible) {
        console.log('  No choice buttons found on question ' + (i + 1));
        // Screenshot for debug
        await page3.screenshot({ path: SS_DIR + '/check3-debug-q' + (i+1) + '.png', fullPage: true });
        break;
      }

      const choices = await page3.$$('#choicesContainer .choice-btn');
      console.log('  Found ' + choices.length + ' choices');

      if (choices.length > 0) {
        // Click choice at index 0 (first option)
        await choices[0].click();
        console.log('  Clicked first choice');
      }

      await page3.waitForTimeout(300);

      // Click 次の問題
      const nextEnabled = await page3.evaluate(() => {
        const btn = document.getElementById('nextBtn');
        return btn && !btn.disabled;
      });
      console.log('  nextBtn enabled:', nextEnabled);

      if (nextEnabled) {
        await page3.click('#nextBtn');
        await page3.waitForTimeout(500);
      } else {
        console.log('  nextBtn is disabled, something went wrong');
        await page3.screenshot({ path: SS_DIR + '/check3-disabled-q' + (i+1) + '.png', fullPage: true });
      }
    }

    await page3.waitForTimeout(1000);

    // Check if result screen is visible
    const resultVisible3 = await page3.evaluate(() => {
      const rs = document.getElementById('resultScreen');
      return rs && !rs.classList.contains('hidden');
    });
    console.log('Result screen visible:', resultVisible3);

    await page3.screenshot({ path: SS_DIR + '/check3-result.png', fullPage: true });

    const check3 = await page3.evaluate(() => {
      const resultScreen = document.getElementById('resultScreen');
      const h2 = resultScreen ? resultScreen.querySelector('h2') : null;
      const resultText = document.getElementById('resultText');
      return {
        resultScreenVisible: resultScreen && !resultScreen.classList.contains('hidden'),
        h2Text: h2 ? h2.textContent : 'not found',
        resultTextHTML: resultText ? resultText.innerHTML : 'not found',
        resultTextContent: resultText ? resultText.textContent : 'not found'
      };
    });
    console.log('Check 3 result:', JSON.stringify(check3, null, 2));

    const hasKekkaHappyo = check3.h2Text && check3.h2Text.includes('結果発表');
    const hasScore = check3.resultTextContent && (check3.resultTextContent.includes('/10') || check3.resultTextContent.includes('/'));
    const hasPercentage = check3.resultTextContent && check3.resultTextContent.includes('%');
    console.log('>>> CHECK 3 PASS:', (hasKekkaHappyo && hasScore && hasPercentage) ? 'YES - Result screen shows 結果発表 with score and percentage' : 'PARTIAL/NO');
    console.log('  - 結果発表 heading:', hasKekkaHappyo);
    console.log('  - Score shown:', hasScore);
    console.log('  - Percentage shown:', hasPercentage);

    await page3.close();

    // ===== CHECK 4: History and filter button after quiz =====
    console.log('\n=== CHECK 4: History and filter button after quiz ===');
    const page4 = await browser.newPage();
    await page4.setViewportSize({ width: 1280, height: 720 });
    await page4.goto(BASE_URL);
    await page4.waitForTimeout(2000);

    // Switch to kakomon and start quiz
    await page4.click('[data-mode="kakomon"]');
    await page4.waitForTimeout(500);
    await page4.click('#startBtn');
    await waitForQuizScreen(page4, 8000);
    await page4.waitForTimeout(500);

    // Play through 10 questions - deliberately get some wrong by clicking first choice
    for (let i = 0; i < 10; i++) {
      const resultEarly = await page4.evaluate(() => {
        const rs = document.getElementById('resultScreen');
        return rs && !rs.classList.contains('hidden');
      });
      if (resultEarly) break;

      const choiceEl = await page4.waitForSelector('#choicesContainer .choice-btn', { timeout: 5000 }).catch(() => null);
      if (!choiceEl) break;

      const choices = await page4.$$('#choicesContainer .choice-btn');
      if (choices.length > 0) {
        await choices[0].click(); // Always pick first choice (likely some will be wrong)
      }
      await page4.waitForTimeout(300);

      const nextEnabled = await page4.evaluate(() => {
        const btn = document.getElementById('nextBtn');
        return btn && !btn.disabled;
      });
      if (nextEnabled) {
        await page4.click('#nextBtn');
        await page4.waitForTimeout(400);
      }
    }

    await page4.waitForTimeout(1000);
    await page4.screenshot({ path: SS_DIR + '/check4-result-before-retry.png', fullPage: true });

    // Capture score before going back
    const resultBeforeRetry = await page4.evaluate(() => {
      const resultText = document.getElementById('resultText');
      return {
        content: resultText ? resultText.textContent : 'not found',
        html: resultText ? resultText.innerHTML : 'not found'
      };
    });
    console.log('Result before retry:', JSON.stringify(resultBeforeRetry));

    // Click もう一度 to go back
    await page4.click('#retryBtn');
    await waitForStartScreen(page4, 5000);
    await page4.waitForTimeout(500);
    await page4.screenshot({ path: SS_DIR + '/check4-back-to-start.png', fullPage: true });
    console.log('Clicked もう一度, back to start screen');

    // Switch to 過去問 tab
    await page4.click('[data-mode="kakomon"]');
    await page4.waitForTimeout(800); // give time for renderKakomonHistory
    await page4.screenshot({ path: SS_DIR + '/check4-kakomon-after-quiz.png', fullPage: true });
    console.log('Switched to 過去問 tab');

    // Check for 前回の間違いを練習 button and 学習履歴
    const check4 = await page4.evaluate(() => {
      const filterBar = document.getElementById('kakomonFilterBar');
      const filterBtn = document.getElementById('filterWrongBtn');
      const filterCount = document.getElementById('filterWrongCount');
      const histSection = document.getElementById('kakomonHistorySection');
      const histList = document.getElementById('kakomonHistoryList');

      const getInfo = (el, name) => {
        if (!el) return { name, found: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          name,
          found: true,
          display: style.display,
          visibility: style.visibility,
          hasHiddenClass: el.classList.contains('hidden'),
          isVisible: !el.classList.contains('hidden') && style.display !== 'none',
          text: el.textContent.trim().substring(0, 100)
        };
      };

      return {
        filterBar: getInfo(filterBar, 'kakomonFilterBar'),
        filterBtn: getInfo(filterBtn, 'filterWrongBtn'),
        filterCount: getInfo(filterCount, 'filterWrongCount'),
        histSection: getInfo(histSection, 'kakomonHistorySection'),
        histList: getInfo(histList, 'kakomonHistoryList'),
        histListHTML: histList ? histList.innerHTML.substring(0, 300) : 'not found'
      };
    });
    console.log('Check 4 elements:', JSON.stringify(check4, null, 2));

    const filterBarVisible = check4.filterBar.isVisible;
    const histSectionVisible = check4.histSection.isVisible;
    console.log('>>> CHECK 4a - 前回の間違いを練習 button visible:', filterBarVisible ? 'YES' : 'NO');
    console.log('>>> CHECK 4b - 学習履歴 section visible:', histSectionVisible ? 'YES' : 'NO');

    // If filter button is visible, click it and check if it turns gold/active
    if (filterBarVisible) {
      console.log('Clicking 前回の間違いを練習 button...');
      await page4.click('#filterWrongBtn');
      await page4.waitForTimeout(500);
      await page4.screenshot({ path: SS_DIR + '/check4-filter-active.png', fullPage: true });

      const btnAfterClick = await page4.evaluate(() => {
        const btn = document.getElementById('filterWrongBtn');
        if (!btn) return null;
        const style = window.getComputedStyle(btn);
        return {
          classList: Array.from(btn.classList),
          isActive: btn.classList.contains('active'),
          backgroundColor: style.backgroundColor,
          color: style.color,
          text: btn.textContent.trim().substring(0, 60)
        };
      });
      console.log('Filter button after click:', JSON.stringify(btnAfterClick));

      const isGoldActive = btnAfterClick && btnAfterClick.isActive;
      console.log('>>> CHECK 4c - Button turns active/gold after click:', isGoldActive ? 'YES' : 'NO');
      console.log('  Background color:', btnAfterClick ? btnAfterClick.backgroundColor : 'unknown');
    } else {
      console.log('>>> CHECK 4c - Cannot test button click (button not visible)');
      // Investigate why - check localStorage
      const localStorageData = await page4.evaluate(() => {
        const h = localStorage.getItem('kakomonHistory');
        return h ? JSON.parse(h) : null;
      });
      console.log('localStorage kakomonHistory:', JSON.stringify(localStorageData, null, 2));
    }

    await page4.close();

    console.log('\n[Done] All checks completed');

  } finally {
    await browser.close();
  }
})().catch(e => { console.error('Error:', e.message, e.stack); process.exit(1); });

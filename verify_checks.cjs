// 画面の動作確認（Playwright）。事前に `npm run build && npx vite preview --port 8091` を起動しておく。
// 失敗した確認があれば終了コード1で終わる。スクリーンショットは screenshots/ に保存する。
const { chromium } = require('/Users/murakiy/.nodebrew/node/v22.21.1/lib/node_modules/playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 8091;
const BASE_URL = 'http://localhost:' + PORT;
const SS_DIR = path.join(__dirname, 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:' + port, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

function dayStr(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const yesterday = () => dayStr(-1);

async function newPage(browser, errors) {
  const context = await browser.newContext(MOBILE);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: path.join(SS_DIR, name + '.png') });
const text = (page, sel) => page.$eval(sel, (el) => el.textContent);

// 穴埋めを1セット最後まで解く（すべて「わかった」）
async function playAnaume(page) {
  for (let i = 0; i < 20; i++) {
    if (await page.$('#resultScreen')) return;
    if (await page.$('#showAllBtn')) await page.click('#showAllBtn');
    await page.click('.assess-btn.known');
    await page.click('#nextBtn');
  }
}

(async () => {
  if (!(await isPortInUse(PORT))) {
    console.error('ERROR: Server is not running on port ' + PORT);
    process.exit(1);
  }
  fs.mkdirSync(SS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  try {
    // ── 1. 旧形式（localStorage）からの移行 ──
    {
      const { context, page } = await newPage(browser, errors);
      await page.addInitScript((ys) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        const ts = new Date(ys + 'T12:00:00').getTime();
        localStorage.setItem('problemRecord', JSON.stringify({
          '1': { box: 0, dueDate: ys, lastResult: false, ts },
          R07_kanteishi_001: { box: 0, dueDate: ys, lastResult: false, ts },
        }));
        localStorage.setItem('habitRecord', JSON.stringify({ lastStudyDate: ys, currentStreak: 6, longestStreak: 12, todayDate: ys, todayCount: 4 }));
      }, yesterday());
      await page.goto(BASE_URL);
      await page.waitForSelector('#homeScreen');
      await shot(page, '01-home-migrated');
      const streak = await text(page, '#streak');
      check('移行: 連続日数が引き継がれる', streak.includes('6日連続') && streak.includes('最長 12日'), streak);
      check('移行: 復習期限の件数が出る', !!(await page.$('#reviewAnaumeBtn')) && !!(await page.$('#reviewKakomonBtn')));
      await page.reload();
      await page.waitForSelector('#homeScreen');
      check('移行: 再読み込みしても二重に移行しない', (await text(page, '#streak')).includes('6日連続'));
      await context.close();
    }

    // ── 2. 下部タブと戻る操作 ──
    const { context, page } = await newPage(browser, errors);
    await page.goto(BASE_URL);
    await page.waitForSelector('#homeScreen');
    const tabs = await page.$$eval('.tab-item', (els) => els.map((e) => e.textContent));
    check('下部タブが5つある', tabs.length === 5, tabs.join(' / '));
    for (const [tab, screen] of [['study', '#studyScreen'], ['textbook', '#textbookScreen'], ['records', '#recordsScreen'], ['settings', '#settingsScreen']]) {
      await page.click(`[data-tab=${tab}]`);
      check(`タブ「${tab}」で画面が切り替わる`, !!(await page.waitForSelector(screen).catch(() => null)));
    }
    await page.goBack();
    check('戻る操作で前のタブに戻る', !!(await page.waitForSelector('#recordsScreen').catch(() => null)), page.url());

    // ── 3. 穴埋め: 学習 → 範囲選択 → 出題 → 結果 ──
    await page.click('[data-tab=study]');
    await page.click('#modeAnaume');
    await page.waitForSelector('#startScreen');
    await shot(page, '03-anaume-select');
    await page.click('#startBtn');
    await page.waitForSelector('#quizScreen');
    check('出題中は下部タブを隠す', !(await page.$('.tab-bar')) && !!(await page.$('.bottom-bar')));
    check('全部表示するまで自己評価は出ない', !(await page.$('.assess-btn')));
    await page.click('.blank');
    check('穴をタップすると答えが出る', (await page.$$('.blank.revealed')).length === 1);
    await page.click('#showAllBtn');
    await shot(page, '04-anaume-quiz');
    check('すべて表示で自己評価が出る', (await page.$$('.assess-btn')).length === 2);
    await playAnaume(page);
    await page.waitForSelector('#resultScreen');
    await shot(page, '05-result');
    check('結果に10問中10問が出る', (await text(page, '#resultText')).includes('10'));
    await page.goBack();
    check('結果から戻ると範囲選択に戻る（解き終えた問題に戻らない）', !!(await page.waitForSelector('#startScreen').catch(() => null)), page.url());

    await page.click('.header-back');
    await page.waitForSelector('#studyScreen');
    await page.click('[data-tab=home]');
    await page.waitForSelector('#homeScreen');
    const today = await text(page, '#todayCount');
    check('解答がホームの「今日の学習」に反映される', today.trim().startsWith('10'), today);

    // ── 4. 過去問 ──
    await page.goto(BASE_URL + '/#/study/kakomon');
    await page.waitForSelector('#startScreen');
    await page.click('#startBtn');
    await page.waitForSelector('#quizScreen');
    check('過去問: 選ぶまで「次へ」は押せない', await page.$eval('#nextBtn', (b) => b.disabled));
    await page.click('.choice-btn');
    check('過去問: 選ぶと正誤が出る', !!(await page.$('.answer-feedback')));
    check('過去問: 選んだ後は「次へ」が押せる', !(await page.$eval('#nextBtn', (b) => b.disabled)));
    await shot(page, '07-kakomon-answered');
    await page.click('.header-back');
    await page.waitForSelector('#startScreen');
    check('過去問: 履歴に今回のセットが出る', !!(await page.$('#kakomonHistorySection')));

    // ── 5. 出題状態がないまま #/quiz を開く ──
    await page.goto(BASE_URL + '/#/quiz');
    await page.reload();
    await page.waitForSelector('#studyScreen');
    check('#/quiz を直接開くと学習トップに戻す', page.url().endsWith('#/study'), page.url());

    // ── 6. 教科書 ──
    await page.click('[data-tab=textbook]');
    await page.waitForSelector('#textbookScreen');
    await page.click('.list-item');
    await page.click('.list-item');
    await page.waitForSelector('.textbook-body');
    const sectionUrl = page.url();
    check('教科書: 節の本文が URL で表される', /#\/textbook\/\d+\/\d+$/.test(sectionUrl), sectionUrl);
    await page.reload();
    check('教科書: 再読み込みしても同じ節を開く', !!(await page.waitForSelector('.textbook-body').catch(() => null)));
    await shot(page, '09-textbook-section');

    // ── 7. 書き出し → 別のブラウザで読み込み ──
    await page.click('[data-tab=settings]');
    await page.waitForSelector('#settingsScreen');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
    const file = path.join(SS_DIR, 'backup-test.json');
    await download.saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
    check('書き出し: version 2 で解答ログが入っている', backup.version === 2 && backup.answers.length >= 11, `${backup.answers.length}件`);
    check('書き出し: 最終バックアップが更新される', !(await text(page, '#lastBackup')).includes('未実施'));
    await shot(page, '15-settings');
    await context.close();

    const other = await newPage(browser, errors);
    await other.page.goto(BASE_URL + '/#/settings');
    await other.page.waitForSelector('#settingsScreen');
    await other.page.setInputFiles('#importFile', file);
    await other.page.waitForSelector('#settingsMessage');
    check('読み込み: 件数が表示される', (await text(other.page, '#settingsMessage')).includes(`${backup.answers.length}件`));
    await other.page.click('[data-tab=home]');
    await other.page.waitForSelector('#homeScreen');
    check('読み込み: 別のブラウザで今日の解答数が戻る', (await text(other.page, '#todayCount')).trim().startsWith('11'));
    await other.page.click('[data-tab=settings]');
    await other.page.waitForSelector('#settingsScreen');
    await other.page.setInputFiles('#importFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
    await other.page.waitForFunction(() => document.querySelector('#settingsMessage')?.textContent.includes('読み込めませんでした'));
    check('読み込み: 不正なファイルは拒否する', true);
    await other.context.close();
    fs.unlinkSync(file);

    // ── 8. 段階2：節の選択・結果・本番形式・解説・基準リンク・試験日 ──
    {
      // Service Worker を止め、過去問データの差し替え（解説の確認用）が効くようにする
      const context = await browser.newContext({ ...MOBILE, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/past_exams/R07_kanteishi.json', async (route) => {
        const json = await (await route.fetch()).json();
        json.questions[0].explanation = '確認用の解説です。';
        json.questions[0].choices[0].explanation = '確認用の選択肢の解説です。';
        json.questions[0].choices[0].kijunRef = { chapter: '1', section: '1' };
        await route.fulfill({ json });
      });
      const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/questions.json'), 'utf8'));
      const sectionTitle = questions.chapters['8'].sections['4'];
      const sectionCount = questions.questions.filter((q) => q.chapter === 8 && q.section === 4).length;

      await page.goto(BASE_URL + '/#/study/anaume');
      await page.waitForSelector('#startScreen');
      await page.click('text=すべて解除');
      check('範囲: すべて解除で開始できない', await page.$eval('#startBtn', (b) => b.disabled));
      await page.click('[data-chapter="8"] .tree-toggle');
      await page.click('[data-section="8-4"]');
      await page.click('#sizeSelect [data-value="5"]');
      await shot(page, '03-anaume-section');
      check('範囲: 節1つの問題数が出る', (await text(page, '#startBtn')).includes(`${sectionCount}問から`), await text(page, '#startBtn'));
      await page.click('#startBtn');
      await page.waitForSelector('#quizScreen');
      const total = Math.min(sectionCount, 5);
      const categories = [];
      for (let i = 0; i < total; i++) {
        categories.push(await text(page, '#questionCategory'));
        await page.click('#showAllBtn');
        await page.click(i === 0 ? '.assess-btn.unknown' : '.assess-btn.known');
        if (i === 0) {
          // 基準リンク → 教科書 → 戻る
          await page.click('.kijun-link');
          await page.waitForSelector('#textbookScreen .textbook-body');
          check('基準リンク: 該当の節を開く', page.url().includes('#/textbook/8/4?from=quiz'), page.url());
          await page.click('#backToQuizBtn');
          await page.waitForSelector('#quizScreen');
          const title = await text(page, '.app-header h1');
          check('基準リンク: 戻ると同じ問題・回答状態に戻る', title.startsWith('1 /') && !!(await page.$('.answer-feedback.wrong')) && !!(await page.$('#nextBtn')), title);
        }
        await page.click('#nextBtn');
      }
      check('範囲: 選んだ節の問題だけが出る', categories.every((c) => c.includes(sectionTitle)), categories.join(' | '));
      await page.waitForSelector('#resultScreen');
      await page.waitForTimeout(400); // 画面の表示アニメーションが終わるのを待つ
      await shot(page, '05-result-detail');
      const dues = await page.$$eval('.result-item-due', (els) => els.map((e) => e.dataset.due));
      check('結果: 次回の復習日が記録と合う（×は今日、○は翌日）', dues[0] === dayStr(0) && dues.slice(1).every((d) => d === dayStr(1)), dues.join(','));
      await page.click('#retryWrongBtn');
      await page.waitForSelector('#quizScreen');
      check('結果: 間違えた問題だけもう一度（1問）', (await text(page, '.app-header h1')).trim() === '1 / 1');

      // 本番形式（R07 鑑定評価理論 40問）
      await page.goto(BASE_URL + '/#/study/kakomon');
      await page.waitForSelector('#startScreen');
      await page.click('#formatSelect [data-value="exam"]');
      await page.click('#realExamList input[value="R07_kanteishi"]');
      await shot(page, '06-kakomon-exam');
      await page.click('#startBtn');
      await page.waitForSelector('#quizScreen');
      check('本番形式: 40問で問1から始まる', (await text(page, '.app-header h1')).trim() === '1 / 40' && (await text(page, '#questionCategory')).includes('問1'));
      await page.click('.choice-btn');
      check('解説: 解答後に解説が出る', (await text(page, '#explanation')).includes('確認用の解説'));
      await page.$eval('#explanation', (el) => el.scrollIntoView({ block: 'center' }));
      await shot(page, '07-kakomon-explanation');
      await page.click('#explanation .kijun-link');
      await page.waitForSelector('#textbookScreen .textbook-body');
      await page.goBack();
      await page.waitForSelector('#quizScreen');
      check('解説: 基準から戻っても回答が残る', !!(await page.$('#explanation')) && !(await page.$eval('#nextBtn', (b) => b.disabled)));
      let lastNumber = '';
      for (let i = 0; i < 40; i++) {
        if (i > 0) await page.click('.choice-btn');
        lastNumber = await text(page, '#questionCategory');
        await page.click('#nextBtn');
      }
      await page.waitForSelector('#resultScreen');
      check('本番形式: 問40まで番号順に解ける', lastNumber.includes('問40') && (await text(page, '#resultText')).includes('40'), lastNumber);
      await page.goto(BASE_URL + '/#/study/kakomon');
      await page.waitForSelector('#kakomonHistoryList');
      check('本番形式: 履歴に40問のセットが残る', (await text(page, '#kakomonHistoryList .history-entry')).includes('/40'));
      check('過去問: 間違えた問題タブに件数が出る', /間違えた問題 \d+/.test(await text(page, '#kakomonTab')));

      // 試験日と1日の目標
      await page.goto(BASE_URL + '/#/');
      await page.waitForSelector('#homeScreen');
      check('ホーム: 試験日が未設定なら設定を促す', (await text(page, '#examCountdown')).includes('試験日を設定する'));
      await page.click('#examCountdown');
      await page.waitForSelector('#settingsScreen');
      await page.fill('#examDateInput', dayStr(30));
      await page.fill('#dailyGoalInput', '30');
      await page.click('#dailyGoalInput ~ span');
      await page.click('[data-tab=home]');
      await page.waitForSelector('#homeScreen');
      check('ホーム: 試験日を入れると残り日数が出る', (await text(page, '#examDays')).includes('あと 30 日'), await text(page, '#examDays'));
      check('ホーム: 1日の目標が設定値になる', (await text(page, '#todayCount')).includes('/ 30'), await text(page, '#todayCount'));
      await page.reload();
      await page.waitForSelector('#homeScreen');
      check('ホーム: 試験日は再読み込み後も残る', (await text(page, '#examDays')).includes('あと 30 日'));
      await shot(page, '01-home-exam');
      await context.close();
    }

    // ── 9. ログイン切れ（Cloudflare Access）の案内と再ログイン ──
    {
      const context = await browser.newContext({ ...MOBILE, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      // Access のログイン画面へのリダイレクトを再現する
      await page.route('**/api/me', (route) => route.fulfill({ status: 302, headers: { Location: 'https://example.cloudflareaccess.com/cdn-cgi/access/login' } }));
      await page.route('**/api/login', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p id="loginPage">login</p>' }));
      await page.goto(BASE_URL + '/#/');
      await page.waitForSelector('#sessionBanner');
      check('ログイン切れ: ホームに案内が出る', (await text(page, '#sessionBanner')).includes('ログインが切れています'));
      await shot(page, '01-home-session-expired');
      await page.click('[data-tab=settings]');
      await page.waitForSelector('#settingsScreen');
      check('ログイン切れ: 設定に状態が出る', (await text(page, '#serverStatus')).includes('ログインが切れています'));
      await page.click('#reloginBtn');
      await page.waitForSelector('#loginPage');
      check('再ログイン: /api/login を開く', page.url().endsWith('/api/login'), page.url());
      await context.close();
    }

    check('コンソールエラーがない', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('例外なく最後まで進む', false, e.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();

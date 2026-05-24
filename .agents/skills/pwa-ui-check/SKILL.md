---
name: pwa-ui-check
description: Check the PWA app's UI using the locally cached Playwright/Chromium. Avoids reinstalling browsers. Use this instead of the ui-check subagent for this project.
---

## Overview

Playwright (v1.60.0) is globally installed at `~/.nodebrew/current/lib/node_modules/playwright` and Chromium is cached at `~/.cache/ms-playwright/`. You can run UI checks directly via `node` without calling `playwright install`.

**Never spawn the `ui-check` subagent for this project — it reinstalls Chromium every time.**

## How to run a UI check

### Step 1 — Start a local server

```bash
python3 -m http.server <PORT> -d /Users/murakiy/sandbox/pwa &>/dev/null &
sleep 1
```

Use a free port (8090–8099). Check with `lsof -ti:<PORT>` if unsure.

### Step 2 — Write and run a Playwright script

Write a self-contained script to `/tmp/pwa_check.mjs` and run it with `node`:

```bash
node --input-type=module <<'EOF'
import { chromium } from '/Users/murakiy/.nodebrew/current/lib/node_modules/playwright/index.mjs';

const SCREENSHOTS = '/Users/murakiy/sandbox/pwa/screenshots';
const BASE = 'http://localhost:<PORT>';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// ── your checks here ──────────────────────────────────────

await page.goto(BASE);
await page.screenshot({ path: `${SCREENSHOTS}/check-start.png` });

// Example: click a tab
await page.click('[data-mode="kakomon"]');
await page.screenshot({ path: `${SCREENSHOTS}/check-kakomon.png` });

// Example: assert element exists
const btn = await page.$('#startBtn');
console.log('startBtn exists:', !!btn);

// Example: fill and click
// await page.click('#startBtn');
// await page.waitForSelector('#quizScreen:not(.hidden)');

// ─────────────────────────────────────────────────────────

await browser.close();
console.log('Done');
EOF
```

### Step 3 — Kill the server

```bash
kill $(lsof -ti:<PORT>) 2>/dev/null
```

## Useful Playwright snippets

```javascript
// Wait for element
await page.waitForSelector('#quizScreen:not(.hidden)');

// Click nth element
await page.locator('.choice-btn').nth(2).click();

// Get text
const text = await page.locator('#questionNumber').textContent();

// Check visibility
const visible = await page.locator('.progress-info').isVisible();

// Mobile viewport
await page.setViewportSize({ width: 375, height: 667 });

// Evaluate JS in page
const mode = await page.evaluate(() => state.mode);
```

## Screenshots directory

Save screenshots to `/Users/murakiy/sandbox/pwa/screenshots/` (gitignored).

## Example: full flow check

```javascript
import { chromium } from '/Users/murakiy/.nodebrew/current/lib/node_modules/playwright/index.mjs';
const SS = '/Users/murakiy/sandbox/pwa/screenshots';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto('http://localhost:<PORT>');

// 1. Start screen
await page.screenshot({ path: `${SS}/01-start.png` });
const progressVisible = await page.locator('.progress-info').isVisible();
console.log('progress hidden on start:', !progressVisible);

// 2. Kakomon mode
await page.click('[data-mode="kakomon"]');
await page.screenshot({ path: `${SS}/02-kakomon.png` });

// 3. Start quiz
await page.click('#startBtn');
await page.waitForSelector('#quizScreen:not(.hidden)');
await page.screenshot({ path: `${SS}/03-quiz.png` });

// 4. Answer a question
await page.locator('.choice-btn').first().click();
await page.screenshot({ path: `${SS}/04-answered.png` });

await browser.close();
console.log('All checks complete');
```

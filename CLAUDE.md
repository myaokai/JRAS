# CLAUDE.md

## Project Overview

**JRAS** (Japanese Real Estate Appraisal Standards) is a Progressive Web App (PWA) for studying the Japanese Real Estate Appraisal Standards (不動産鑑定評価基準). It presents fill-in-the-blank quiz questions to help learners memorize key concepts from the standards, targeting professionals preparing for real estate appraiser certification.

The app is entirely in Japanese.

## Tech Stack

- **Vanilla JavaScript (ES6+)** — no frameworks, no transpilation
- **Plain HTML5 / CSS3** — no preprocessors
- **PWA** — Service Worker + manifest.json for offline support
- **No build system** — static files served directly, no bundler or package manager
- **No backend** — all state is client-side (LocalStorage / SessionStorage)
- **No dependencies** — zero npm packages, no external libraries

## File Structure

```
JRAS/
├── index.html        # Main HTML entry point (screens: auth, start, quiz, result)
├── app.js            # Application logic (auth, quiz flow, state, persistence)
├── questions.js      # Chapter master data and question definitions
├── style.css         # All styling (responsive, 600px breakpoint)
├── sw.js             # Service Worker (cache-first offline strategy)
├── manifest.json     # PWA manifest
├── .gitignore        # Ignores /data
├── .claude/
│   └── agents/
│       ├── test.md       # Test sub-agent
│       ├── review.md     # Code review sub-agent
│       └── ui-check.md   # UI verification sub-agent (Playwright CLI)
└── icons/
    ├── icon-192.svg  # PWA icon 192x192
    └── icon-512.svg  # PWA icon 512x512
```

## Architecture

### Application Flow

1. **Authentication** — Password screen with SHA-256 hash verification via Web Crypto API. Session stored in `sessionStorage`.
2. **Chapter Selection** — User selects which chapters to study. Chapters are defined in `questions.js`.
3. **Quiz** — 10 random questions from selected chapters. Each question has `{{answer}}` blanks that reveal on click.
4. **Result** — Shows cumulative progress. Progress persists in `localStorage`.

### Key Files

- **`app.js`** — Contains all application logic:
  - `state` object — centralized state (`currentQuestions`, `currentIndex`, `completedQuestions`, `revealedBlanks`, `selectedChapters`, `isAuthenticated`)
  - `authenticate()` — SHA-256 password check
  - `parseQuestionText()` — converts `{{answer}}` syntax to interactive `<span class="blank">` elements
  - `displayQuestion()` / `revealBlank()` / `showAllBlanks()` — quiz interaction
  - `saveProgress()` / `loadProgress()` — LocalStorage persistence
  - `shuffleArray()` — Fisher-Yates shuffle
  - Screen transitions via `showScreen()` toggling CSS `hidden` class

- **`questions.js`** — Data layer:
  - `chapters` object — 12 chapters (keys 1-12), each with `title` and `sections`
  - `questions` array — question objects with `{id, chapter, section, text}`
  - Question text uses `{{answer}}` syntax for blanks

- **`sw.js`** — Service Worker:
  - Cache name: `quiz-app-v0.0.1`
  - Precaches all app assets on install
  - Cache-first strategy for fetches
  - Cleans up old caches on activation

### Constants

| Constant | Value | Location |
|---|---|---|
| `PASSWORD_HASH` | SHA-256 hash string | `app.js:4` |
| `QUESTIONS_PER_QUIZ` | `10` | `app.js:17` |
| `STORAGE_KEY` | `'quizProgress'` | `app.js:45` |
| `AUTH_KEY` | `'quizAuth'` | `app.js:46` |
| `CACHE_NAME` | `'quiz-app-v0.0.1'` | `sw.js` |

### Data Format

Questions follow this structure:

```javascript
{
    id: 1,
    chapter: 1,
    section: 1,
    text: "不動産は、通常、{{土地とその定着物}}をいう。..."
}
```

Blanks are denoted with `{{answer text}}` in the `text` field.

## Development

### Running Locally

Serve the project root with any static HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8000` in a browser.

### No Build Step

There is no build, compilation, or transpilation. Edit files directly and refresh the browser.

### No Tests

There is no test framework or automated tests configured.

### No Linting/Formatting

There is no ESLint, Prettier, or other code quality tooling configured.

### UI Verification with Playwright CLI

The `/ui-check` agent uses [Playwright](https://playwright.dev/) via Node.js scripts to interact with the app in a headless browser. No MCP server is needed — Playwright runs directly as CLI scripts, which is more efficient for batch operations.

**Using the UI check agent:**

In Claude Code, use the `/ui-check` agent to run an automated UI verification. The agent will:
1. Install Playwright if needed (`npx playwright install chromium`)
2. Start a local HTTP server (`python3 -m http.server 8080`)
3. Execute Playwright scripts to navigate, interact, and take screenshots
4. Verify screen transitions, interactions, and responsive layout
5. Report findings with screenshots saved to `screenshots/`

## Conventions

### Code Style

- All code comments are in **Japanese**
- Functions use **camelCase** naming
- DOM element references are centralized in the `elements` object (`app.js:20-42`)
- Event listeners are set up in dedicated `setup*Listeners()` functions
- Screen transitions use CSS class `hidden` toggling, not routing
- HTML is escaped via `escapeHtml()` when inserting user/data content into the DOM

### Git Commit Style

Commit messages use the format: `<type>: <description in Japanese>`

Examples from history:
- `feat: 穴埋め問題集アプリを作成`
- `add: 認証追加`
- `update: 問題選択を追加`
- `update: pwa対応`

### Adding New Questions

1. Add question objects to the `questions` array in `questions.js`
2. Use unique `id` values (current max is 12)
3. Set `chapter` and `section` to match entries in the `chapters` object
4. Wrap answer text in `{{double braces}}` within the `text` field
5. If adding a new chapter, add it to the `chapters` object first with `title` and `sections`

### Updating the Service Worker Cache

When files change, bump the `CACHE_NAME` version in `sw.js` (e.g., `quiz-app-v0.0.2`) so browsers pick up the new assets.

## Known Issues

- Three placeholder question entries at the end of `questions.js` (lines 182-198) have duplicate `id: 11` and empty `text` — these are unused stubs
- Password hash is stored client-side in `app.js` — not suitable for protecting sensitive data
- Session auth clears on page reload (uses `sessionStorage`)

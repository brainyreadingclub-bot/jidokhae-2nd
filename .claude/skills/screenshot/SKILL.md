---
name: screenshot
description: >
  Capture full-page screenshots of every page on a website and organize them for AI review.
  Use this skill whenever the user wants to capture, screenshot, or photograph web pages for review.
  Triggers on: /screenshot, 스크린샷, 화면 캡처, capture screens, screenshot all pages,
  UI 리뷰 자료, 화면 정리, 전체 화면 찍어줘, take screenshots of the site.
  Also trigger when the user wants to share their web app screens with AI for feedback,
  or wants to document the current state of their UI.
---

# Screenshot Skill

Capture every page of a website as full-page PNG screenshots, organized for AI (Claude, Gemini) review.

## Bundled Script

This skill includes a ready-to-run Playwright capture script at `scripts/capture.mjs`.
The script handles crawling, capturing, organizing, README generation, and history management.

## Execution Flow

### Step 1: Determine Parameters

From the user's message or by asking, determine:
- **Base URL** — required (e.g., `https://example.com` or `http://localhost:3000`)
- **Auth needed?** — does the site require login? (adds `--auth` flag)
- **Output directory** — where to save (default: `./screenshots/` in cwd)
- **Viewport** — mobile (default) or `--desktop`
- **URL list** — if user provides specific URLs instead of crawling, write them to a temp file

If the user already specified these, don't re-ask.

### Step 2: Ensure Playwright is Available

The skill bundles its own `package.json` with playwright. On first use (or if `node_modules` is missing):

```bash
cd <skill-dir>/scripts && npm install && npx playwright install chromium
```

After initial setup, this step is skipped.

### Step 3: Run the Capture Script

The script path is relative to this skill's directory.

```bash
node <skill-dir>/scripts/capture.mjs <baseUrl> [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--output`, `-o` | Output directory | `./screenshots` |
| `--max-pages` | Max pages to crawl | 50 |
| `--viewport` | Viewport WxH | 390x844 |
| `--desktop` | Use 1280x800 viewport | off |
| `--auth` | Headed mode for manual login | off |
| `--urls` | Path to URL list file (skip crawling) | none |
| `--keep` | Number of historical captures to retain | 5 |
| `--delay` | Delay between captures in ms | 500 |

**Examples:**
```bash
# Basic crawl
node capture.mjs https://example.com -o ./screenshots

# With login required
node capture.mjs https://myapp.com --auth -o ./ui-review

# Desktop viewport with specific URLs
node capture.mjs https://example.com --desktop --urls urls.txt

# Local dev server
node capture.mjs http://localhost:3000 --auth
```

### Step 4: Auth Flow (when --auth is used)

The script launches a **visible browser** and navigates to the base URL.
It then pauses with a prompt: "로그인 완료 후 Enter를 눌러주세요..."
The user logs in manually in the browser, then presses Enter in the terminal.
The script continues capturing with the authenticated session.

### Step 5: Present Results

After the script completes, tell the user:
- How many pages were captured
- Where `latest/` folder is (for easy AI sharing)
- Suggest: "Attach the `latest/` folder (README + PNGs) to Claude or Gemini for UI/UX review."

## Output Structure

```
<output-dir>/
├── 2026-03-25/              ← previous capture
│   ├── README.md
│   ├── 01-homepage.png
│   └── ...
├── 2026-03-26/              ← today's capture
│   ├── README.md
│   ├── 01-homepage.png
│   └── ...
└── latest/                  ← copy of most recent
    ├── README.md
    ├── 01-homepage.png
    └── ...
```

**Retention:** Keeps the 5 most recent date folders. Older captures are auto-deleted.

**File naming:** `{index}-{slugified-path}.png` — e.g., `01-homepage.png`, `02-about.png`, `03-meetings-detail.png`

## When the Project Already Has a Capture Script

If the project has its own screenshot script (e.g., `npm run screenshot` in package.json), ask the user which to use:
- **Project script** — may have auth handling, specific routes, better coverage for that project
- **This skill's script** — general-purpose, crawl-based, works on any URL

## Edge Cases

- **SPA**: Client-rendered apps may expose few `<a href>` links. If crawl finds < 5 pages, suggest the user provide a URL list file with `--urls`.
- **Dynamic IDs**: The crawl captures each unique pathname once. For routes like `/items/123`, only one representative page is captured.
- **Timeouts**: 30s per page. Failures are logged but don't stop the run.
- **Rate limiting**: 500ms default delay between captures. Increase with `--delay` if the server is slow.

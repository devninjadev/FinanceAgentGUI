# Installation And Local Run Guide

This document is for people or local agents setting up FinanceAgentGUI from the `GuiBuild/` folder.

The app is intentionally a local web console. It runs a local server, opens in a browser, and stores user-specific state under local `data/` and `logs/` directories.

## Supported Shape

- Distribution root: `GuiBuild/`
- Web app: `GuiBuild/web`
- Frontend: Vite + React
- Local server/API layer: Node.js modules under `GuiBuild/web/server`
- Python helper scripts: `GuiBuild/scripts`
- Runtime state: `GuiBuild/data`
- Runtime logs: `GuiBuild/logs`

Do not require files outside `GuiBuild/` for normal installation or execution.

## Prerequisites

Recommended baseline:

- Node.js 22 or newer
- npm matching the installed Node.js runtime
- Python 3.11 or newer for optional finance helper scripts
- A Chromium-family browser for browser-login handoff flows: Chrome, Edge, Chromium, or Brave

Node 22 is recommended because browser-login handoff code uses the built-in `WebSocket` client to talk to the browser DevTools Protocol. If a user is on an older Node runtime, either upgrade Node or patch the handoff implementation to use a project dependency with equivalent WebSocket support.

## Windows Shell Choice

On Windows, use this order:

1. PowerShell: primary supported path
2. CMD: acceptable for simple `npm` commands, but not the documentation default
3. WSL: advanced development/repair path only, not the default runtime path

PowerShell should be the default user-facing setup path because it runs in the same Windows environment as the installed browser, user profile, local ports, and credential tools. This avoids most confusion around browser-login handoff and local file paths.

CMD can usually run `npm install`, `npm run dev`, and `npm run build`, but PowerShell examples are preferred because Python venv activation, diagnostics, and future launcher scripts are clearer there.

WSL should not be the default way to run FinanceAgentGUI on Windows. It can be useful for code editing or agent repair, but it introduces a boundary between Linux paths and Windows browsers. Browser-login handoff may fail or become confusing unless the user intentionally runs a Linux Chromium browser inside WSL or the code has been patched for a specific Windows-browser-from-WSL setup.

Do not mix environments during setup. If the user installs Node packages in WSL, run the app in WSL. If the user runs the app in PowerShell, install packages in PowerShell.

## Frontend Install

From the `GuiBuild/web` directory:

```bash
npm install
```

Then run the development server:

```bash
npm run dev -- --host 127.0.0.1
```

For a production-style local build:

```bash
npm run build
npm run serve
```

The server binds to `127.0.0.1` by default. Use `FINANCE_AGENT_GUI_HOST` and `FINANCE_AGENT_GUI_PORT` only when a local setup requires a different binding.

## Python Helper Install

Python helpers are optional for screens that call finance scripts, world-memory checks, or portfolio backtests.

From `GuiBuild/`:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, which is the recommended Windows path:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Avoid using the WSL venv for a GUI server that is being run from native Windows PowerShell.

If Python features fail, report the Python executable path, version, failing command, and missing package as a diagnostic issue. Do not silently switch to system packages.

## World Memory Store

World Memory ships as scripts, docs, and schema, not as a prebuilt database.

Tracked design files:

- `docs/world-memory.md`
- `config/world-memory.schema.sql`
- `config/world-memory-collection.prompt.md`
- `scripts/world_memory_cli.py`
- `scripts/world_memory_harness.py`

Local runtime data:

- `data/world-memory/world_issue_log.sqlite3`
- `data/world-memory/collector-state.json`
- `logs/world-memory/*`

Initialize a local store from `GuiBuild/` only when one does not already exist:

```bash
python scripts/world_memory_cli.py init
```

Do not copy or commit an empty SQLite database as a seed file. It can overwrite,
shadow, or confuse a user's existing World Memory during installation or update.

## Required Frontend Dependency

`web/package.json` must include Apache ECharts:

```bash
cd web
npm ls echarts
```

ECharts is the default chart/graph engine for finance charts, job status visuals, verification visuals, and relationship/data visualizations. If it is missing, install it in `GuiBuild/web` and update both `package.json` and `package-lock.json`.

## Frontend Route Boundaries

`web/src/App.jsx` owns global shell state, sidebar/chat context, and shared route selection. Shell UI such as `web/src/shell/AppNavigation.jsx` and heavy workspace screens should live in feature folders and be composed or lazy-loaded from `App.jsx`.

Default route modules:

- `web/src/arca/StockChannelView.jsx`

Current lazy route modules:

- `web/src/settings/SettingsView.jsx`
- `web/src/news/NewsFeedView.jsx`
- `web/src/worldMemory/WorldMemoryView.jsx`
- `web/src/reports/ReportsView.jsx`
- `web/src/calendars/CalendarViews.jsx`
- `web/src/portfolio/PortfolioGuidePage.jsx`
- `web/src/portfolio/PortfolioWorkspace.jsx`

Shared UI/runtime helpers should stay outside `App.jsx` when multiple screens need them, such as `web/src/shell/AppNavigation.jsx`, `web/src/shell/screenSnapshot.js`, `web/src/agent/AgentSidebar.jsx`, `web/src/agent/AgentControls.jsx`, `web/src/agent/ChatMessages.jsx`, `web/src/agent/agentOptions.js`, `web/src/agent/attachments.js`, `web/src/agent/chatProtocol.js`, `web/src/arca/ArticleContextAttachment.jsx`, `web/src/arca/articleContext.js`, `web/src/calendars/earningPrompt.js`, `web/src/news/FeedSourceLabel.jsx`, `web/src/news/newsFeedStatus.js`, `web/src/utils/formatters.js`, `web/src/utils/MarkdownText.jsx`, `web/src/memory/sharedMemoryDefaults.js`, `web/src/worldMemory/actionCatalog.js`, `web/src/worldMemory/askRequest.js`, and `web/src/worldMemory/statusHelpers.js`.

## Local Configuration

Local user configuration should live under `GuiBuild/config` or `GuiBuild/data`, not in the repository root.

Common environment variables:

- `FINANCE_AGENT_GUI_HOST`: local bind host, default `127.0.0.1`
- `FINANCE_AGENT_GUI_PORT` or `PORT`: local server port
- `ARCA_BASE_URL`: default `https://arca.live`
- `ARCA_CHANNEL`: default `stock`
- `ARCA_LOGIN_URL`: override for the Arca.live login URL
- `ARCA_BROWSER_PATH`: explicit Chrome/Edge/Chromium/Brave executable path
- `ARCA_USER_AGENT`: optional Arca.live request user agent override

Keep user-specific config files and generated runtime data gitignored.

## Private Runtime Data

The following are local runtime data and should not be committed:

- `data/secrets/*`
- `data/arca-browser-profile/*`
- `data/shared-memory/*` except `.gitkeep`
- `data/world-memory/*` except `.gitkeep`
- `data/news-feed.json`
- `data/*-cache.json`
- `logs/*`

Never print raw cookies, tokens, API keys, or credentials when debugging.

## Quick Verification

Run from `GuiBuild/web`:

```bash
npm run build
```

Check server modules when editing local API code:

```bash
node --check server/server.mjs
node --check server/arcaAuthApi.mjs
node --check server/arcaApi.mjs
node --check server/worldMemoryApi.mjs
```

Start the app and probe a local endpoint:

```bash
npm run dev -- --host 127.0.0.1
curl -sS http://127.0.0.1:5173/api/arca/auth/status
```

If Vite chooses another port, use the printed local URL.

## Agent Repair Expectations

FinanceAgentGUI is meant to be repairable by a local coding agent after a user clones or downloads it from GitHub. When setup fails:

1. Inspect the exact OS, Node version, npm version, Python version, browser path, and failing endpoint.
2. Keep secrets redacted.
3. Prefer small patches inside `GuiBuild/`.
4. Re-run `npm run build` or the narrowest relevant verification.
5. Update `docs/compatibility.md` when the fix teaches a platform-specific lesson.

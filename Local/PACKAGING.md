# Local app packaging manifest

Operator rule (Mike, 2026-07-31): **everything the CLI path requires lives inside the
repo folder, and when Local is packaged for distribution (an exe), it ships with the
package — as separate files beside the exe where needed.** This file is the manifest a
packager follows; keep it current when runtime files change.

## Ships in the package (all inside this repo today)

| File / folder | Role |
|---|---|
| `index.html`, `app.bundle.js`, `styles.css` | The application |
| `scripts/dev-server.mjs`, `scripts/cli-bridge.mjs`, `scripts/cli-status.mjs` | Local server + CLI bridge (become the exe's embedded server, or ship beside it) |
| `models.json` | CLI model registry (this app's own — no external registry) |
| `schemas/briefing.schema.json` | Output contract handed to the Codex CLI per run |
| `AIMarketAggregator_start.bat`, `restart_ai_market.ps1` | Launcher / port-cleanup (exe replaces the .bat; keep the logic) |
| `.env` (optional, user-created) | Command overrides: `AMA_CODEX_CMD`, `AMA_CLAUDE_CMD` (legacy `DAI_*` names still honored) |
| `.local/cli-config.json` (created at runtime) | Saved executable-path overrides from the Connections screen |
| `../Backtesting/` (results + engine configs) | Only if the package should include the Backtest tab's data; the tab degrades gracefully without it |

## Required on the machine, cannot be bundled

These are licensed/authenticated per user and must be installed separately — the
package documents and detects them (same detection order the app uses: saved override →
`.env` override → PATH):

- **Node.js** — unless the exe embeds its own runtime
- **Codex CLI** (`codex`) — logged in with the user's ChatGPT subscription
- **Claude CLI** (`claude`) — logged in with the user's Claude subscription

## Runtime behavior worth knowing

- Every CLI generation runs in a throwaway temp workspace (OS temp, deleted after the
  run) — the app does not depend on Claude Code "workspace trust" for the repo folder,
  and no run reads or writes repo files.
- All persistent app state (profiles, history, settings) is browser localStorage —
  nothing outside the repo folder except the browser profile itself.

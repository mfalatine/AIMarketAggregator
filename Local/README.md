# AI Market Aggregator — Local

This application is exclusively for authenticated Codex and Claude
subscription CLIs. It contains no Cloud API execution choice and does not show
API credentials, API models, or API administration.

Double-click `AIMarketAggregator_start.bat`. The launcher finds Node.js without
requiring pnpm on Explorer's PATH, replaces an old port-4173 server, starts the
local CLI bridge, and opens the application.

Configure Codex or Claude under **Settings → Connections**, choose the
subscription model under **Settings → Briefing profiles**, and generate from
the Dashboard.

Development verification:

```powershell
pnpm install
pnpm check
```

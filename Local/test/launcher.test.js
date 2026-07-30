import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('double-click launcher does not depend on pnpm or a developer PATH', async () => {
  const launcher = await readFile(new URL('../AIMarketAggregator_start.bat', import.meta.url), 'utf8');
  const restartHelper = await readFile(new URL('../restart_ai_market.ps1', import.meta.url), 'utf8');
  assert.doesNotMatch(launcher, /where\s+pnpm|call\s+pnpm|pnpm\s+dev/i);
  assert.match(launcher, /%ProgramFiles%\\nodejs\\node\.exe/i);
  assert.match(launcher, /%SystemRoot%\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/i);
  assert.match(launcher, /"%NODE_EXE%"\s+scripts\\dev-server\.mjs/i);
  assert.match(launcher, /taskkill\s+\/F\s+\/T\s+\/FI\s+"WINDOWTITLE eq AI Market Aggregator Server\*"/i);
  assert.match(launcher, /-File\s+"%~dp0restart_ai_market\.ps1"/i);
  assert.match(restartHelper, /Get-NetTCPConnection\s+-LocalPort\s+4173/i);
  assert.match(restartHelper, /taskkill\.exe"\s+\/PID\s+\$listener\.OwningProcess\s+\/T\s+\/F/i);
  assert.match(restartHelper, /Start-Sleep\s+-Milliseconds\s+250/i);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:4173\/#briefing/i);
  assert.doesNotMatch(launcher, /APP_MODE|mode=api/i);
});

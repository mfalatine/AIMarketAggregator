import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliBridgeError, createCliService } from './cli-bridge.mjs';

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.env.PORT || 4173);
const allowedRootFiles = new Set(['index.html', 'app.js', 'app.bundle.js', 'styles.css']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
// Read-only window into the repo's Backtesting arena results for the Backtest tab.
const backtestResultsRoot = normalize(join(root, '..', 'Backtesting', 'results'));
const backtestEngineRoot = normalize(join(root, '..', 'Backtesting', 'engine'));
const newsAccessPath = normalize(join(root, '..', 'Backtesting', 'data', 'news', 'access.json'));
const newsAccessExamplePath = normalize(join(root, '..', 'Backtesting', 'data', 'news', 'access.example.json'));
const cliService = createCliService();

async function loadEnv() {
  try {
    const text = await readFile(join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || match[2].startsWith('#') || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; if (body.length > 200_000) reject(new Error('Request too large.')); });
    request.on('end', () => resolve(body)); request.on('error', reject);
  });
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Cache-Control': 'no-store', ...headers }); response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });
}

function trustedLocalOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname) && parsed.host === request.headers.host;
  } catch { return false; }
}

await loadEnv();
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/local/cli/status') {
      if (request.method !== 'GET') { sendJson(response, 405, { error: { message: 'Method not allowed.' } }); return; }
      sendJson(response, 200, await cliService.getStatus({ refresh: url.searchParams.get('refresh') === '1' })); return;
    }
    if (url.pathname === '/local/cli/config') {
      if (request.method === 'GET') { sendJson(response, 200, await cliService.getConfig()); return; }
      if (request.method !== 'POST') { sendJson(response, 405, { error: { message: 'Method not allowed.' } }); return; }
      if (!trustedLocalOrigin(request)) { sendJson(response, 403, { error: { message: 'Local CLI configuration must come from this local application.' } }); return; }
      if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { sendJson(response, 415, { error: { message: 'Content-Type must be application/json.' } }); return; }
      let payload;
      try { payload = JSON.parse(await collectBody(request)); }
      catch { sendJson(response, 400, { error: { message: 'Request body must be valid JSON.' } }); return; }
      sendJson(response, 200, { ok: true, config: await cliService.setConfig(payload), status: await cliService.getStatus({ refresh: true }) }); return;
    }
    if (url.pathname === '/local/cli/generate') {
      if (request.method !== 'POST') { sendJson(response, 405, { error: { message: 'Method not allowed.' } }); return; }
      if (!trustedLocalOrigin(request)) { sendJson(response, 403, { error: { message: 'Local CLI requests must come from this local application.' } }); return; }
      if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { sendJson(response, 415, { error: { message: 'Content-Type must be application/json.' } }); return; }
      const controller = new AbortController();
      request.once('aborted', () => controller.abort());
      response.once('close', () => { if (!response.writableEnded) controller.abort(); });
      let payload;
      try { payload = JSON.parse(await collectBody(request)); }
      catch { sendJson(response, 400, { error: { message: 'Request body must be valid JSON.' } }); return; }
      const result = await cliService.generate({ ...payload, signal: controller.signal });
      sendJson(response, 200, result); return;
    }
    if (url.pathname === '/backtesting/config') {
      const configPath = join(backtestEngineRoot, 'detection_config.json');
      if (request.method === 'GET') {
        const detection = JSON.parse(await readFile(configPath, 'utf8'));
        let access = null;
        try { access = JSON.parse(await readFile(newsAccessPath, 'utf8')); }
        catch { access = JSON.parse(await readFile(newsAccessExamplePath, 'utf8')); }
        // Only the enabled flags cross to the page — never keys or endpoints.
        const sources = Object.fromEntries(Object.entries(access).filter(([key]) => key !== '_doc')
          .map(([name, value]) => [name, Boolean(value.enabled)]));
        sendJson(response, 200, { detection, sources }); return;
      }
      if (request.method !== 'POST') { sendJson(response, 405, { error: { message: 'Method not allowed.' } }); return; }
      if (!trustedLocalOrigin(request)) { sendJson(response, 403, { error: { message: 'Arena settings must come from this local application.' } }); return; }
      let payload;
      try { payload = JSON.parse(await collectBody(request)); }
      catch { sendJson(response, 400, { error: { message: 'Request body must be valid JSON.' } }); return; }
      if (payload.detection) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(configPath, JSON.stringify(payload.detection, null, 2) + '\n', 'utf8');
      }
      if (payload.sources) {
        const { writeFile } = await import('node:fs/promises');
        let access;
        try { access = JSON.parse(await readFile(newsAccessPath, 'utf8')); }
        catch { access = JSON.parse(await readFile(newsAccessExamplePath, 'utf8')); }
        for (const [name, enabled] of Object.entries(payload.sources)) {
          if (access[name] && typeof access[name] === 'object') access[name].enabled = Boolean(enabled);
        }
        await writeFile(newsAccessPath, JSON.stringify(access, null, 2) + '\n', 'utf8');
      }
      sendJson(response, 200, { ok: true }); return;
    }
    if (url.pathname === '/backtesting/run') {
      if (request.method !== 'POST') { sendJson(response, 405, { error: { message: 'Method not allowed.' } }); return; }
      if (!trustedLocalOrigin(request)) { sendJson(response, 403, { error: { message: 'Arena runs must come from this local application.' } }); return; }
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const run = promisify(execFile);
      const steps = ['detect_moves.py', 'enrich_events.py', 'identify_events.py', 'build_pattern_book.py', 'make_summary.py'];
      const log = [];
      try {
        for (const step of steps) {
          const result = await run('python', [step], { cwd: backtestEngineRoot, timeout: 600_000 });
          log.push(`${step}: ${result.stdout.trim().split(/\r?\n/).pop()}`);
        }
        sendJson(response, 200, { ok: true, log }); return;
      } catch (error) {
        sendJson(response, 500, { error: { message: `Pipeline failed: ${String(error.message).slice(0, 300)}` }, log }); return;
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { send(response, 405, 'Method not allowed'); return; }
    if (url.pathname.startsWith('/backtesting/')) {
      const relativeResult = decodeURIComponent(url.pathname.slice('/backtesting/'.length));
      const target = normalize(join(backtestResultsRoot, relativeResult));
      const resultExt = extname(target);
      if (relativeResult.includes('..') || target.slice(0, backtestResultsRoot.length) !== backtestResultsRoot || !['.json', '.md'].includes(resultExt)) { send(response, 404, 'Not found'); return; }
      const content = await readFile(target);
      send(response, 200, request.method === 'HEAD' ? '' : content, { 'Content-Type': mime[resultExt] }); return;
    }
    const relative = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const allowed = allowedRootFiles.has(relative) || relative.startsWith('js/');
    if (!allowed || relative.includes('..') || normalize(join(root, relative)).slice(0, root.length) !== root) { send(response, 404, 'Not found'); return; }
    const content = await readFile(join(root, relative));
    send(response, 200, request.method === 'HEAD' ? '' : content, { 'Content-Type': mime[extname(relative)] || 'application/octet-stream' });
  } catch (error) {
    if (error instanceof CliBridgeError) { sendJson(response, error.statusCode || 500, { error: { code: error.code, message: error.message } }); return; }
    send(response, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`AI Market Aggregator is available at http://127.0.0.1:${port}`);
  console.log('Local CLI bridge enabled. Codex and Claude login status is available in Connections.');
});

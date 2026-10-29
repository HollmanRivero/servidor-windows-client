/**
 * Servidor UI – klient mot Ubuntu-serveren.
 * Alle data, prosjekter, filer og kommandoer ligger på serveren.
 */

const TOKEN_KEY = 'servidor.token';
const THEME_KEY = 'servidor.theme';
const SERVER_KEY = 'servidor.serverUrl';
// Do not ship a user's private Tailscale address in the public client.
const DEFAULT_SERVER = '';
let cachedWorkspace = '';
const memoryStore = new Map();

function storeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  }
}

function storeSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    memoryStore.set(key, String(value));
  }
}

function storeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class AuthError extends ApiError {
  constructor(message, status = 401, data = null) {
    super(message, status, data);
    this.name = 'AuthError';
  }
}

export function getToken() {
  return storeGet(TOKEN_KEY) || '';
}

export function setToken(value) {
  storeSet(TOKEN_KEY, String(value || '').trim());
}

export function clearToken() {
  storeRemove(TOKEN_KEY);
}

export function getTheme() {
  return storeGet(THEME_KEY) || 'system';
}

export function setTheme(value) {
  storeSet(THEME_KEY, value);
}

export function getServerUrl() {
  const value = (storeGet(SERVER_KEY) || DEFAULT_SERVER).trim();
  return value.replace(/\/+$/, '');
}

export function setServerUrl(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '');
  if (clean) storeSet(SERVER_KEY, clean);
  else storeRemove(SERVER_KEY);
}

export function serverOrigin() {
  return getServerUrl();
}

function baseHeaders() {
  const token = getToken();
  return token ? { 'X-API-Token': token } : {};
}

function endpoint(path) {
  return getServerUrl() + (String(path).startsWith('/') ? path : `/${path}`);
}

async function raw(path, { method = 'GET', body, timeout = 0 } = {}) {
  const headers = baseHeaders();
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = timeout ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

  let response;
  try {
    response = await fetch(endpoint(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new ApiError('Serveren brukte for lang tid.', 504);
    }
    throw new ApiError(
      'Får ikke kontakt med Ubuntu-serveren. Sjekk Tailscale og at tjenesten kjører.',
      0
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (response.status === 401) {
    throw new AuthError(
      (data && (data.detail || data.error)) || 'Ugyldig eller manglende API-token.',
      401,
      data
    );
  }
  if (!response.ok) {
    const message =
      (data && (data.detail || data.error)) || `Serveren svarte HTTP ${response.status}`;
    throw new ApiError(message, response.status, data);
  }
  return data;
}

/* ---------- Hjelpere ---------- */

function extOf(path) {
  const base = String(path || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function baseName(path) {
  return String(path || '').split('/').pop() || String(path || '');
}

function parentOf(path) {
  const parts = String(path || '').split('/');
  parts.pop();
  return parts.join('/');
}

function languageOf(path) {
  const names = {
    js: 'JavaScript', mjs: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
    jsx: 'JavaScript', json: 'JSON', css: 'CSS', scss: 'SCSS', html: 'HTML',
    htm: 'HTML', md: 'Markdown', py: 'Python', sh: 'Shell', bash: 'Shell',
    yml: 'YAML', yaml: 'YAML', toml: 'TOML', xml: 'XML', svg: 'SVG',
    sql: 'SQL', txt: 'Tekst', php: 'PHP', rb: 'Ruby', go: 'Go', rs: 'Rust',
    java: 'Java', kt: 'Kotlin', c: 'C', h: 'C', cpp: 'C++',
  };
  return names[extOf(path)] || (extOf(path) ? extOf(path).toUpperCase() : 'Tekst');
}

function parseProviders(data) {
  return (data.providers || []).map((provider) => ({
    key: provider.key,
    label: provider.label,
    configured: Boolean(provider.configured),
    model: '',
  }));
}

function pickDefault(providers) {
  const order = ['deepseek', 'gemini', 'techai'];
  for (const key of order) {
    const found = providers.find((provider) => provider.key === key && provider.configured);
    if (found) return key;
  }
  return 'deepseek';
}

async function readProviders() {
  const data = await raw('/chat/providers');
  return parseProviders(data);
}

function workspaceFromHealth(health) {
  const projectsDir = String(health.projects_dir || '').trim();
  if (projectsDir && health.projects_dir_exists !== false) return projectsDir;

  // A missing projects directory must not make every terminal command fail
  // with `cd: ... No such file or directory`.
  return String(health.repo_root || projectsDir || '/').trim();
}

async function buildStatus() {
  const health = await raw('/health');
  cachedWorkspace = workspaceFromHealth(health) || cachedWorkspace;
  const providers = await readProviders();
  return {
    app: {
      name: 'Servidor',
      version: health.version || '2.0',
      mode: 'remote',
      platform: 'linux',
      hostname: (() => {
        try {
          return new URL(getServerUrl()).hostname;
        } catch {
          return 'ubuntu';
        }
      })(),
      user: '',
      node: 'Python',
      pid: 0,
      startedAt: 0,
    },
    workspace: workspaceFromHealth(health),
    configFile: '',
    theme: getTheme(),
    shell: { enabled: Boolean(health.agent_shell_enabled), timeout: 120 },
    ai: { default: pickDefault(providers), providers },
    remote: {
      enabled: true,
      online: health.status === 'ok',
      version: health.version,
      os: health.os,
      providers: health.ai_providers || [],
      shell: Boolean(health.agent_shell_enabled),
    },
  };
}

function mapProjects(data) {
  const workspace = data.workspace || '';
  const projects = (data.items || [])
    .filter((item) => item && item.is_dir && item.name !== 'servidor')
    .map((item) => ({
      name: item.name,
      path: item.path || item.name,
      fileCount: 0,
      size: 0,
      modified: 0,
      git: false,
      description: '',
      remote: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  return { workspace, projects };
}

function mapTree(data, requestedPath) {
  const rel = requestedPath || '';
  const entries = (data.items || [])
    .map((item) => {
      const path = item.path || (rel ? `${rel}/${item.name}` : item.name);
      return {
        name: item.name,
        path,
        type: item.is_dir ? 'dir' : 'file',
        size: 0,
        mtime: 0,
        ext: item.is_dir ? '' : extOf(item.name),
        image: false,
      };
    })
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name, 'nb') : a.type === 'dir' ? -1 : 1
    );
  return {
    path: rel,
    name: rel ? baseName(rel) : 'Arbeidsområdet',
    parent: rel ? parentOf(rel) : null,
    entries,
    mtime: 0,
  };
}

function mapRelatedStatus(status) {
  return {
    ...status,
    ai: status.ai,
    remote: status.remote,
  };
}

function mapRecent(data) {
  const recent = (data.recent || []).map((file) => {
    const path = file.path || '';
    return {
      path,
      project: path.split('/')[0] || '',
      name: baseName(path),
      mtime: Number(file.mtime || 0) * 1000,
      size: Number(file.size || 0),
      ext: extOf(path),
    };
  });
  return { recent };
}

function mapShell(data, fallbackCwd) {
  return {
    stdout: data.stdout || '',
    stderr: data.stderr || '',
    code: typeof data.exit_code === 'number' ? data.exit_code : 0,
    cwd: data.cwd || fallbackCwd || '',
    duration: Number(data.duration_ms || 0),
    timedOut: Boolean(data.timed_out),
    truncated: false,
    remote: true,
  };
}

function transcript(messages) {
  return (messages || [])
    .filter((message) => message && message.content)
    .map((message) => `${message.role === 'assistant' ? 'Assistent' : 'Bruker'}: ${message.content}`)
    .join('\n\n');
}

function cleanRel(value) {
  const clean = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!clean || clean.split('/').includes('..')) {
    throw new ApiError('Ugyldig sti', 400);
  }
  return clean;
}

function shQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

async function shellCommand(command, timeout = 60) {
  const data = await raw('/shell', {
    method: 'POST',
    body: { command, cwd: '', timeout },
    timeout: (timeout + 30) * 1000,
  });
  if (data.exit_code !== 0) {
    throw new ApiError(String(data.stderr || data.stdout || 'Kommandoen feilet'), 400, data);
  }
  return data;
}

function templateFiles(name, template) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  if (template === 'node') {
    return {
      'package.json': JSON.stringify(
        { name: slug, version: '1.0.0', private: true, type: 'module', scripts: { start: 'node index.js' } },
        null,
        2
      ) + '\n',
      'index.js': `console.log('Hei fra ${name}!');\n`,
      '.gitignore': 'node_modules/\n',
      'README.md': `# ${name}\n\nNode-prosjekt laget med Servidor.\n\n\`\`\`bash\nnpm start\n\`\`\`\n`,
    };
  }
  if (template === 'web') {
    return {
      'index.html': `<!doctype html>\n<html lang="nb">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <h1>${name}</h1>\n    <p>Laget med Servidor.</p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
      'style.css': `body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #f3f3f3;\n  font-family: "Segoe UI", system-ui, sans-serif;\n}\n\nmain {\n  padding: 48px;\n  border-radius: 12px;\n  background: #fff;\n  box-shadow: 0 8px 32px rgb(0 0 0 / 8%);\n}\n`,
      'script.js': `console.log('Hei fra ${name}!');\n`,
      'README.md': `# ${name}\n\nNettside laget med Servidor.\n`,
    };
  }
  if (template === 'python') {
    return {
      'main.py': `def main():\n    print("Hei fra ${name}!")\n\n\nif __name__ == "__main__":\n    main()\n`,
      'requirements.txt': '',
      'README.md': `# ${name}\n\nPython-prosjekt laget med Servidor.\n`,
    };
  }
  return {};
}

async function applyTemplate(name, template) {
  const files = templateFiles(name, template);
  for (const [file, content] of Object.entries(files)) {
    await raw('/file?path=' + encodeURIComponent(`${name}/${file}`), {
      method: 'POST',
      body: { content },
    });
  }
}

function mapAgent(data, provider) {
  const steps = (data.steps || []).map((step) => ({
    name: step.action || 'steg',
    args: {
      path: step.target || '',
      command: step.command || '',
    },
    result: {
      ok: step.ok !== false,
      stdout: step.stdout || step.result || '',
      stderr: step.stderr || '',
      error: step.ok === false ? step.result || 'Steget feilet' : null,
    },
    ok: step.ok !== false,
    thought: step.thought || '',
  }));
  let reply = data.summary || data.answer || 'Agenten fullførte.';
  if (data.awaiting_input) {
    reply += `\n\n❓ ${data.question || 'Hvilken vei vil du gå?'}`;
    if (Array.isArray(data.options) && data.options.length) {
      reply += '\n\n' + data.options.map((option) => `- ${option}`).join('\n');
    }
  }
  return {
    reply,
    steps,
    model: data.model || provider,
    done: Boolean(data.done),
    project: data.project || '',
    awaiting: Boolean(data.awaiting_input),
    options: data.options || [],
  };
}

async function settingsResponse() {
  const status = await buildStatus();
  return {
    settings: {
      theme: getTheme(),
      workspace: status.workspace,
      ai: {
        defaultProvider: status.ai.default,
        providers: status.ai.providers,
      },
      remote: {
        enabled: true,
        baseUrl: getServerUrl(),
        token: getToken() ? '••••••••' : '',
      },
      shell: status.shell,
    },
    status,
  };
}

/* ---------- Ruting ---------- */

async function request(path, { method = 'GET', body, timeout = 0 } = {}) {
  const url = new URL(path, getServerUrl());
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const params = url.searchParams;

  if (pathname === '/api/settings') {
    if (method === 'PUT') {
      if (body && body.theme) setTheme(body.theme);
      if (body && body.remote && typeof body.remote.token === 'string' && body.remote.token && body.remote.token !== '••••••••') {
        setToken(body.remote.token);
      }
    }
    return settingsResponse();
  }

  if (pathname === '/api/status') {
    return mapRelatedStatus(await buildStatus());
  }

  if (pathname === '/api/stats') {
    const data = await raw('/stats');
    const totalMb = Number(data.ram_total_mb) || 0;
    const usedMb = Number(data.ram_used_mb) || 0;
    return {
      cpu: {
        percent: Math.round(Number(data.cpu_percent) || 0),
        cores: 0,
        model: 'Ubuntu-server',
        speedMhz: 0,
      },
      memory: {
        total: totalMb * 1024 * 1024,
        used: usedMb * 1024 * 1024,
        free: Math.max(0, totalMb - usedMb) * 1024 * 1024,
        percent: Math.round(Number(data.ram_percent) || 0),
      },
      disks: [],
      disk: {
        mount: '/',
        name: 'Server',
        total: Number(data.disk_total_gb || 0) * 1024 ** 3,
        used: Number(data.disk_used_gb || 0) * 1024 ** 3,
        free: Math.max(0, (Number(data.disk_total_gb) || 0) - (Number(data.disk_used_gb) || 0)) * 1024 ** 3,
        percent: Math.round(Number(data.disk_percent) || 0),
      },
      uptime: { system: 0, process: 0 },
      host: { hostname: (() => { try { return new URL(getServerUrl()).hostname; } catch { return 'ubuntu'; } })(), platform: 'linux', release: '', arch: '', user: '' },
      node: 'Python',
      temp_c: data.temp_c === null || data.temp_c === undefined || data.temp_c === ''
        ? null
        : Number.isFinite(Number(data.temp_c)) ? Number(data.temp_c) : null,
      remote: true,
      now: Date.now(),
    };
  }

  if (pathname === '/api/projects') {
    if (method === 'POST') {
      const created = await raw('/projects/create', {
        method: 'POST',
        body: {
          name: (body && body.name) || '',
          git: !body || body.git !== false,
          readme: !body || body.readme !== false,
        },
      });
      if (body && body.template) {
        await applyTemplate(created.name || body.name, body.template);
      }
      return created;
    }
    return mapProjects(await raw('/projects'));
  }

  if (pathname.startsWith('/api/projects/')) {
    const name = decodeURIComponent(pathname.slice('/api/projects/'.length));
    const data = await raw('/projects?path=' + encodeURIComponent(name));
    const items = data.items || [];
    return {
      name,
      fileCount: items.length,
      size: 0,
      modified: 0,
      git: false,
      description: '',
      remote: true,
    };
  }

  if (pathname === '/api/tree') {
    const rel = params.get('path') || '';
    const data = await raw('/projects?path=' + encodeURIComponent(rel));
    return mapTree(data, rel);
  }

  if (pathname === '/api/file') {
    const rel = params.get('path') || '';
    if (method === 'PUT') {
      await raw('/file?path=' + encodeURIComponent(rel), {
        method: 'POST',
        body: { content: (body && body.content) || '' },
      });
      return {
        path: rel,
        size: String((body && body.content) || '').length,
        mtime: Date.now(),
        language: languageOf(rel),
      };
    }
    const data = await raw('/file?path=' + encodeURIComponent(rel));
    const content = String(data.content || '');
    return {
      path: rel,
      name: baseName(rel),
      content,
      language: languageOf(rel),
      size: content.length,
      mtime: Date.now(),
      binary: false,
      image: false,
    };
  }

  if (pathname === '/api/entry') {
    if (method === 'POST') {
      const rel = cleanRel((body && body.path) || '');
      const type = (body && body.type) || 'file';
      if (type === 'dir') {
        await shellCommand(`mkdir -p -- ${shQuote(rel)}`, 30);
      } else {
        await raw('/file?path=' + encodeURIComponent(rel), {
          method: 'POST',
          body: { content: '' },
        });
      }
      return { path: rel, type };
    }
    if (method === 'DELETE') {
      const rel = cleanRel(params.get('path') || '');
      await shellCommand(`rm -rf -- ${shQuote(rel)}`, 120);
      return { path: rel };
    }
  }

  if (pathname === '/api/rename') {
    const from = cleanRel((body && body.from) || '');
    const to = cleanRel((body && body.to) || '');
    await shellCommand(`mv -- ${shQuote(from)} ${shQuote(to)}`, 60);
    return { from, to };
  }

  if (pathname === '/api/recent') {
    return mapRecent(await raw('/recent_changes'));
  }

  if (pathname === '/api/shell') {
    const command = String((body && body.command) || '').trim();
    if (!cachedWorkspace) {
      try {
        const health = await raw('/health');
        cachedWorkspace = workspaceFromHealth(health);
      } catch {
        cachedWorkspace = '';
      }
    }
    const start = (body && body.cwd) || cachedWorkspace || '';
    const cdMatch = command.match(/^cd\s+(.+)$/i);
    if (cdMatch && !/[;&|]/.test(cdMatch[1])) {
      const target = cdMatch[1].trim().replace(/^['"]|['"]$/g, '');
      const targetExpr = target.startsWith('~') ? target : shQuote(target);
      const prefix = start ? `cd -- ${shQuote(start)} && ` : '';
      const result = await raw('/shell', {
        method: 'POST',
        body: { command: `${prefix}cd -- ${targetExpr} && pwd`, cwd: '', timeout: 15 },
      });
      const lines = String(result.stdout || '').trim().split('\n').filter(Boolean);
      const newCwd = lines.length ? lines[lines.length - 1] : start;
      if (result.exit_code === 0) {
        return { stdout: '', stderr: '', code: 0, cwd: newCwd, duration: 0, cd: true, remote: true };
      }
      return mapShell(result, start);
    }
    const prefix = start ? `cd -- ${shQuote(start)} && ` : '';
    const data = await raw('/shell', {
      method: 'POST',
      body: {
        command: `${prefix}${command}`,
        cwd: '',
        timeout: Math.min(Number((body && body.timeout) || 120), 600),
      },
      timeout: 600000,
    });
    return mapShell(data, start);
  }

  if (pathname === '/api/shell/cancel') {
    return { cancelled: false };
  }

  if (pathname === '/api/chat') {
    const provider = (body && body.provider) || 'deepseek';
    const path =
      ['gemini', 'deepseek', 'techai'].includes(provider)
        ? `/chat/${provider}`
        : `/chat/provider/${encodeURIComponent(provider)}`;
    const data = await raw(path, {
      method: 'POST',
      body: { message: transcript((body && body.messages) || []) },
      timeout: 180000,
    });
    return {
      reply: data.reply || '(Tomt svar)',
      model: data.model || provider,
      provider,
      remote: true,
    };
  }

  if (pathname === '/api/agent') {
    const provider = (body && body.provider) || 'deepseek';
    const project = (body && body.project) || '';
    const data = await raw('/chat/agent', {
      method: 'POST',
      body: {
        goal: (body && body.goal) || '',
        project,
        primary: provider,
        review_with_other: false,
        max_steps: Math.min(Number((body && body.maxSteps) || 20), 40),
      },
      timeout: 900000,
    });
    return mapAgent(data, provider);
  }

  if (pathname === '/api/ai/status') {
    const providers = await readProviders();
    return { default: pickDefault(providers), providers };
  }

  if (pathname === '/api/ai/test') {
    const provider = (body && body.provider) || 'deepseek';
    const started = Date.now();
    const path =
      ['gemini', 'deepseek', 'techai'].includes(provider)
        ? `/chat/${provider}`
        : `/chat/provider/${encodeURIComponent(provider)}`;
    const data = await raw(path, {
      method: 'POST',
      body: { message: 'Svar kun med ordet OK' },
      timeout: 60000,
    });
    return {
      ok: true,
      reply: String(data.reply || '').slice(0, 120),
      model: data.model || provider,
      ms: Date.now() - started,
    };
  }

  if (pathname === '/api/open' || pathname === '/api/open-config') {
    throw new ApiError('Åpne i Utforsker støttes ikke mot en ekstern server.', 400);
  }

  if (pathname === '/api/raw') {
    throw new ApiError('Bildevisning er ikke støttet mot serveren ennå.', 400);
  }

  return raw(path, { method, body, timeout });
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  image: () => '',
  getToken,
  setToken,
  clearToken,
  getTheme,
  setTheme,
  getServerUrl,
  setServerUrl,
  origin: serverOrigin,
};

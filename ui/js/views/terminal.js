import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, fmtDuration, toast } from '../ui.js';

const HISTORY_KEY = 'servidor.terminal.history.v1';
const QUICK = [
  { label: 'ls -la', command: 'ls -la' },
  { label: 'git status', command: 'git status' },
  { label: 'python3 --version', command: 'python3 --version' },
  { label: 'node --version', command: 'node --version' },
  { label: 'df -h', command: 'df -h' },
];

export async function mount(root, ctx) {
  const { state } = ctx;
  const status = state.status || {};
  const app = status.app || {};
  const isRemote = app.mode === 'remote';
  const project = ctx.query.get('project') || '';
  const dir = ctx.query.get('dir') || '';

  let cwd = status.workspace || '/';
  if (ctx.query.get('cwd')) cwd = ctx.query.get('cwd');
  else if (project) {
    cwd = [status.workspace || '/', project, dir]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');
  }

  const promptLabel = (path) => `${path || '/'} $`;

  root.innerHTML = `
    <div class="page terminal-page">
      <div class="terminal-head">
        <div class="terminal-title">${icon('terminal', 17)}<span>Terminal</span></div>
        <span class="terminal-cwd" id="termCwd" title="${esc(cwd)}">${esc(cwd)}</span>
        <span class="badge" id="shellBadge">${isRemote ? 'Ubuntu' : 'PowerShell'}</span>
        <div class="actions">
          <button class="btn small ghost hidden" id="termCancel" type="button">${icon('stop', 13)}<span>Avbryt</span></button>
          <button class="btn small ghost" id="termClear" type="button">${icon('eraser', 14)}<span>Tøm</span></button>
        </div>
      </div>

      <div class="terminal-wrap">
        <div class="terminal">
          <div class="term-output" id="termOutput" tabindex="0"></div>
          <div class="term-input-row">
            <span class="term-input-prompt" id="termPrompt">${esc(promptLabel(cwd))}</span>
            <input class="term-input" id="termInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Skriv en kommando …" />
          </div>
        </div>
        <div class="term-quick" id="termQuick">
          ${QUICK.map((item) => `<button type="button" data-command="${esc(item.command)}">${esc(item.label)}</button>`).join('')}
        </div>
      </div>
    </div>`;

  const output = root.querySelector('#termOutput');
  const input = root.querySelector('#termInput');
  const cwdLabel = root.querySelector('#termCwd');
  const promptNode = root.querySelector('#termPrompt');
  const cancelBtn = root.querySelector('#termCancel');
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    history = [];
  }
  let historyIndex = history.length;
  let runningId = null;
  let runningLine = null;
  let disposed = false;

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function appendLine(text, type = 'stdout') {
    const node = document.createElement('div');
    node.className = `term-line ${type}`;
    node.textContent = text;
    output.appendChild(node);
    while (output.children.length > 900) output.removeChild(output.firstChild);
    scrollToBottom();
    return node;
  }

  function appendCommand(command) {
    const node = document.createElement('div');
    node.className = 'term-line command';
    node.innerHTML = `<span class="term-prompt">${esc(promptLabel(cwd))}</span> `;
    const span = document.createElement('span');
    span.textContent = command;
    node.appendChild(span);
    output.appendChild(node);
    scrollToBottom();
  }

  function updatePrompt() {
    cwdLabel.textContent = cwd;
    cwdLabel.title = cwd;
    promptNode.textContent = promptLabel(cwd);
  }

  function clearOutput() {
    output.innerHTML = '';
    welcome();
  }

  function welcome() {
    const node = document.createElement('div');
    node.className = 'term-welcome';
    node.innerHTML =
      `<strong>Servidor Terminal</strong> · Ubuntu-serveren<br>` +
      `${esc(cwd)}<br>` +
      `<span style="opacity:.8">Kommandoene kjører på serveren. «cd» bytter mappe, «clear» tømmer, ↑/↓ henter historikk.</span><br><br>`;
    output.appendChild(node);
  }

  async function runCommand(raw) {
    const command = String(raw || '').trim();
    if (!command || runningId) return;
    const lower = command.toLowerCase();
    if (lower === 'cls' || lower === 'clear' || lower === 'clear-host') {
      clearOutput();
      input.value = '';
      return;
    }
    if (lower === 'exit') {
      appendLine('Terminalen er en del av Servidor – lukk fanen for å gå ut.', 'meta');
      input.value = '';
      return;
    }

    appendCommand(command);
    input.value = '';
    history.push(command);
    if (history.length > 120) history.shift();
    historyIndex = history.length;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-120)));
    } catch {
      /* ignorert */
    }

    runningId = `term-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    cancelBtn.classList.remove('hidden');
    runningLine = appendLine('Kjører …', 'meta');

    try {
      const result = await api.post('/api/shell', {
        command,
        cwd,
        timeout: 300,
        id: runningId,
      });
      if (disposed || !root.isConnected) return;
      runningLine.remove();
      runningLine = null;
      if (result.cd) {
        cwd = result.cwd;
        updatePrompt();
        appendLine(`→ ${cwd}`, 'meta');
      } else {
        if (result.cwd && result.cwd !== cwd) {
          cwd = result.cwd;
          updatePrompt();
        }
        if (result.stdout) appendLine(result.stdout.replace(/\n+$/, ''), 'stdout');
        if (result.stderr) appendLine(result.stderr.replace(/\n+$/, ''), 'stderr');
        if (result.code !== 0 || result.timedOut) {
          const badge = document.createElement('div');
          badge.className = 'term-line meta';
          badge.innerHTML = `<span class="term-exit">${result.timedOut ? 'tidsavbrudd' : `avsluttet med kode ${result.code}`} · ${fmtDuration(result.duration)}</span>`;
          output.appendChild(badge);
        } else if (result.stdout || result.stderr) {
          appendLine(`↑ ${fmtDuration(result.duration)}`, 'meta');
        }
        if (result.truncated) appendLine('(utskriften ble avkortet)', 'meta');
        if (result.error && !result.stdout && !result.stderr) appendLine(result.error, 'error');
      }
    } catch (err) {
      if (!root.isConnected) return;
      if (runningLine) {
        runningLine.remove();
        runningLine = null;
      }
      appendLine(err.message || 'Kommandoen feilet', 'error');
    } finally {
      runningId = null;
      cancelBtn.classList.add('hidden');
      scrollToBottom();
      input.focus();
    }
  }

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await runCommand(input.value);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!history.length) return;
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || '';
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!history.length) return;
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    } else if (event.key === 'c' && event.ctrlKey) {
      event.preventDefault();
      if (runningId) {
        cancel();
      } else {
        appendLine('^C', 'meta');
        input.value = '';
      }
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      clearOutput();
    }
  });

  async function cancel() {
    if (!runningId) return;
    const id = runningId;
    try {
      await api.post('/api/shell/cancel', { id });
      if (runningLine) runningLine.textContent = 'Avbryter …';
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  root.querySelector('#termClear').addEventListener('click', clearOutput);
  cancelBtn.addEventListener('click', cancel);
  root.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', () => runCommand(button.dataset.command));
  });
  cwdLabel.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cwd);
      toast('Stien er kopiert', 'success', 1600);
    } catch {
      /* ignorert */
    }
  });
  output.addEventListener('click', () => input.focus());

  welcome();
  input.focus();

  return () => {
    disposed = true;
  };
}

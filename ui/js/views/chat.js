import { api } from '../api.js';
import { icon } from '../icons.js';
import {
  confirmDialog,
  esc,
  fmtDuration,
  markdown,
  openDialog,
  toast,
  wireCopyButtons,
} from '../ui.js';

const STORAGE_KEY = 'servidor.chats.v1';
const MAX_CHATS = 30;

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', short: 'G' },
  { key: 'deepseek', label: 'DeepSeek', short: 'D' },
  { key: 'techai', label: 'Tech-AI', short: 'T' },
  { key: 'custom', label: 'Egen', short: '+' },
];

const TOOL_LABELS = {
  list_files: 'Listet filer',
  read_file: 'Leste fil',
  write_file: 'Skrev fil',
  edit_file: 'Redigerte fil',
  append_file: 'La til i fil',
  mkdir: 'Opprettet mappe',
  delete_path: 'Slettet',
  move_path: 'Flyttet',
  copy_path: 'Kopierte',
  run_command: 'Kjørte kommando',
  ask_user: 'Spurte brukeren',
  finish: 'Fullførte',
};

function providerLabel(key) {
  const found = PROVIDERS.find((item) => item.key === key);
  return found ? found.label : key;
}

function providerShort(key) {
  const found = PROVIDERS.find((item) => item.key === key);
  return found ? found.short : '?';
}

function loadChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((chat) => chat && chat.id && Array.isArray(chat.messages));
  } catch {
    return [];
  }
}

function newChatObject(provider) {
  return {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Ny samtale',
    provider: provider || 'gemini',
    mode: 'chat',
    project: '',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function stepsHtml(steps) {
  if (!steps || !steps.length) return '';
  const rows = steps
    .map((step) => {
      const args = step.args || {};
      let summary = '';
      if (step.name === 'run_command') summary = `$ ${args.command || ''}`;
      else if (step.name === 'read_file' || step.name === 'write_file') summary = args.path || '';
      else if (step.name === 'list_files') summary = args.path || '.';
      let output = '';
      const result = step.result || {};
      if (result.error) output = result.error;
      else if (result.stdout) output = result.stdout;
      else if (result.stderr) output = result.stderr;
      else if (step.name === 'write_file') output = `Skrev ${result.bytes || 0} byte`;
      else if (step.name === 'read_file') output = `${String(result.content || '').slice(0, 400)}`;
      else if (result.entries) output = result.entries.map((entry) => `${entry.type === 'dir' ? '📁' : '📄'} ${entry.name}`).join('\n');
      const head = `${icon(step.ok ? 'check' : 'alert', 13, step.ok ? '' : 'fail')}<strong>${esc(TOOL_LABELS[step.name] || step.name)}</strong>`;
      return `<div class="agent-step">
        <div class="agent-step-head">${head}</div>
        ${summary ? `<div class="agent-step-code">${esc(summary)}</div>` : ''}
        ${output ? `<div class="agent-step-code" style="max-height:110px">${esc(String(output).slice(0, 1200))}</div>` : ''}
      </div>`;
    })
    .join('');
  return `<details class="agent-steps" open><summary>${icon('layers', 13)} Agenten brukte ${steps.length} steg</summary>${rows}</details>`;
}

export async function mount(root, ctx) {
  const { state, navigate } = ctx;
  const status = state.status || {};
  const isRemote = (status.app && status.app.mode) === 'remote';
  const remote = status.remote || {};

  const availability = {};
  if (isRemote) {
    availability.gemini = Boolean(remote.gemini);
    availability.deepseek = Boolean(remote.deepseek);
    availability.techai = Boolean(remote.techai);
    availability.custom = false;
  } else {
    for (const provider of (status.ai && status.ai.providers) || []) {
      availability[provider.key] = Boolean(provider.configured);
    }
  }

  const defaultProvider = () => {
    const preferred = (state.settings && state.settings.ai && state.settings.ai.defaultProvider) || 'gemini';
    if (availability[preferred]) return preferred;
    return Object.keys(availability).find((key) => availability[key]) || preferred;
  };

  let chats = loadChats();
  if (!chats.length) chats = [newChatObject(defaultProvider())];

  let wanted = null;
  try {
    wanted = ctx.query.get('new') === '1' ? null : localStorage.getItem('servidor.chat.active');
  } catch {
    wanted = null;
  }
  let activeId = chats.find((chat) => chat.id === wanted)?.id || chats[0].id;
  if (ctx.query.get('new') === '1') {
    const fresh = newChatObject(defaultProvider());
    chats.unshift(fresh);
    activeId = fresh.id;
  }

  let pending = null;
  let timer = null;
  let disposed = false;
  let controller = null;
  let stick = true;

  function activeChat() {
    return chats.find((chat) => chat.id === activeId) || chats[0];
  }

  function saveChats() {
    try {
      const clean = chats.slice(0, MAX_CHATS).map((chat) => ({
        ...chat,
        messages: chat.messages.slice(-200),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      localStorage.setItem('servidor.chat.active', activeId);
    } catch {
      /* full localStorage – ignoreres */
    }
  }

  root.innerHTML = `
    <div class="page chat-page">
      <div class="chat">
        <aside class="chat-side">
          <div class="chat-side-head">
            <button class="btn primary" id="chatNewSide" type="button">${icon('plus', 15)}<span>Ny samtale</span></button>
          </div>
          <div class="chat-list" id="chatList"></div>
        </aside>
        <section class="chat-main">
          <div class="chat-top" id="chatTop"></div>
          <div class="chat-scroll" id="chatScroll">
            <div class="chat-thread" id="chatThread"></div>
          </div>
          <div class="composer">
            <div class="composer-inner">
              <div id="chatBanner"></div>
              <div class="composer-box">
                <textarea id="chatInput" rows="1" placeholder="Skriv en melding …"></textarea>
                <button class="send-btn" id="chatSend" type="button" title="Send (Enter)" aria-label="Send">${icon('send', 16)}</button>
              </div>
              <div class="composer-hint">
                <span>Enter = send · Shift+Enter = ny linje</span>
                <span class="spacer"></span>
                <span id="chatContextHint">Chat-modus</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>`;

  const listEl = root.querySelector('#chatList');
  const topEl = root.querySelector('#chatTop');
  const threadEl = root.querySelector('#chatThread');
  const scrollEl = root.querySelector('#chatScroll');
  const input = root.querySelector('#chatInput');
  const sendBtn = root.querySelector('#chatSend');
  const bannerEl = root.querySelector('#chatBanner');
  const contextHint = root.querySelector('#chatContextHint');

  wireCopyButtons(threadEl);

  function renderList() {
    const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
    listEl.innerHTML = sorted
      .map((chat) => {
        const last = chat.messages[chat.messages.length - 1];
        const subtitle = chat.mode === 'agent' ? 'Agent' : 'Chat';
        return `<button class="chat-item ${chat.id === activeId ? 'active' : ''}" data-chat="${chat.id}" type="button">
          ${icon(chat.mode === 'agent' ? 'layers' : 'chat', 15)}
          <span class="chat-item-main">
            <span class="chat-item-title">${esc(chat.title || 'Ny samtale')}</span>
            <span class="chat-item-meta">${esc(subtitle)} · ${esc(providerLabel(chat.provider))} · ${chat.messages.length} meld.</span>
          </span>
          <span class="chat-item-del" data-del="${chat.id}" role="button" title="Slett">${icon('trash', 13)}</span>
        </button>
        ${last ? '' : ''}`;
      })
      .join('');
    listEl.querySelectorAll('[data-chat]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (event.target.closest('[data-del]')) return;
        const id = button.dataset.chat;
        if (id === activeId) return;
        pending = null;
        activeId = id;
        saveChats();
        renderList();
        renderTop();
        renderThread();
      });
    });
    listEl.querySelectorAll('[data-del]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = button.dataset.del;
        const chat = chats.find((item) => item.id === id);
        if (!chat) return;
        const ok = await confirmDialog({
          title: 'Slette samtalen?',
          message: `«${chat.title}» fjernes fra denne PC-en.`,
          confirm: 'Slett',
          danger: true,
        });
        if (!ok) return;
        chats = chats.filter((item) => item.id !== id);
        if (!chats.length) chats = [newChatObject(defaultProvider())];
        if (activeId === id) activeId = chats[0].id;
        saveChats();
        renderList();
        renderTop();
        renderThread();
      });
    });
  }

  function renderTop() {
    const chat = activeChat();
    const available = PROVIDERS.filter((provider) => provider.key !== 'custom' || availability.custom);
    topEl.innerHTML = `
      <span class="chat-top-title" title="${esc(chat.title)}">${esc(chat.title)}</span>
      <div class="segmented" id="providerSeg">
        ${available
          .map(
            (provider) =>
              `<button type="button" data-provider="${provider.key}" class="${chat.provider === provider.key ? 'active' : ''}">${esc(provider.label)}</button>`
          )
          .join('')}
      </div>
      <div class="segmented" id="modeSeg">
        <button type="button" data-mode="chat" class="${chat.mode === 'chat' ? 'active' : ''}">Chat</button>
        <button type="button" data-mode="agent" class="${chat.mode === 'agent' ? 'active' : ''}">Agent</button>
      </div>
      <select class="select" id="chatProject" style="width:auto;max-width:190px;height:28px;font-size:11.5px">
        <option value="">Arbeidsområdet</option>
        ${(state.projects || [])
          .map((project) => `<option value="${esc(project.name)}" ${chat.project === project.name ? 'selected' : ''}>${esc(project.name)}</option>`)
          .join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn icon-btn subtle" id="chatNewTop" type="button" title="Ny samtale">${icon('plus', 16)}</button>
    `;

    topEl.querySelectorAll('[data-provider]').forEach((button) => {
      button.addEventListener('click', () => {
        chat.provider = button.dataset.provider;
        if (chat.provider === 'techai' && chat.mode === 'agent') chat.mode = 'chat';
        chat.updatedAt = Date.now();
        saveChats();
        renderTop();
        renderThread();
      });
    });
    topEl.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        chat.mode = button.dataset.mode;
        if (chat.mode === 'agent' && chat.provider === 'techai') chat.provider = 'gemini';
        chat.updatedAt = Date.now();
        saveChats();
        renderTop();
        renderThread();
      });
    });
    const projectSelect = topEl.querySelector('#chatProject');
    if (projectSelect) {
      projectSelect.addEventListener('change', () => {
        chat.project = projectSelect.value;
        saveChats();
        renderThread();
      });
    }
    const newTop = topEl.querySelector('#chatNewTop');
    if (newTop) newTop.addEventListener('click', createChat);

    if (contextHint) {
      contextHint.textContent = chat.mode === 'agent' ? `Agent · ${chat.project || 'arbeidsområdet'}` : 'Chat-modus';
    }
    input.placeholder =
      chat.mode === 'agent'
        ? 'Beskriv hva agenten skal gjøre …'
        : `Spør ${providerLabel(chat.provider)} …`;

    // Banner ved manglende nøkkel / udefinert agent.
    bannerEl.innerHTML = '';
    if (!availability[chat.provider] && !isRemote) {
      bannerEl.innerHTML = `<div class="no-key-banner">${icon('alert', 14)}<span>${esc(providerLabel(chat.provider))} mangler API-nøkkel.</span><a href="#/settings" data-settings>Legg den inn</a></div>`;
      bannerEl.querySelector('[data-settings]').addEventListener('click', (event) => {
        event.preventDefault();
        navigate('#/settings');
      });
    } else if (chat.mode === 'agent' && chat.provider === 'techai') {
      bannerEl.innerHTML = `<div class="no-key-banner">${icon('alert', 14)}<span>Agent-modus støtter ikke Tech-AI. Velg Gemini eller DeepSeek.</span></div>`;
    }
    updateSendState();
  }

  function updateSendState() {
    const chat = activeChat();
    const blocked =
      (!availability[chat.provider] && !isRemote) || (chat.mode === 'agent' && chat.provider === 'techai');
    sendBtn.disabled = Boolean(blocked) || Boolean(pending);
    input.placeholder = pending
      ? chat.mode === 'agent'
        ? 'Agenten jobber …'
        : `${providerLabel(chat.provider)} svarer …`
      : chat.mode === 'agent'
        ? 'Beskriv hva agenten skal gjøre …'
        : `Spør ${providerLabel(chat.provider)} …`;
  }

  function thinkingHtml() {
    const chat = activeChat();
    const label = chat.mode === 'agent' ? 'Agenten jobber' : `${providerLabel(pending.provider)} tenker`;
    return `<div class="msg assistant" id="thinkingMsg">
      <div class="msg-avatar ${chat.provider}">${providerShort(chat.provider)}</div>
      <div class="msg-body">
        <div class="msg-name">${esc(providerLabel(chat.provider))}</div>
        <div class="thinking">
          <span class="pulse"><i></i><i></i><i></i></span>
          <span>${esc(label)} …</span>
          <span class="muted" id="thinkingTime">0 s</span>
        </div>
      </div>
    </div>`;
  }

  function renderThread() {
    const chat = activeChat();
    if (!chat.messages.length && !pending) {
      threadEl.innerHTML = `
        <div class="chat-empty">
          <div class="glyph">${icon('sparkles', 30)}</div>
          <h2>Hva skal vi bygge?</h2>
          <p>${chat.mode === 'agent' ? 'Agenten kan lese og skrive filer og kjøre kommandoer på PC-en.' : `Spør ${esc(providerLabel(chat.provider))}, eller bytt til agent-modus for å la AI-en gjøre jobben.`}</p>
          <div class="suggestions">
            <button class="suggestion" type="button" data-suggest="Lag en enkel nettside med en fin startside, og legg den i et nytt prosjekt.">Lag en nettside</button>
            <button class="suggestion" type="button" data-suggest="Se gjennom prosjektet og foreslå forbedringer. Forklar hva koden gjør.">Forklar prosjektet</button>
            <button class="suggestion" type="button" data-suggest="Kjør git status, og oppsummer hva som er endret.">Sjekk git status</button>
            <button class="suggestion" type="button" data-suggest="Lag en README med en kort beskrivelse, hvordan man installerer og hvordan man kjører prosjektet.">Skriv README</button>
          </div>
        </div>`;
      threadEl.querySelectorAll('[data-suggest]').forEach((button) => {
        button.addEventListener('click', () => {
          input.value = button.dataset.suggest;
          input.focus();
          autoGrow();
        });
      });
      return;
    }

    const html = chat.messages
      .map((message, index) => {
        if (message.role === 'user') {
          return `<div class="msg user"><div class="msg-body">${esc(message.content)}</div></div>`;
        }
        if (message.error) {
          return `<div class="msg assistant">
            <div class="msg-avatar ${esc(message.provider || chat.provider)}">${providerShort(message.provider || chat.provider)}</div>
            <div class="msg-body">
              <div class="msg-name">${esc(providerLabel(message.provider || chat.provider))}</div>
              <div class="chat-error">${esc(message.content)} <a href="#/settings" data-settings-inline>Åpne innstillinger</a></div>
            </div>
          </div>`;
        }
        return `<div class="msg assistant">
          <div class="msg-avatar ${esc(message.provider || chat.provider)}">${providerShort(message.provider || chat.provider)}</div>
          <div class="msg-body">
            <div class="msg-name">${esc(providerLabel(message.provider || chat.provider))}${message.model ? `<span class="badge">${esc(message.model)}</span>` : ''}</div>
            ${markdown(message.content)}
            ${stepsHtml(message.steps)}
            <div class="msg-actions">
              <button type="button" data-copy-msg="${index}">${icon('copy', 12)} Kopier</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    threadEl.innerHTML = html + (pending ? thinkingHtml() : '');
    threadEl.querySelectorAll('[data-copy-msg]').forEach((button) => {
      button.addEventListener('click', async () => {
        const message = chat.messages[Number(button.dataset.copyMsg)];
        if (!message) return;
        try {
          await navigator.clipboard.writeText(message.content);
          toast('Svaret er kopiert', 'success', 1600);
        } catch {
          toast('Kunne ikke kopiere', 'error');
        }
      });
    });
    threadEl.querySelectorAll('[data-settings-inline]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigate('#/settings');
      });
    });

    if (stick) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  function createChat() {
    const chat = newChatObject(defaultProvider());
    chats.unshift(chat);
    activeId = chat.id;
    pending = null;
    saveChats();
    renderList();
    renderTop();
    renderThread();
    setTimeout(() => input.focus(), 40);
  }

  async function send() {
    const chat = activeChat();
    const text = input.value.trim();
    if (!text || pending) return;
    if (!availability[chat.provider] && !isRemote) {
      toast(`${providerLabel(chat.provider)} mangler API-nøkkel. Åpne Innstillinger → AI.`, 'warning');
      return;
    }

    const userMessage = { role: 'user', content: text, ts: Date.now() };
    chat.messages.push(userMessage);
    if (chat.title === 'Ny samtale') {
      chat.title = text.slice(0, 44) + (text.length > 44 ? '…' : '');
    }
    chat.updatedAt = Date.now();
    input.value = '';
    autoGrow();
    renderTop();
    pending = { provider: chat.provider, mode: chat.mode, startedAt: Date.now() };
    stick = true;
    renderThread();
    renderList();
    updateSendState();
    scrollEl.scrollTop = scrollEl.scrollHeight;

    const started = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const node = root.querySelector('#thinkingTime');
      if (node) node.textContent = fmtDuration(Date.now() - started);
    }, 500);

    controller = new AbortController();
    try {
      const history = chat.messages.slice(0, -1).slice(-20).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      let result;
      if (chat.mode === 'agent') {
        result = await api.post(
          '/api/agent',
          { provider: chat.provider, goal: text, project: chat.project, history, maxSteps: 12 },
          { signal: controller.signal }
        );
        chat.messages.push({
          role: 'assistant',
          provider: chat.provider,
          content: result.reply || 'Agenten ga ikke noe svar.',
          steps: result.steps || [],
          model: result.model || '',
          ts: Date.now(),
        });
      } else {
        result = await api.post(
          '/api/chat',
          {
            provider: chat.provider,
            project: chat.project,
            messages: [...history, { role: 'user', content: text }],
          },
          { signal: controller.signal }
        );
        chat.messages.push({
          role: 'assistant',
          provider: chat.provider,
          content: result.reply || '(Tomt svar)',
          model: result.model || '',
          ts: Date.now(),
        });
      }
      chat.updatedAt = Date.now();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        chat.messages.push({
          role: 'assistant',
          provider: chat.provider,
          content: 'Svaret ble avbrutt.',
          error: true,
          ts: Date.now(),
        });
      } else {
        chat.messages.push({
          role: 'assistant',
          provider: chat.provider,
          content: err.message || 'Kunne ikke få svar fra AI-en.',
          error: true,
          ts: Date.now(),
        });
      }
    } finally {
      if (timer) clearInterval(timer);
      timer = null;
      pending = null;
      controller = null;
      saveChats();
      renderList();
      renderThread();
      updateSendState();
      input.focus();
    }
  }

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
  input.addEventListener('blur', () => saveChats());
  sendBtn.addEventListener('click', send);
  root.querySelector('#chatNewSide').addEventListener('click', createChat);
  scrollEl.addEventListener('scroll', () => {
    const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    stick = distance < 140;
  });

  renderList();
  renderTop();
  renderThread();
  setTimeout(() => input.focus(), 60);
  saveChats();

  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
    if (controller) controller.abort();
    saveChats();
  };
}

import { api, AuthError, getTheme, getServerUrl } from './api.js';
import { icon, logo } from './icons.js';
import { esc, toast } from './ui.js';
import * as homeView from './views/home.js';
import * as projectsView from './views/projects.js';
import * as editorView from './views/editor.js';
import * as chatView from './views/chat.js';
import * as terminalView from './views/terminal.js';
import * as settingsView from './views/settings.js';

export const state = {
  status: null,
  settings: null,
  stats: null,
  projects: [],
  theme: 'dark',
  bootedAt: Date.now(),
};

const VIEWS = {
  home: homeView,
  projects: projectsView,
  editor: editorView,
  chat: chatView,
  terminal: terminalView,
  settings: settingsView,
};

const NAV_ITEMS = [
  { id: 'home', label: 'Hjem', icon: 'home', hash: '#/home' },
  { id: 'projects', label: 'Prosjekter', icon: 'folder', hash: '#/projects' },
  { id: 'chat', label: 'Chat', icon: 'chat', hash: '#/chat' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal', hash: '#/terminal' },
];

const bind = window.servidor || null;
let currentCleanup = null;
let routeToken = 0;
let navCollapsed = false;

/* ---------- Tema ---------- */
function applyTheme() {
  const preference = (state.settings && state.settings.theme) || getTheme() || 'system';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  state.theme = dark ? 'dark' : 'light';
}

/* ---------- Navigasjon ---------- */
function renderNav() {
  const items = document.getElementById('navItems');
  const footer = document.getElementById('navFooter');
  if (!items || !footer) return;

  items.innerHTML = `
    <div class="nav-group-label">Arbeidsområde</div>
    ${NAV_ITEMS.map(
      (item) => `
      <button class="nav-item" data-route="${item.hash}" data-nav="${item.id}" type="button" title="${esc(item.label)}">
        ${icon(item.icon, 18)}
        <span class="nav-label">${esc(item.label)}</span>
      </button>`
    ).join('')}
  `;

  footer.innerHTML = `
    <div class="nav-status" id="navStatus"></div>
    <button class="nav-item" data-route="#/settings" data-nav="settings" type="button" title="Innstillinger">
      ${icon('settings', 18)}
      <span class="nav-label">Innstillinger</span>
    </button>
    <button class="nav-item nav-collapse" id="navCollapse" type="button" title="Skjul navigasjonen (Ctrl+B)">
      ${icon('panel', 18)}
      <span class="nav-label">Skjul</span>
    </button>
  `;

  items.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route));
  });
  footer.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route));
  });

  const collapse = document.getElementById('navCollapse');
  if (collapse) {
    collapse.addEventListener('click', () => {
      navCollapsed = !navCollapsed;
      document.getElementById('nav').classList.toggle('collapsed', navCollapsed);
      try {
        localStorage.setItem('servidor.navCollapsed', navCollapsed ? '1' : '0');
      } catch {
        /* file:// uten localStorage */
      }
    });
  }
  updateNavStatus();
}

function updateNavStatus() {
  const node = document.getElementById('navStatus');
  if (!node) return;
  if (!state.status) {
    node.innerHTML = '<span class="status-dot off"></span><span class="nav-status-text">Ikke tilkoblet</span>';
    node.title = 'Ikke tilkoblet';
    return;
  }
  const remote = state.status.remote;
  let text = 'Lokal';
  let dot = 'status-dot';
  if (remote && remote.enabled) {
    if (remote.online) {
      text = `Server · ${(remote.os || 'Linux').split(' ')[0]}`;
    } else {
      text = 'Server utilgjengelig';
      dot = 'status-dot off';
    }
  } else if (state.status) {
    text = `Lokal · ${state.status.app.hostname}`;
  }
  node.innerHTML = `<span class="${dot}"></span><span class="nav-status-text">${esc(text)}</span>`;
  node.title = text;
}

function setActiveNav(name) {
  const active = name === 'editor' ? 'projects' : name;
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === active);
  });
}

/* ---------- Ruting ---------- */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, queryString = ''] = raw.split('?');
  return { name: name || 'home', query: new URLSearchParams(queryString) };
}

export function navigate(hash) {
  if (location.hash === hash) {
    renderRoute();
    return;
  }
  location.hash = hash;
}

async function renderRoute() {
  if (!api.getToken()) {
    showConnect();
    return;
  }

  const { name, query } = parseRoute();
  const view = VIEWS[name] || VIEWS.home;
  const token = ++routeToken;

  if (currentCleanup) {
    try {
      currentCleanup();
    } catch {
      /* ignorert */
    }
    currentCleanup = null;
  }

  setActiveNav(name);
  const container = document.getElementById('view');
  container.innerHTML = '';
  container.scrollTop = 0;
  document.title = `${name === 'home' ? 'Hjem' : name[0].toUpperCase() + name.slice(1)} · Servidor`;

  const context = {
    query,
    state,
    navigate,
    reload: loadBootstrap,
    applyTheme,
    onSettingsChanged: async () => {
      await loadBootstrap();
      updateNavStatus();
    },
  };

  try {
    const cleanup = await view.mount(container, context);
    if (token !== routeToken) {
      if (typeof cleanup === 'function') cleanup();
      return;
    }
    currentCleanup = typeof cleanup === 'function' ? cleanup : null;
  } catch (err) {
    if (token !== routeToken) return;
    console.error(err);
    container.innerHTML = `
      <div class="page"><div class="page-inner">
        <div class="empty-state">
          <div class="empty-glyph">${icon('alert', 30)}</div>
          <h3>Noe gikk galt</h3>
          <p>${esc(err.message || 'Ukjent feil')}</p>
        </div>
      </div></div>`;
  }
}

/* ---------- Oppstart ---------- */
async function loadBootstrap() {
  const data = await api.get('/api/settings');
  const projects = await api.get('/api/projects').catch((err) => {
    if (err instanceof AuthError) throw err;
    return { projects: [] };
  });
  state.settings = data.settings;
  state.status = data.status;
  state.projects = projects.projects || [];
  applyTheme();
  updateNavStatus();
  return data;
}

function showOffline(error) {
  const container = document.getElementById('view');
  container.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="empty-state" style="min-height: 70vh">
        <div class="empty-glyph">${icon('server', 30)}</div>
        <h3>Får ikke kontakt med Ubuntu-serveren</h3>
        <p>${esc(error.message || 'Serveren svarer ikke.')}</p>
        <p class="tiny">Sjekk at Tailscale er tilkoblet på denne PC-en, og at tjenesten kjører på serveren.</p>
        <button class="btn primary" id="retryBoot" type="button">${icon('refresh', 16)}<span>Prøv igjen</span></button>
      </div>
    </div></div>`;
  const retry = document.getElementById('retryBoot');
  if (retry) {
    retry.addEventListener('click', async () => {
      try {
        await loadBootstrap();
        renderRoute();
      } catch (err) {
        if (err instanceof AuthError) {
          api.clearToken();
          showConnect(err.message);
          return;
        }
        toast(err.message, 'error');
      }
    });
  }
}

function showConnect(message = '') {
  const container = document.getElementById('view');
  if (!container) return;
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch {
      /* ignorert */
    }
    currentCleanup = null;
  }
  document.title = 'Koble til · Servidor';
  container.innerHTML = `
    <div class="page">
      <div class="page-inner" style="max-width:560px;margin-top:8vh">
        <div class="card" style="padding:26px">
          <div class="row" style="gap:10px;margin-bottom:6px">
            <div class="empty-glyph" style="width:42px;height:42px;border-radius:11px;margin:0">${icon('server', 22)}</div>
            <div>
              <h1 style="margin:0;font-size:22px">Koble til Ubuntu-serveren</h1>
              <p class="muted" style="margin:2px 0 0;font-size:12px">Windows-klient · UI kjører lokalt</p>
            </div>
          </div>
          <p class="muted" style="font-size:12.5px;line-height:1.5">
            Dette er en klient til Ubuntu-serveren din. Prosjekter, filer, terminal og AI-kall behandles på serveren via Tailscale.
          </p>
          <label class="field">
            <span class="field-label">Serveradresse</span>
            <input class="input" id="connectUrl" type="url" autocomplete="off" spellcheck="false"
              value="${esc(getServerUrl())}" placeholder="http://<Ubuntu-Tailscale-IP>:8000" />
          </label>
          <label class="field">
            <span class="field-label">X-API-Token</span>
            <input class="input" id="connectToken" type="password" autocomplete="off" spellcheck="false" placeholder="Lim inn API-token" />
          </label>
          <p class="test-result fail" id="connectError" style="${message ? '' : 'display:none'}">${esc(message)}</p>
          <div class="field-row">
            <button class="btn primary" id="connectBtn" type="button">${icon('link', 15)}<span>Koble til</span></button>
            <span class="tiny">Bruk Ubuntu-serverens Tailscale-IP, ikke Windows-PC-ens.</span>
          </div>
        </div>
      </div>
    </div>`;

  const urlInput = document.getElementById('connectUrl');
  const input = document.getElementById('connectToken');
  const button = document.getElementById('connectBtn');
  const errorBox = document.getElementById('connectError');

  const connect = async () => {
    const serverUrl = urlInput.value.trim();
    const token = input.value.trim();
    if (!serverUrl || !token) {
      errorBox.style.display = 'block';
      errorBox.textContent = 'Både serveradresse og token må fylles ut.';
      (serverUrl ? input : urlInput).focus();
      return;
    }
    try {
      const parsed = new URL(serverUrl);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('Bruk http:// eller https://');
    } catch (err) {
      errorBox.style.display = 'block';
      errorBox.textContent = 'Ugyldig serveradresse: ' + err.message;
      urlInput.focus();
      return;
    }
    button.disabled = true;
    errorBox.style.display = 'none';
    api.setServerUrl(serverUrl);
    api.setToken(token);
    try {
      await loadBootstrap();
      await renderRoute();
    } catch (err) {
      api.clearToken();
      errorBox.style.display = 'block';
      errorBox.textContent = err.message || 'Kunne ikke koble til.';
      button.disabled = false;
      input.focus();
      input.select();
    }
  };

  button.addEventListener('click', connect);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') connect();
  });
  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') connect();
  });
  setTimeout(() => input.focus(), 80);
}

/* ---------- Kommandopalett ---------- */
function paletteActions() {
  const actions = [
    ...NAV_ITEMS.map((item) => ({
      group: 'Gå til',
      label: item.label,
      icon: item.icon,
      sub: `Ctrl+${NAV_ITEMS.indexOf(item) + 1}`,
      run: () => navigate(item.hash),
    })),
    {
      group: 'Gå til',
      label: 'Innstillinger',
      icon: 'settings',
      sub: 'Ctrl+5',
      run: () => navigate('#/settings'),
    },
    {
      group: 'Handlinger',
      label: 'Nytt prosjekt',
      icon: 'folder',
      run: () => navigate('#/projects?new=1'),
    },
    {
      group: 'Handlinger',
      label: 'Ny samtale',
      icon: 'chat',
      run: () => navigate('#/chat?new=1'),
    },
    {
      group: 'Handlinger',
      label: 'Ny terminal',
      icon: 'terminal',
      run: () => navigate('#/terminal'),
    },
    {
      group: 'Handlinger',
      label: 'Bytt tema',
      icon: state.theme === 'dark' ? 'sun' : 'moon',
      sub: state.settings ? `Nå: ${state.settings.theme}` : '',
      run: async () => {
        const order = ['system', 'light', 'dark'];
        const current = (state.settings && state.settings.theme) || 'system';
        const next = order[(order.indexOf(current) + 1) % order.length];
        try {
          const data = await api.put('/api/settings', { theme: next });
          state.settings = data.settings;
          applyTheme();
          toast(`Tema: ${next === 'system' ? 'system' : next === 'dark' ? 'mørkt' : 'lyst'}`, 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    {
      group: 'Handlinger',
      label: 'Oppdater data',
      icon: 'refresh',
      run: async () => {
        await loadBootstrap();
        renderRoute();
        toast('Oppdatert', 'success');
      },
    },
  ];
  return actions;
}

function openPalette() {
  if (document.querySelector('.palette-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'palette-backdrop';
  backdrop.innerHTML = `
    <div class="palette">
      <div class="palette-input-row">
        ${icon('search', 16)}
        <input class="palette-input" type="text" placeholder="Søk etter side eller handling …" autocomplete="off" spellcheck="false" />
        <span class="kbd">Esc</span>
      </div>
      <div class="palette-results"></div>
    </div>`;
  document.getElementById('overlayRoot').appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('in'));

  const input = backdrop.querySelector('.palette-input');
  const results = backdrop.querySelector('.palette-results');
  const all = paletteActions();
  let filtered = all;
  let selected = 0;

  const render = () => {
    const query = input.value.trim().toLowerCase();
    filtered = query
      ? all.filter((action) => action.label.toLowerCase().includes(query) || (action.sub || '').toLowerCase().includes(query))
      : all;
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    if (!filtered.length) {
      results.innerHTML = '<div class="palette-empty">Ingen treff</div>';
      return;
    }
    let group = '';
    results.innerHTML = filtered
      .map((action, index) => {
        const header = action.group && action.group !== group ? `<div class="palette-group">${esc(action.group)}</div>` : '';
        group = action.group || group;
        return `${header}<button class="palette-item ${index === selected ? 'selected' : ''}" data-index="${index}" type="button">
          ${icon(action.icon, 16)}<span>${esc(action.label)}</span>
          ${action.sub ? `<span class="palette-sub">${esc(action.sub)}</span>` : ''}
        </button>`;
      })
      .join('');
    results.querySelectorAll('.palette-item').forEach((button) => {
      button.addEventListener('mouseenter', () => {
        selected = Number(button.dataset.index);
        results.querySelectorAll('.palette-item').forEach((item) => item.classList.toggle('selected', item === button));
      });
      button.addEventListener('click', () => run(Number(button.dataset.index)));
    });
  };

  const close = () => {
    backdrop.classList.remove('in');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => backdrop.remove(), 140);
  };

  const run = (index) => {
    const action = filtered[index];
    if (!action) return;
    close();
    setTimeout(() => action.run(), 30);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = Math.min(selected + 1, filtered.length - 1);
      render();
      const active = results.querySelector('.palette-item.selected');
      if (active) active.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      render();
      const active = results.querySelector('.palette-item.selected');
      if (active) active.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(selected);
    }
  };

  input.addEventListener('input', () => {
    selected = 0;
    render();
  });
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey, true);
  render();
  setTimeout(() => input.focus(), 30);
}

/* ---------- Vinduskontroller ---------- */
function setupWindowControls() {
  const minimize = document.getElementById('winMin');
  const maximize = document.getElementById('winMax');
  const close = document.getElementById('winClose');
  if (minimize) minimize.innerHTML = icon('minus', 16);
  if (maximize) maximize.innerHTML = icon('maximize', 14);
  if (close) close.innerHTML = icon('close', 16);

  if (!bind) return;
  document.body.classList.add('electron');
  minimize && minimize.addEventListener('click', () => bind.window.minimize());
  maximize && maximize.addEventListener('click', () => bind.window.maximize());
  close && close.addEventListener('click', () => bind.window.close());

  if (bind.window.onMaximized) {
    bind.window.onMaximized((maximized) => {
      if (maximize) maximize.innerHTML = icon(maximized ? 'restore' : 'maximize', 14);
    });
  }
  const titlebar = document.getElementById('titlebar');
  if (titlebar) {
    titlebar.addEventListener('dblclick', (event) => {
      if (event.target.closest('button, input')) return;
      bind.window.maximize();
    });
  }
}

/* ---------- Tastatursnarveier ---------- */
function setupShortcuts() {
  document.addEventListener('keydown', (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl) return;
    const key = event.key.toLowerCase();
    if (key === 'k') {
      event.preventDefault();
      openPalette();
    } else if (key === 'b') {
      event.preventDefault();
      document.getElementById('nav').classList.toggle('collapsed');
      navCollapsed = document.getElementById('nav').classList.contains('collapsed');
      try {
        localStorage.setItem('servidor.navCollapsed', navCollapsed ? '1' : '0');
      } catch {
        /* file:// uten localStorage */
      }
    } else if (['1', '2', '3', '4', '5'].includes(key)) {
      event.preventDefault();
      const target = [...NAV_ITEMS.map((item) => item.hash), '#/settings'][Number(key) - 1];
      if (target) navigate(target);
    }
  });
}

/* ---------- Start ---------- */
async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('shell') === 'edge') document.body.classList.add('edge-shell');

  const logoNode = document.getElementById('tbLogo');
  if (logoNode) logoNode.innerHTML = logo(22);
  const searchIcon = document.getElementById('tbSearchIcon');
  if (searchIcon) searchIcon.innerHTML = icon('search', 14);

  setupWindowControls();
  renderNav();
  setupShortcuts();

  const paletteBtn = document.getElementById('paletteBtn');
  if (paletteBtn) paletteBtn.addEventListener('click', openPalette);

  try {
    navCollapsed = localStorage.getItem('servidor.navCollapsed') === '1';
  } catch {
    navCollapsed = false;
  }
  if (navCollapsed) document.getElementById('nav').classList.add('collapsed');

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

  window.addEventListener('hashchange', renderRoute);

  if (!api.getToken()) {
    showConnect();
    return;
  }

  try {
    await loadBootstrap();
    await renderRoute();
  } catch (err) {
    console.error(err);
    if (err instanceof AuthError) {
      api.clearToken();
      showConnect(err.message);
    } else {
      showOffline(err);
    }
  }

  window.addEventListener('focus', () => {
    if (state.settings) updateNavStatus();
  });
}

boot();

import { api } from '../api.js';
import { icon } from '../icons.js';
import {
  esc,
  fmtBytes,
  fmtNumber,
  fmtUptime,
  greeting,
  platformLabel,
  shortHost,
  sparkline,
  timeAgo,
  toast,
} from '../ui.js';

function providerMark(key, label) {
  const short = key === 'techai' ? 'T' : key === 'deepseek' ? 'D' : key === 'custom' ? '+' : 'G';
  return `<span class="provider-mark ${esc(key)}">${short}</span>`;
}

function skeletonStats() {
  return Array.from({ length: 4 })
    .map(
      () => `<div class="card stat-card">
        <div class="skeleton" style="width:66px;height:66px;border-radius:50%"></div>
        <div class="stat-info">
          <div class="skeleton" style="width:46px;height:10px;margin-bottom:8px"></div>
          <div class="skeleton" style="width:90px;height:16px;margin-bottom:8px"></div>
          <div class="skeleton" style="width:120px;height:10px"></div>
        </div>
      </div>`
    )
    .join('');
}

export async function mount(root, ctx) {
  const { state, navigate } = ctx;
  const status = state.status || {};
  const app = status.app || {};
  const remote = status.remote || {};
  const isRemote = app.mode === 'remote';
  const user = app.user || '';
  const hello = user ? `${greeting()}, ${user}` : greeting();

  root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>${esc(hello)}</h1>
            <p class="page-sub">
              <span>${esc(shortHost(app.hostname))}</span>
              <span class="sep"></span>
              <span>${esc(platformLabel(app.platform))}</span>
              <span class="sep"></span>
              <span>${isRemote ? 'Ubuntu-server via Tailscale' : 'Lokal'}</span>
              ${app.node ? `<span class="sep"></span><span>${esc(app.node)}</span>` : ''}
            </p>
          </div>
          <div class="actions">
            <button class="btn" id="homeNewChat" type="button">${icon('chat', 16)}<span>Ny samtale</span></button>
            <button class="btn primary" id="homeNewProject" type="button">${icon('plus', 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>

        <div class="stat-grid" id="homeStats">${skeletonStats()}</div>

        <div class="home-grid">
          <div class="home-stack">
            <div class="card" id="homeProjects">
              <div class="card-head">
                <div class="card-title">${icon('folder', 16)}<span>Prosjekter</span></div>
                <button class="card-link" data-goto="#/projects" type="button">Se alle ${icon('chevron-right', 12)}</button>
              </div>
              <div class="list" id="homeProjectList">
                <div style="padding:16px"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>
              </div>
            </div>

            <div class="card" id="homeRecent">
              <div class="card-head">
                <div class="card-title">${icon('history', 16)}<span>Siste endringer</span></div>
              </div>
              <div class="list" id="homeRecentList">
                <div style="padding:16px"><div class="skeleton" style="height:36px;margin-bottom:8px"></div><div class="skeleton" style="height:36px;margin-bottom:8px"></div><div class="skeleton" style="height:36px"></div></div>
              </div>
            </div>
          </div>

          <div class="home-stack">
            <div class="card" id="homeAi">
              <div class="card-head">
                <div class="card-title">${icon('sparkles', 16)}<span>AI-assistenter</span></div>
                <span class="badge" id="aiBadge">…</span>
              </div>
              <div id="homeAiList"></div>
              <div class="card-foot">
                <span class="tiny">${isRemote && remote.online ? 'Bruker serverens nøkler' : 'Nøkler lagres lokalt'}</span>
                <button class="card-link" data-goto="#/chat" type="button">Åpne chat ${icon('chevron-right', 12)}</button>
              </div>
            </div>

            <div class="card" id="homeQuick">
              <div class="card-head">
                <div class="card-title">${icon('layers', 16)}<span>Hurtighandlinger</span></div>
              </div>
              <div class="quick-grid">
                <button class="quick-action" data-goto="#/projects?new=1" type="button">
                  <span class="qa-icon">${icon('plus', 15)}</span>
                  <span><strong>Nytt prosjekt</strong><small>Start fra mal</small></span>
                </button>
                <button class="quick-action" data-goto="#/chat?new=1" type="button">
                  <span class="qa-icon">${icon('chat', 15)}</span>
                  <span><strong>Ny samtale</strong><small>Spør en agent</small></span>
                </button>
                <button class="quick-action" data-goto="#/terminal" type="button">
                  <span class="qa-icon">${icon('terminal', 15)}</span>
                  <span><strong>Terminal</strong><small>Kjør kommandoer</small></span>
                </button>
                <button class="quick-action" data-goto="#/settings" type="button">
                  <span class="qa-icon">${icon('settings', 15)}</span>
                  <span><strong>Innstillinger</strong><small>Nøkler og tema</small></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  root.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.goto));
  });
  const newProject = root.querySelector('#homeNewProject');
  if (newProject) newProject.addEventListener('click', () => navigate('#/projects?new=1'));
  const newChat = root.querySelector('#homeNewChat');
  if (newChat) newChat.addEventListener('click', () => navigate('#/chat?new=1'));

  let history = [];
  let timer = null;
  let disposed = false;

  function renderStats(stats) {
    const host = root.querySelector('#homeStats');
    if (!host) return;
    const cpu = stats.cpu || {};
    const memory = stats.memory || {};
    const disk = stats.disk || {};
    const uptime = stats.uptime || {};
    const cores = cpu.cores || 1;
    const cpuPercent = Math.round(Number(cpu.percent) || 0);
    const ramPercent = Math.round(Number(memory.percent) || 0);
    const diskPercent = Math.round(Number(disk.percent) || 0);
    history.push(cpuPercent);
    if (history.length > 34) history.shift();

    host.innerHTML = `
      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${cpuPercent};--ring-color:var(--accent)">
            <span class="ring-value">${cpuPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Prosessor</div>
          <div class="stat-main">${stats.remote ? 'Server' : `${cores} <small>${cores === 1 ? 'kjerne' : 'kjerner'}</small>`}</div>
          <div class="stat-note" title="${esc(cpu.model || '')}">${esc(cpu.model || 'Ukjent CPU')}</div>
          <div id="cpuSpark">${sparkline(history, 128, 24)}</div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${ramPercent};--ring-color:var(--violet)">
            <span class="ring-value">${ramPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Minne</div>
          <div class="stat-main">${esc(fmtBytes(memory.used || 0))}</div>
          <div class="stat-note">av ${esc(fmtBytes(memory.total || 0))}</div>
          <div class="bar"><span style="width:${ramPercent}%;--bar-color:var(--violet)"></span></div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="ring" style="--p:${diskPercent};--ring-color:var(--warning)">
            <span class="ring-value">${diskPercent}<small>%</small></span>
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Disk ${esc(disk.name || '')}</div>
          <div class="stat-main">${esc(fmtBytes(disk.used || 0))}</div>
          <div class="stat-note">av ${esc(fmtBytes(disk.total || 0))}</div>
          <div class="bar"><span style="width:${diskPercent}%;--bar-color:var(--warning)"></span></div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-ring">
          <div class="list-icon" style="width:66px;height:66px;border-radius:50%;background:var(--layer)">
            ${icon('clock', 26)}
          </div>
        </div>
        <div class="stat-info">
          <div class="stat-label">Oppetid</div>
          <div class="stat-main">${stats.remote ? '—' : esc(fmtUptime(uptime.system))}</div>
          <div class="stat-note">${stats.remote ? 'ekstern server' : 'denne PC-en'}</div>
          <div class="tiny" style="margin-top:5px">${stats.remote ? 'via Tailscale' : `Servidor ${esc(fmtUptime(uptime.process))}`}</div>
        </div>
      </div>`;
  }

  function renderProjects(projects) {
    const host = root.querySelector('#homeProjectList');
    if (!host) return;
    if (!projects.length) {
      host.innerHTML = `
        <div class="empty-state" style="padding:30px 20px">
          <div class="empty-glyph" style="width:48px;height:48px;border-radius:12px">${icon('folder', 24)}</div>
          <h3>Ingen prosjekter ennå</h3>
          <p>Lag ditt første prosjekt – med git, README og startfiler.</p>
          <button class="btn primary" id="emptyNewProject" type="button">${icon('plus', 16)}<span>Nytt prosjekt</span></button>
        </div>`;
      const button = host.querySelector('#emptyNewProject');
      if (button) button.addEventListener('click', () => navigate('#/projects?new=1'));
      return;
    }
    host.innerHTML = projects
      .slice(0, 5)
      .map(
        (project) => `
        <button class="list-row" data-open-project="${esc(project.name)}" type="button">
          <span class="list-icon">${icon('folder', 16)}</span>
          <span class="list-main">
            <span class="list-name">${esc(project.name)}</span>
            <span class="list-meta">${project.remote ? 'på Ubuntu-serveren' : `${fmtNumber(project.fileCount)} filer · ${esc(fmtBytes(project.size))}`}</span>
          </span>
          <span class="list-side">
            ${project.git ? '<span class="badge">git</span>' : ''}
            <span>${esc(timeAgo(project.modified))}</span>
            ${icon('chevron-right', 14)}
          </span>
        </button>`
      )
      .join('');
    host.querySelectorAll('[data-open-project]').forEach((row) => {
      row.addEventListener('click', () =>
        navigate(`#/editor?project=${encodeURIComponent(row.dataset.openProject)}`)
      );
    });
  }

  function renderAi() {
    const list = root.querySelector('#homeAiList');
    const badge = root.querySelector('#aiBadge');
    if (!list) return;
    const providers = (status.ai && status.ai.providers) || [];
    const configured = providers.filter((provider) => provider.configured).length;
    if (badge) {
      badge.textContent = configured ? `${configured} klar` : 'ikke satt opp';
      badge.className = `badge ${configured ? 'success' : ''}`.trim();
    }
    list.innerHTML = providers
      .map(
        (provider) => `
        <div class="provider-row">
          ${providerMark(provider.key, provider.label)}
          <span class="provider-name">${esc(provider.label)}</span>
          <span class="provider-state">${provider.key === 'custom' ? (provider.configured ? 'egen' : 'valgfri') : provider.configured ? 'klar' : 'mangler nøkkel'}</span>
          <span class="dot ${provider.configured ? '' : 'off'}"></span>
        </div>`
      )
      .join('');
  }

  function renderRecent(recent) {
    const host = root.querySelector('#homeRecentList');
    if (!host) return;
    if (!recent.length) {
      host.innerHTML = `<div class="empty-state" style="padding:24px 16px"><p style="margin:0">Ingen filer er endret ennå.</p></div>`;
      return;
    }
    host.innerHTML = recent
      .slice(0, 5)
      .map(
        (file) => `
        <button class="list-row" data-open-file="${esc(file.path)}" type="button">
          <span class="list-icon violet">${icon('file', 15)}</span>
          <span class="list-main">
            <span class="list-name">${esc(file.name)}</span>
            <span class="list-meta">${esc(file.project)}</span>
          </span>
          <span class="list-side"><span>${esc(timeAgo(file.mtime))}</span></span>
        </button>`
      )
      .join('');
    host.querySelectorAll('[data-open-file]').forEach((row) => {
      row.addEventListener('click', () => {
        const path = row.dataset.openFile;
        const project = path.split('/')[0];
        const file = path.split('/').slice(1).join('/');
        navigate(`#/editor?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`);
      });
    });
  }

  try {
    const [stats, projects, recent] = await Promise.all([
      api.get('/api/stats'),
      api.get('/api/projects'),
      api.get('/api/recent?limit=7'),
    ]);
    if (disposed || !root.isConnected) return undefined;
    state.stats = stats;
    state.projects = projects.projects || [];
    renderStats(stats);
    renderProjects(state.projects);
    renderRecent(recent.recent || []);
    renderAi();

    timer = setInterval(async () => {
      if (document.hidden || !root.isConnected) return;
      try {
        const fresh = await api.get('/api/stats');
        if (disposed || !root.isConnected) return;
        state.stats = fresh;
        const cpu = Math.round(Number(fresh.cpu?.percent) || 0);
        history.push(cpu);
        if (history.length > 34) history.shift();
        const ring = root.querySelector('.stat-card .ring');
        if (ring) {
          ring.style.setProperty('--p', cpu);
          const value = ring.querySelector('.ring-value');
          if (value) value.innerHTML = `${cpu}<small>%</small>`;
        }
        const spark = root.querySelector('#cpuSpark');
        if (spark) spark.innerHTML = sparkline(history, 128, 24);
        const bars = root.querySelectorAll('.stat-card .bar > span');
        if (bars[0] && fresh.memory) bars[0].style.width = `${Math.round(fresh.memory.percent || 0)}%`;
        if (bars[1] && fresh.disk) bars[1].style.width = `${Math.round(fresh.disk.percent || 0)}%`;
        const ramNote = root.querySelectorAll('.stat-card .stat-note');
        if (ramNote[1] && fresh.memory) {
          ramNote[1].textContent = `av ${fmtBytes(fresh.memory.total || 0)}`;
        }
      } catch {
        /* stille feil – prøver igjen */
      }
    }, 3000);
  } catch (err) {
    if (root.isConnected) {
      toast(err.message || 'Kunne ikke hente systemstatus', 'error');
      const host = root.querySelector('#homeStats');
      if (host) {
        host.innerHTML = `<div class="card" style="grid-column:1/-1;padding:18px"><div class="row">${icon('alert', 18)}<span>${esc(err.message)}</span></div></div>`;
      }
    }
  }

  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
  };
}

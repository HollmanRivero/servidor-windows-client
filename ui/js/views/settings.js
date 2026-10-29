import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, toast } from '../ui.js';

const THEMES = [
  { id: 'light', label: 'Lyst', icon: 'sun' },
  { id: 'dark', label: 'Mørkt', icon: 'moon' },
  { id: 'system', label: 'System', icon: 'monitor' },
];

export async function mount(root, ctx) {
  const { state } = ctx;
  const status = state.status || {};
  const providers = (status.ai && status.ai.providers) || [];
  const server = status.remote || {};
  const projectDir = status.workspace || '';
  const hasToken = Boolean(api.getToken());
  const currentTheme = (state.settings && state.settings.theme) || api.getTheme() || 'system';

  root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>Innstillinger</h1>
            <p class="page-sub">Tilkobling, AI-assistenter og utseende. Alt arbeid skjer på Ubuntu-serveren.</p>
          </div>
        </div>

        <div class="settings-wrap">
          <section class="card settings-card">
            <h2>Tilkobling</h2>
            <p class="settings-desc">UI-en snakker direkte med Ubuntu-serveren via Tailscale. Det finnes ingen lokal server.</p>
            <div class="settings-group">
              <div class="settings-group-head">
                <span class="provider-mark" style="background:var(--accent-soft);color:var(--accent)">S</span>
                <strong>${esc(api.origin())}</strong>
                <span class="badge ${server.online ? 'success' : 'danger'}" id="connBadge">${server.online ? 'tilkoblet' : 'utilgjengelig'}</span>
              </div>
              <p class="field-hint" style="margin:0 0 10px">
                ${esc(server.os || 'Ubuntu-server')} · versjon ${esc(status.app?.version || '?')}
              </p>
              <label class="field">
                <span class="field-label">Serveradresse</span>
                <input class="input" id="serverUrlInput" type="url" autocomplete="off" spellcheck="false" value="${esc(api.origin())}" />
              </label>
              <label class="field">
                <span class="field-label">X-API-Token</span>
                <div class="key-row">
                  <input class="input" id="tokenInput" type="password" autocomplete="off" spellcheck="false"
                    placeholder="${hasToken ? '•••••••• (lagret)' : 'API_TOKEN fra din Ubuntu-server'}" />
                  <button class="btn icon-btn subtle" id="showToken" type="button" title="Vis/skjul">${icon('keyboard', 15)}</button>
                </div>
              </label>
              <div class="field-row">
                <button class="btn primary" id="saveToken" type="button">${icon('check', 15)}<span>Lagre</span></button>
                <button class="btn ghost" id="testConn" type="button">${icon('wifi', 15)}<span>Test tilkobling</span></button>
                <button class="btn subtle" id="logout" type="button">${icon('close', 15)}<span>Logg ut</span></button>
                <span class="test-result" id="connResult"></span>
              </div>
              <p class="field-hint">Hent API_TOKEN fra din egen Ubuntu-servers <code>backend/.env</code>. Tokenet lagres bare i denne Windows-brukerens nettleserprofil.</p>
            </div>
          </section>

          <section class="card settings-card">
            <h2>AI-assistenter</h2>
            <p class="settings-desc">Nøklene ligger på serveren i <code>backend/.env</code>. Her ser du hvilke agenter som er klare.</p>
            <div class="settings-group">
              ${providers.length ? providers.map((provider) => `
                <div class="provider-row">
                  <span class="provider-mark ${esc(provider.key)}">${esc((provider.label || provider.key).slice(0, 1))}</span>
                  <span class="provider-name">${esc(provider.label || provider.key)}</span>
                  <span class="provider-state">${provider.configured ? 'klar' : 'mangler nøkkel'}</span>
                  <span class="dot ${provider.configured ? '' : 'off'}"></span>
                  ${provider.configured ? `<button class="btn small subtle" data-test-provider="${esc(provider.key)}" type="button">Test</button>` : ''}
                </div>`).join('') : '<p class="field-hint" style="margin:0">Ingen agenter rapportert fra serveren.</p>'}
            </div>
            <p class="field-hint">${esc(status.ai?.default ? `Standard: ${status.ai.default}` : '')}</p>
          </section>

          <section class="card settings-card">
            <h2>Utseende</h2>
            <p class="settings-desc">Lagres i denne nettleseren. «System» følger Windows.</p>
            <div class="theme-options">
              ${THEMES.map((theme) => `
                <button class="theme-card ${currentTheme === theme.id ? 'selected' : ''}" data-theme-choice="${theme.id}" type="button">
                  <span class="theme-preview ${theme.id === 'dark' ? 'dark' : 'light'}">
                    <span class="tp-side"></span>
                    <span class="tp-main"><span class="tp-line accent"></span><span class="tp-line"></span><span class="tp-line" style="width:70%"></span></span>
                  </span>
                  <span class="theme-label">${icon(theme.icon, 14)}<span>${theme.label}</span></span>
                </button>`).join('')}
            </div>
          </section>

          <section class="card settings-card">
            <h2>Om serveren</h2>
            <div class="about-grid">
              <dt>Adresse</dt><dd>${esc(api.origin())}</dd>
              <dt>OS</dt><dd>${esc(server.os || 'Linux')}</dd>
              <dt>Versjon</dt><dd>${esc(status.app?.version || '?')}</dd>
              <dt>Prosjektmappe</dt><dd>${esc(projectDir)}</dd>
              <dt>Shell</dt><dd>${status.shell?.enabled ? 'aktivert' : 'avslått'}</dd>
              <dt>Agentmodus</dt><dd>kjører på serveren</dd>
            </div>
            <div class="divider"></div>
            <div class="shortcut-list">
              <div class="shortcut-row"><span>Kommandopalett</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">K</span></span></div>
              <div class="shortcut-row"><span>Skjul navigasjon</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">B</span></span></div>
              <div class="shortcut-row"><span>Lagre fil</span><span class="keys"><span class="kbd">Ctrl</span><span class="kbd">S</span></span></div>
            </div>
          </section>
        </div>
      </div>
    </div>`;

  const tokenInput = root.querySelector('#tokenInput');
  const serverUrlInput = root.querySelector('#serverUrlInput');
  const showToken = root.querySelector('#showToken');
  const connResult = root.querySelector('#connResult');

  showToken.addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  root.querySelector('#saveToken').addEventListener('click', async () => {
    const value = tokenInput.value.trim();
    const serverUrl = serverUrlInput.value.trim();
    if (!value) {
      toast('Skriv inn API-token først', 'warning');
      tokenInput.focus();
      return;
    }
    try {
      const parsed = new URL(serverUrl);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('Bruk http:// eller https://');
    } catch (err) {
      toast('Ugyldig serveradresse: ' + err.message, 'error');
      serverUrlInput.focus();
      return;
    }
    api.setServerUrl(serverUrl);
    api.setToken(value);
    try {
      await ctx.reload();
      toast('Tilkobling lagret', 'success');
      ctx.navigate('#/settings');
    } catch (err) {
      api.clearToken();
      toast(err.message, 'error');
    }
  });

  root.querySelector('#testConn').addEventListener('click', async () => {
    connResult.className = 'test-result';
    connResult.textContent = 'Tester …';
    try {
      const data = await api.get('/api/status');
      connResult.className = 'test-result ok';
      connResult.textContent = `OK – ${data.remote?.os || 'server'} · ${data.app?.version || ''}`;
      const badge = root.querySelector('#connBadge');
      if (badge) {
        badge.className = 'badge success';
        badge.textContent = 'tilkoblet';
      }
    } catch (err) {
      connResult.className = 'test-result fail';
      connResult.textContent = err.message;
    }
  });

  root.querySelector('#logout').addEventListener('click', () => {
    api.clearToken();
    location.reload();
  });

  root.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      api.setTheme(theme);
      if (state.settings) state.settings.theme = theme;
      root.querySelectorAll('[data-theme-choice]').forEach((item) => item.classList.toggle('selected', item === button));
      ctx.applyTheme();
    });
  });

  root.querySelectorAll('[data-test-provider]').forEach((button) => {
    button.addEventListener('click', async () => {
      const provider = button.dataset.testProvider;
      button.disabled = true;
      button.textContent = 'Tester …';
      try {
        const result = await api.post('/api/ai/test', { provider });
        if (result.ok) {
          button.textContent = `OK (${result.ms} ms)`;
        } else {
          button.textContent = 'Feilet';
        }
      } catch (err) {
        button.textContent = 'Feilet';
        toast(err.message, 'error');
      }
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Test';
      }, 2500);
    });
  });

  return undefined;
}

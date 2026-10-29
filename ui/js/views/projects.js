import { api } from '../api.js';
import { icon } from '../icons.js';
import {
  confirmDialog,
  esc,
  fmtBytes,
  fmtNumber,
  menu,
  openDialog,
  timeAgo,
  toast,
} from '../ui.js';

const TEMPLATES = [
  { id: 'empty', label: 'Tom', hint: 'Bare en README' },
  { id: 'node', label: 'Node', hint: 'package.json + index.js' },
  { id: 'web', label: 'Nettside', hint: 'HTML, CSS og JS' },
  { id: 'python', label: 'Python', hint: 'main.py + requirements' },
];

function projectCard(project) {
  const description = project.description || 'Ingen beskrivelse ennå.';
  return `
    <article class="project-card" data-project="${esc(project.name)}" tabindex="0" role="button" aria-label="Åpne ${esc(project.name)}">
      <div class="pc-top">
        <span class="pc-tile">${icon('folder', 19)}</span>
        <button class="btn icon-btn small subtle" data-menu="${esc(project.name)}" type="button" aria-label="Meny for ${esc(project.name)}">${icon('more', 16)}</button>
      </div>
      <h3 class="pc-name">${esc(project.name)}</h3>
      <p class="pc-desc">${esc(description)}</p>
      <div class="pc-meta">
        <span>${project.remote ? 'ekstern' : `${fmtNumber(project.fileCount)} filer`}</span>
        ${project.remote ? '' : `<span>${esc(fmtBytes(project.size))}</span>`}
        <span>${esc(timeAgo(project.modified))}</span>
        ${project.git ? '<span class="badge">git</span>' : ''}
      </div>
    </article>`;
}

function newProjectCard() {
  return `
    <button class="project-card new" id="newProjectCard" type="button">
      <span class="pc-tile">${icon('plus', 18)}</span>
      <strong>Nytt prosjekt</strong>
      <span>Start noe nytt</span>
    </button>`;
}

function openCreateDialog({ workspace, onCreated }) {
  let template = 'web';
  let git = true;
  let readme = true;

  const form = document.createElement('div');
  form.className = 'dialog-form';
  form.innerHTML = `
    <label class="field">
      <span class="field-label">Prosjektnavn</span>
      <input class="input" name="name" autocomplete="off" spellcheck="false" placeholder="f.eks. MinNettside" />
    </label>
    <div class="field">
      <span class="field-label">Mal</span>
      <div class="theme-options" style="grid-template-columns:repeat(4,1fr)">
        ${TEMPLATES.map(
          (item) => `
          <button class="theme-card ${item.id === template ? 'selected' : ''}" data-template="${item.id}" type="button">
            <span class="theme-label"><strong style="font-size:12px">${esc(item.label)}</strong></span>
            <span class="tiny" style="font-size:10.5px">${esc(item.hint)}</span>
          </button>`
        ).join('')}
      </div>
    </div>
    <div class="settings-group" style="margin-top:4px">
      <label class="switch-row" style="padding:6px 0;border:0">
        <span class="switch-copy"><strong>Git-repo</strong><span>Kjør git init og lag første commit</span></span>
        <button class="switch on" data-switch="git" type="button" role="switch" aria-checked="true"></button>
      </label>
      <label class="switch-row" style="padding:6px 0;border:0">
        <span class="switch-copy"><strong>README</strong><span>Lag en README.md med prosjektnavnet</span></span>
        <button class="switch on" data-switch="readme" type="button" role="switch" aria-checked="true"></button>
      </label>
    </div>
    <p class="field-hint" id="createHint">Opprettes i ${esc(workspace)}</p>
    <p class="test-result fail" id="createError" style="display:none"></p>
  `;

  const nameInput = form.querySelector('input[name="name"]');
  form.querySelectorAll('[data-template]').forEach((button) => {
    button.addEventListener('click', () => {
      template = button.dataset.template;
      form.querySelectorAll('[data-template]').forEach((item) => item.classList.toggle('selected', item === button));
    });
  });
  form.querySelectorAll('[data-switch]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.switch;
      if (key === 'git') git = !git;
      else readme = !readme;
      const value = key === 'git' ? git : readme;
      button.classList.toggle('on', value);
      button.setAttribute('aria-checked', value ? 'true' : 'false');
    });
  });

  const dialog = openDialog({
    title: 'Nytt prosjekt',
    subtitle: 'Lag en mappe med startfiler, klar til å kodes.',
    content: form,
    width: 560,
    footer: [
      { label: 'Avbryt', onClick: () => {} },
      {
        label: 'Opprett prosjekt',
        kind: 'primary',
        icon: 'plus',
        onClick: async () => {
          const name = nameInput.value.trim();
          const errorBox = form.querySelector('#createError');
          if (!name) {
            nameInput.focus();
            nameInput.classList.add('invalid');
            setTimeout(() => nameInput.classList.remove('invalid'), 900);
            return false;
          }
          try {
            const created = await api.post('/api/projects', { name, template, git, readme });
            toast(`Prosjektet «${created.name}» er opprettet`, 'success');
            dialog.close();
            onCreated(created);
          } catch (err) {
            errorBox.style.display = 'block';
            errorBox.textContent = err.message;
            return false;
          }
          return false;
        },
      },
    ],
  });
  setTimeout(() => nameInput.focus(), 80);
}

export async function mount(root, ctx) {
  const { state, navigate } = ctx;
  const workspace = (state.status && state.status.workspace) || '';

  root.innerHTML = `
    <div class="page">
      <div class="page-inner">
        <div class="page-head">
          <div>
            <h1>Prosjekter</h1>
            <p class="page-sub">${esc(workspace)}</p>
          </div>
          <div class="actions">
            <button class="btn primary" id="createProject" type="button">${icon('plus', 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>

        <div class="project-toolbar">
          <div class="search-box">
            ${icon('search', 15)}
            <input class="input" id="projectSearch" type="search" placeholder="Søk i prosjekter …" autocomplete="off" />
          </div>
          <span class="tiny" id="projectCount"></span>
          <div class="grow"></div>
          <button class="btn icon-btn subtle" id="refreshProjects" type="button" title="Oppdater">${icon('refresh', 16)}</button>
        </div>

        <div class="project-grid" id="projectGrid">
          ${Array.from({ length: 6 })
            .map(
              () => `<div class="card" style="min-height:164px;padding:16px">
                <div class="skeleton" style="width:38px;height:38px;border-radius:9px;margin-bottom:12px"></div>
                <div class="skeleton" style="height:14px;width:60%;margin-bottom:8px"></div>
                <div class="skeleton" style="height:10px;width:90%;margin-bottom:6px"></div>
                <div class="skeleton" style="height:10px;width:70%"></div>
              </div>`
            )
            .join('')}
        </div>
      </div>
    </div>`;

  const grid = root.querySelector('#projectGrid');
  const count = root.querySelector('#projectCount');
  const search = root.querySelector('#projectSearch');
  let projects = [];
  let filter = '';

  const openMenu = (anchor, project) => {
    menu(anchor, [
      { label: 'Åpne i editor', icon: 'edit', onClick: () => navigate(`#/editor?project=${encodeURIComponent(project.name)}`) },
      {
        label: 'Terminal her',
        icon: 'terminal',
        onClick: () => navigate(`#/terminal?project=${encodeURIComponent(project.name)}`),
      },
      { separator: true },
      {
        label: 'Slett prosjekt',
        icon: 'trash',
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog({
            title: `Slette «${project.name}»?`,
            message: 'Mappen flyttes til Servidor sin papirkurv. Du kan hente den tilbake derfra.',
            confirm: 'Slett',
            danger: true,
          });
          if (!ok) return;
          try {
            await api.del(`/api/entry?path=${encodeURIComponent(project.path)}`);
            toast('Prosjektet er slettet', 'success');
            await load();
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
    ]);
  };

  function render() {
    if (!grid) return;
    const filtered = projects.filter(
      (project) =>
        !filter ||
        project.name.toLowerCase().includes(filter) ||
        (project.description || '').toLowerCase().includes(filter)
    );
    if (count) {
      count.textContent = `${filtered.length} av ${projects.length}`;
    }
    if (!projects.length) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1">
          <div class="empty-state">
            <div class="empty-glyph">${icon('folder', 30)}</div>
            <h3>Ingen prosjekter ennå</h3>
            <p>Lag et prosjekt med git, README og startfiler – eller en helt tom mappe.</p>
            <button class="btn primary" id="emptyCreate" type="button">${icon('plus', 16)}<span>Nytt prosjekt</span></button>
          </div>
        </div>`;
      const button = grid.querySelector('#emptyCreate');
      if (button) button.addEventListener('click', () => openCreateDialog({ workspace, onCreated: afterCreate }));
      return;
    }
    if (!filtered.length) {
      grid.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-glyph">${icon('search', 28)}</div><h3>Ingen treff</h3><p>Prøv et annet søkeord.</p></div></div>`;
      return;
    }
    grid.innerHTML = filtered.map(projectCard).join('') + newProjectCard();

    grid.querySelectorAll('[data-project]').forEach((card) => {
      const name = card.dataset.project;
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-menu]')) return;
        navigate(`#/editor?project=${encodeURIComponent(name)}`);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`#/editor?project=${encodeURIComponent(name)}`);
        }
      });
    });
    grid.querySelectorAll('[data-menu]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const project = projects.find((item) => item.name === button.dataset.menu);
        if (project) openMenu(button, project);
      });
    });
    const newCard = grid.querySelector('#newProjectCard');
    if (newCard) newCard.addEventListener('click', () => openCreateDialog({ workspace, onCreated: afterCreate }));
  }

  function afterCreate(created) {
    navigate(`#/editor?project=${encodeURIComponent(created.path || created.name)}`);
  }

  async function load() {
    try {
      const data = await api.get('/api/projects');
      if (!root.isConnected) return;
      projects = data.projects || [];
      state.projects = projects;
      render();
    } catch (err) {
      if (!root.isConnected) return;
      grid.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-glyph">${icon('alert', 28)}</div><h3>Kunne ikke hente prosjekter</h3><p>${esc(err.message)}</p></div></div>`;
    }
  }

  const createButton = root.querySelector('#createProject');
  if (createButton) createButton.addEventListener('click', () => openCreateDialog({ workspace, onCreated: afterCreate }));
  const refresh = root.querySelector('#refreshProjects');
  if (refresh) refresh.addEventListener('click', () => load());
  if (search) {
    search.addEventListener('input', () => {
      filter = search.value.trim().toLowerCase();
      render();
    });
  }

  await load();

  if (ctx.query.get('new') === '1' && root.isConnected) {
    openCreateDialog({ workspace, onCreated: afterCreate });
  }

  return undefined;
}

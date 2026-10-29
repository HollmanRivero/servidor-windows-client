import { api } from '../api.js';
import { icon } from '../icons.js';
import {
  confirmDialog,
  esc,
  fileIconName,
  fmtBytes,
  fmtNumber,
  menu,
  openDialog,
  promptDialog,
  toast,
} from '../ui.js';

function extOf(path) {
  const base = String(path).split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function baseName(path) {
  return String(path).split('/').pop() || String(path);
}

function dirName(path) {
  const parts = String(path).split('/');
  parts.pop();
  return parts.join('/');
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJs(code) {
  const re =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|this|super|in|of|delete|void|yield|static|get|set)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b[A-Za-z_$][\w$]*(?=\s*\())/g;
  return code.replace(re, (match, comment, string, keyword, literal, number, fn) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (string) return `<span class="tok-str">${string}</span>`;
    if (keyword) return `<span class="tok-key">${keyword}</span>`;
    if (literal) return `<span class="tok-key">${literal}</span>`;
    if (number) return `<span class="tok-num">${number}</span>`;
    if (fn) return `<span class="tok-fn">${fn}</span>`;
    return match;
  });
}

function highlightPython(code) {
  const re =
    /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|lambda|yield|global|nonlocal|pass|break|continue|async|await|self)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\s*\())/g;
  return code.replace(re, (match, comment, string, keyword, number, fn) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (string) return `<span class="tok-str">${string}</span>`;
    if (keyword) return `<span class="tok-key">${keyword}</span>`;
    if (number) return `<span class="tok-num">${number}</span>`;
    if (fn) return `<span class="tok-fn">${fn}</span>`;
    return match;
  });
}

function highlightCss(code) {
  const re = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([a-zA-Z-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|fr)?\b)/g;
  return code.replace(re, (match, comment, string, prop, hex, number) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (string) return `<span class="tok-str">${string}</span>`;
    if (prop) return `<span class="tok-attr">${prop}</span>`;
    if (hex) return `<span class="tok-num">${hex}</span>`;
    if (number) return `<span class="tok-num">${number}</span>`;
    return match;
  });
}

function highlightHtml(code) {
  const re = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([a-zA-Z0-9-]+)|([a-zA-Z-]+)(?==)|("(?:[^"]*)")/g;
  return code.replace(re, (match, comment, open, tag, attr, string) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (open) return `${open}<span class="tok-tag">${tag}</span>`;
    if (attr) return `<span class="tok-attr">${attr}</span>`;
    if (string) return `<span class="tok-str">${string}</span>`;
    return match;
  });
}

function highlightShell(code) {
  const re = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:[^'])*')|(\$[A-Za-z_]\w*)|\b(if|else|elseif|foreach|for|while|function|param|return|try|catch|finally|throw|switch|case|default|break|continue|exit|Write-Output|Get-ChildItem|Set-Location|New-Item|Remove-Item|Copy-Item|Move-Item|Test-Path)\b/gi;
  return code.replace(re, (match, comment, string, variable, keyword) => {
    if (comment) return `<span class="tok-com">${comment}</span>`;
    if (string) return `<span class="tok-str">${string}</span>`;
    if (variable) return `<span class="tok-num">${variable}</span>`;
    if (keyword) return `<span class="tok-key">${keyword}</span>`;
    return match;
  });
}

function highlight(code, ext) {
  const text = escapeHtml(String(code));
  if (text.length > 250_000) return text;
  try {
    if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'jsonc'].includes(ext)) return highlightJs(text);
    if (['py', 'pyw'].includes(ext)) return highlightPython(text);
    if (['css', 'scss', 'less'].includes(ext)) return highlightCss(text);
    if (['html', 'htm', 'xml', 'svg', 'vue', 'svelte'].includes(ext)) return highlightHtml(text);
    if (['ps1', 'sh', 'bash', 'zsh', 'bat', 'cmd'].includes(ext)) return highlightShell(text);
  } catch {
    return text;
  }
  return text;
}

export async function mount(root, ctx) {
  const { state, navigate } = ctx;
  const project = ctx.query.get('project') || '';
  const initialFile = ctx.query.get('file') || '';

  if (!project) {
    navigate('#/projects');
    return undefined;
  }

  const workspace = (state.status && state.status.workspace) || '';
  const projectName = project;

  root.innerHTML = `
    <div class="page editor-page">
      <div class="editor">
        <aside class="editor-side">
          <div class="side-head">
            <button class="btn small subtle" id="backProjects" type="button" style="align-self:flex-start">${icon('chevron-left', 14)} Prosjekter</button>
            <div class="side-project">${icon('folder', 16)}<span id="sideProjectName">${esc(projectName)}</span></div>
            <div class="side-actions">
              <button class="btn small ghost" id="newFile" type="button" title="Ny fil">${icon('file-plus', 14)} Fil</button>
              <button class="btn small ghost" id="newFolder" type="button" title="Ny mappe">${icon('folder', 14)} Mappe</button>
              <button class="btn small ghost icon-btn" id="refreshTree" type="button" title="Oppdater treet">${icon('refresh', 14)}</button>
            </div>
          </div>
          <div class="tree" id="tree">
            <div style="padding:10px"><div class="skeleton" style="height:22px;margin-bottom:6px"></div><div class="skeleton" style="height:22px;margin-bottom:6px"></div><div class="skeleton" style="height:22px"></div></div>
          </div>
        </aside>
        <section class="editor-main">
          <div class="tabs" id="tabs"></div>
          <div class="code-area" id="codeArea"></div>
          <div class="editor-status" id="editorStatus">
            <span>Klar</span>
          </div>
        </section>
      </div>
    </div>`;

  const treeEl = root.querySelector('#tree');
  const tabsEl = root.querySelector('#tabs');
  const codeArea = root.querySelector('#codeArea');
  const statusEl = root.querySelector('#editorStatus');

  const expanded = new Set([project]);
  const cache = new Map();
  const tabs = [];
  let activePath = null;
  let saveTimer = null;
  let disposed = false;
  let scrollByPath = new Map();

  function dirOf(path) {
    return dirName(path);
  }

  async function getDir(path) {
    if (cache.has(path)) return cache.get(path);
    const data = await api.get(`/api/tree?path=${encodeURIComponent(path)}`);
    cache.set(path, data.entries || []);
    return data.entries || [];
  }

  async function renderTree() {
    try {
      const rows = [];
      const walk = async (dirPath, depth) => {
        const entries = await getDir(dirPath);
        for (const entry of entries) {
          if (disposed) return;
          const isDir = entry.type === 'dir';
          const isOpen = isDir && expanded.has(entry.path);
          const active = entry.path === activePath;
          rows.push(`
            <div class="tree-row ${isDir ? 'dir' : 'file'} ${isOpen ? 'open' : ''} ${active ? 'active' : ''}"
                 data-path="${esc(entry.path)}" data-type="${entry.type}" style="padding-left:${6 + depth * 14}px">
              ${isDir ? `<span class="tree-caret">${icon('chevron-right', 11)}</span>` : '<span class="tree-caret"></span>'}
              ${icon(isDir ? (isOpen ? 'folder-open' : 'folder') : fileIconName(entry.ext, entry.image), 15)}
              <span class="tree-name" title="${esc(entry.name)}">${esc(entry.name)}</span>
              <button class="tree-more" data-more="${esc(entry.path)}" type="button" aria-label="Meny">${icon('more', 13)}</button>
            </div>`);
          if (isDir && isOpen) await walk(entry.path, depth + 1);
        }
      };
      await walk(project, 0);
      if (!rows.length) {
        treeEl.innerHTML = `<div class="empty-state" style="padding:24px 12px"><p style="margin:0">Tomt prosjekt. Lag en fil for å komme i gang.</p></div>`;
      } else {
        treeEl.innerHTML = rows.join('');
      }
      treeEl.querySelectorAll('[data-path]').forEach((row) => {
        const path = row.dataset.path;
        const type = row.dataset.type;
        row.addEventListener('click', async (event) => {
          if (event.target.closest('[data-more]')) return;
          if (type === 'dir') {
            if (expanded.has(path)) expanded.delete(path);
            else expanded.add(path);
            await renderTree();
          } else {
            await openFile(path);
          }
        });
        row.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          const entry = { path, type };
          openEntryMenu(row, entry);
        });
        const more = row.querySelector('[data-more]');
        if (more) {
          more.addEventListener('click', (event) => {
            event.stopPropagation();
            const entry = { path, type };
            openEntryMenu(more, entry);
          });
        }
      });
    } catch (err) {
      treeEl.innerHTML = `<div class="empty-state" style="padding:20px 12px"><p style="margin:0">${esc(err.message)}</p></div>`;
    }
  }

  function openEntryMenu(anchor, entry) {
    const isDir = entry.type === 'dir';
    menu(anchor, [
      ...(isDir
        ? [
            {
              label: 'Ny fil her',
              icon: 'file-plus',
              onClick: () => createEntry('file', entry.path),
            },
            {
              label: 'Ny mappe her',
              icon: 'folder',
              onClick: () => createEntry('dir', entry.path),
            },
            { separator: true },
          ]
        : []),
      {
        label: 'Gi nytt navn',
        icon: 'edit',
        onClick: async () => {
          const name = await promptDialog({
            title: 'Gi nytt navn',
            label: 'Nytt navn',
            value: baseName(entry.path),
            confirm: 'Lagre',
          });
          if (!name || name === baseName(entry.path)) return;
          const target = dirOf(entry.path) ? `${dirOf(entry.path)}/${name}` : name;
          try {
            await api.post('/api/rename', { from: entry.path, to: target });
            cache.clear();
            if (entry.type === 'file') {
              const tab = tabs.find((item) => item.path === entry.path);
              if (tab) {
                tab.path = target;
                tab.name = name;
              }
              if (activePath === entry.path) {
                activePath = target;
                updateHash();
              }
            }
            await renderTree();
            toast('Navnet er endret', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
      {
        label: 'Kopier sti',
        icon: 'copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(entry.path);
            toast('Stien er kopiert', 'success');
          } catch {
            toast('Kunne ikke kopiere', 'error');
          }
        },
      },
      { separator: true },
      {
        label: isDir ? 'Slett mappen' : 'Slett filen',
        icon: 'trash',
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog({
            title: `Slette «${baseName(entry.path)}»?`,
            message: 'Elementet flyttes til Servidor sin papirkurv.',
            confirm: 'Slett',
            danger: true,
          });
          if (!ok) return;
          try {
            await api.del(`/api/entry?path=${encodeURIComponent(entry.path)}`);
            for (let index = tabs.length - 1; index >= 0; index -= 1) {
              if (tabs[index].path === entry.path || tabs[index].path.startsWith(`${entry.path}/`)) {
                tabs.splice(index, 1);
              }
            }
            if (activePath === entry.path || (activePath && activePath.startsWith(`${entry.path}/`))) {
              activePath = tabs.length ? tabs[tabs.length - 1].path : null;
            }
            cache.clear();
            await renderTree();
            renderTabs();
            renderCode();
            toast('Slettet', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
    ]);
  }

  async function createEntry(type, parent = project) {
    const name = await promptDialog({
      title: type === 'dir' ? 'Ny mappe' : 'Ny fil',
      label: 'Navn',
      placeholder: type === 'dir' ? 'f.eks. src' : 'f.eks. app.js',
      confirm: 'Opprett',
    });
    if (!name) return;
    const path = parent ? `${parent}/${name}` : name;
    try {
      await api.post('/api/entry', { path, type });
      cache.delete(parent);
      if (type === 'dir') expanded.add(path);
      await renderTree();
      if (type === 'file') await openFile(path);
      toast(`${type === 'dir' ? 'Mappen' : 'Filen'} er opprettet`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ---------- Faner og editor ---------- */
  function updateHash() {
    const params = new URLSearchParams();
    params.set('project', project);
    if (activePath) params.set('file', activePath);
    history.replaceState(null, '', `#/editor?${params.toString()}`);
  }

  function activeTab() {
    return tabs.find((tab) => tab.path === activePath) || null;
  }

  async function openFile(path) {
    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      activePath = path;
      renderTabs();
      renderCode();
      updateHash();
      return;
    }
    try {
      const data = await api.get(`/api/file?path=${encodeURIComponent(path)}`);
      const tab = {
        path,
        name: data.name || baseName(path),
        language: data.language || 'Tekst',
        ext: extOf(path),
        content: data.content || '',
        original: data.content || '',
        binary: Boolean(data.binary),
        image: Boolean(data.image),
        url: data.url ? api.image(data.url) : '',
        size: data.size || 0,
        mtime: data.mtime || 0,
        scrollTop: 0,
        cursor: 0,
      };
      tabs.push(tab);
      activePath = path;
      // Sørg for at foreldremappene er utvidet.
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i += 1) {
        expanded.add(parts.slice(0, i).join('/'));
      }
      await renderTree();
      renderTabs();
      renderCode();
      updateHash();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function closeTab(path) {
    const index = tabs.findIndex((tab) => tab.path === path);
    if (index < 0) return;
    tabs.splice(index, 1);
    if (activePath === path) {
      const next = tabs[index] || tabs[index - 1] || null;
      activePath = next ? next.path : null;
    }
    renderTabs();
    renderCode();
    updateHash();
  }

  async function tryCloseTab(tab) {
    const dirty = tab.content !== tab.original;
    if (!dirty) {
      closeTab(tab.path);
      return;
    }
    await new Promise((resolve) => {
      openDialog({
        title: 'Ulagrede endringer',
        content: `<p class="dialog-text">«${esc(tab.name)}» har endringer som ikke er lagret.</p>`,
        width: 460,
        footer: [
          { label: 'Avbryt', onClick: () => resolve(false) },
          {
            label: 'Lukk uten å lagre',
            kind: 'danger',
            onClick: () => {
              resolve(true);
              closeTab(tab.path);
            },
          },
          {
            label: 'Lagre og lukk',
            kind: 'primary',
            onClick: async () => {
              await saveTab(tab, { silent: true });
              resolve(true);
              closeTab(tab.path);
            },
          },
        ],
        onClose: () => resolve(false),
      });
    });
  }

  function renderTabs() {
    if (!tabs.length) {
      tabsEl.innerHTML = '';
      return;
    }
    tabsEl.innerHTML = tabs
      .map((tab) => {
        const dirty = tab.content !== tab.original;
        return `
          <div class="tab ${tab.path === activePath ? 'active' : ''} ${dirty ? 'dirty' : ''}" data-tab="${esc(tab.path)}" role="tab" tabindex="0">
            ${icon(tab.image ? 'image' : fileIconName(tab.ext), 14)}
            <span class="tab-name" title="${esc(tab.path)}">${esc(tab.name)}</span>
            <button class="tab-close" data-close="${esc(tab.path)}" type="button" aria-label="Lukk ${esc(tab.name)}">${icon('close', 12)}</button>
          </div>`;
      })
      .join('');
    tabsEl.querySelectorAll('[data-tab]').forEach((node) => {
      const path = node.dataset.tab;
      node.addEventListener('click', async (event) => {
        if (event.target.closest('[data-close]')) return;
        if (activePath === path) return;
        flushSave();
        activePath = path;
        renderTabs();
        renderCode();
        updateHash();
      });
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          activePath = path;
          renderTabs();
          renderCode();
        }
      });
      const close = node.querySelector('[data-close]');
      if (close) {
        close.addEventListener('click', async (event) => {
          event.stopPropagation();
          const tab = tabs.find((item) => item.path === path);
          if (tab) await tryCloseTab(tab);
        });
      }
    });
  }

  function setStatus(tab, extra = '') {
    if (!tab) {
      statusEl.innerHTML = '<span>Ingen fil åpen</span>';
      return;
    }
    const lines = tab.content.split('\n').length;
    const dirty = tab.content !== tab.original;
    statusEl.innerHTML = `
      <span>${esc(tab.language)}</span>
      <span>${fmtNumber(lines)} linjer</span>
      <span>${esc(fmtBytes(tab.size || tab.content.length))}</span>
      <span class="right">
        ${extra ? `<span>${esc(extra)}</span>` : ''}
        <span>UTF-8</span>
        <span>${dirty ? 'Endret' : 'Lagret'}</span>
      </span>`;
  }

  function codeTemplate(tab) {
    return `
      <div class="gutter" id="gutter"></div>
      <div class="code-wrap">
        <pre id="highlight"><code></code></pre>
        <textarea id="editorArea" spellcheck="false" wrap="off" autocomplete="off" autocapitalize="off"></textarea>
      </div>`;
  }

  function renderCode() {
    const tab = activeTab();
    if (!tab) {
      codeArea.innerHTML = `
        <div class="editor-empty">
          <div class="big-glyph">${icon('code', 32)}</div>
          <h3>Velg en fil</h3>
          <p>Åpne en fil i treet til venstre, eller lag en ny. Endringer lagres automatisk, og med Ctrl+S lagrer du med en gang.</p>
          <div class="actions">
            <button class="btn" id="emptyNewFile" type="button">${icon('file-plus', 16)}<span>Ny fil</span></button>
            <button class="btn" id="emptyTerminal" type="button">${icon('terminal', 16)}<span>Terminal her</span></button>
          </div>
        </div>`;
      const newFile = codeArea.querySelector('#emptyNewFile');
      if (newFile) newFile.addEventListener('click', () => createEntry('file', project));
      const terminal = codeArea.querySelector('#emptyTerminal');
      if (terminal) {
        terminal.addEventListener('click', () =>
          navigate(`#/terminal?project=${encodeURIComponent(project)}`)
        );
      }
      setStatus(null);
      return;
    }

    if (tab.image) {
      codeArea.classList.add('image-mode');
      codeArea.innerHTML = `<div class="image-preview"><img src="${esc(tab.url)}" alt="${esc(tab.name)}" /></div>`;
      setStatus(tab);
      return;
    }
    codeArea.classList.remove('image-mode');
    codeArea.innerHTML = codeTemplate(tab);

    const textarea = codeArea.querySelector('#editorArea');
    const pre = codeArea.querySelector('#highlight');
    const codeEl = pre.querySelector('code');
    const gutter = codeArea.querySelector('#gutter');

    textarea.value = tab.content;
    const paint = () => {
      codeEl.innerHTML = highlight(textarea.value, tab.ext);
      const count = textarea.value.split('\n').length;
      gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    };
    paint();

    textarea.scrollTop = tab.scrollTop || 0;
    pre.scrollTop = textarea.scrollTop;
    gutter.scrollTop = textarea.scrollTop;

    const syncScroll = () => {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
      gutter.scrollTop = textarea.scrollTop;
      tab.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener('scroll', syncScroll);

    textarea.addEventListener('input', () => {
      const wasDirty = tab.content !== tab.original;
      tab.content = textarea.value;
      tab.size = new Blob([tab.content]).size;
      paint();
      if (wasDirty !== (tab.content !== tab.original)) renderTabs();
      setStatus(tab, 'Skriver …');
      scheduleSave(tab);
    });

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        if (event.shiftKey) {
          const lineStart = value.lastIndexOf('\n', start - 1) + 1;
          const slice = value.slice(lineStart, lineStart + 2);
          if (slice === '  ') {
            textarea.value = value.slice(0, lineStart) + value.slice(lineStart + 2);
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
          }
        } else {
          textarea.value = `${value.slice(0, start)}  ${value.slice(end)}`;
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
        textarea.dispatchEvent(new Event('input'));
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveTab(tab);
      }
    });

    textarea.addEventListener('keyup', () => updateCursor(tab, textarea));
    textarea.addEventListener('click', () => updateCursor(tab, textarea));

    textarea.addEventListener('blur', () => {
      if (tab.content !== tab.original) flushSave();
    });

    textarea.focus();
    updateCursor(tab, textarea);
    setStatus(tab);
  }

  function updateCursor(tab, textarea) {
    const position = textarea.selectionStart;
    const before = textarea.value.slice(0, position);
    const line = before.split('\n').length;
    const column = position - before.lastIndexOf('\n');
    const right = statusEl.querySelector('.right');
    if (right) {
      const existing = right.querySelector('.cursor-info');
      if (existing) existing.remove();
      const span = document.createElement('span');
      span.className = 'cursor-info';
      span.textContent = `Linje ${line}, kol ${column}`;
      right.prepend(span);
    }
  }

  function scheduleSave(tab) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveTab(tab, { silent: true }), 1400);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    const tab = activeTab();
    if (tab && tab.content !== tab.original && !tab.image) {
      saveTab(tab, { silent: true });
    }
  }

  async function saveTab(tab, { silent = false } = {}) {
    if (!tab || tab.image) return;
    if (tab.content === tab.original) {
      if (!silent) toast('Ingen endringer å lagre', 'info', 1800);
      return;
    }
    try {
      setStatus(tab, 'Lagrer …');
      const result = await api.put(`/api/file?path=${encodeURIComponent(tab.path)}`, { content: tab.content });
      tab.original = tab.content;
      tab.mtime = result.mtime;
      tab.size = result.size;
      renderTabs();
      setStatus(tab);
      if (!silent) toast('Lagret', 'success', 1600);
    } catch (err) {
      toast(err.message, 'error');
      setStatus(tab, 'Lagring feilet');
    }
  }

  /* ---------- Oppstart ---------- */
  const back = root.querySelector('#backProjects');
  if (back) back.addEventListener('click', () => navigate('#/projects'));
  const newFile = root.querySelector('#newFile');
  if (newFile) newFile.addEventListener('click', () => createEntry('file', project));
  const newFolder = root.querySelector('#newFolder');
  if (newFolder) newFolder.addEventListener('click', () => createEntry('dir', project));
  const refresh = root.querySelector('#refreshTree');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      cache.clear();
      await renderTree();
    });
  }

  try {
    await renderTree();
    if (initialFile) {
      const target = initialFile.startsWith(`${project}/`) ? initialFile : `${project}/${initialFile}`;
      await openFile(target);
    }
  } catch (err) {
    toast(err.message, 'error');
  }

  return () => {
    disposed = true;
    clearTimeout(saveTimer);
    // Lagre eventuelle ulagrede faner i bakgrunnen når man forlater editoren.
    for (const tab of tabs) {
      if (!tab.image && tab.content !== tab.original) {
        api.put(`/api/file?path=${encodeURIComponent(tab.path)}`, { content: tab.content }).catch(() => {});
      }
    }
  };
}

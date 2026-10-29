import { icon } from './icons.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${rounded} ${units[index]}`;
}

export function fmtNumber(value) {
  return new Intl.NumberFormat('nb-NO').format(Number(value) || 0);
}

export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - Number(timestamp);
  if (diff < 0) return 'nå';
  const seconds = Math.round(diff / 1000);
  if (seconds < 45) return 'nå nettopp';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'i går';
  if (days < 7) return `${days} dager siden`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} uker siden`;
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Number(timestamp))
  );
}

export function fmtDate(timestamp, options = {}) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(new Date(Number(timestamp)));
}

export function fmtDuration(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  if (value < 1000) return `${value} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} min ${rest} s`;
}

export function fmtUptime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days} d ${hours} t`;
  if (hours > 0) return `${hours} t ${minutes} min`;
  return `${minutes} min`;
}

export function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'God natt';
  if (hour < 10) return 'God morgen';
  if (hour < 17) return 'God dag';
  if (hour < 23) return 'God kveld';
  return 'God natt';
}

export function shortHost(hostname) {
  return String(hostname || 'denne PC-en');
}

export function platformLabel(platform) {
  if (platform === 'win32') return 'Windows 11';
  if (platform === 'darwin') return 'macOS';
  return 'Linux';
}

export function fileIconName(ext, isImage) {
  if (isImage) return 'image';
  const code = [
    'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'cs', 'java', 'kt',
    'c', 'cpp', 'h', 'php', 'rb', 'vue', 'svelte', 'html', 'htm', 'css', 'scss',
    'less', 'json', 'xml', 'yml', 'yaml', 'toml', 'sql', 'sh', 'ps1', 'bat', 'cmd',
  ];
  if (code.includes(ext)) return 'code';
  return 'file';
}

const TOAST_ICON = { success: 'check', error: 'alert', info: 'info', warning: 'alert' };

export function toast(message, kind = 'info', duration = 3800) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast toast-${kind}`;
  node.innerHTML = `<span class="toast-icon">${icon(TOAST_ICON[kind] || 'info', 16)}</span><span class="toast-text"></span>`;
  node.querySelector('.toast-text').textContent = message;
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add('in'));
  setTimeout(() => {
    node.classList.remove('in');
    setTimeout(() => node.remove(), 220);
  }, duration);
}

function trapFocus(container) {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const onKey = (event) => {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(selector)].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

export function openDialog({
  title = '',
  subtitle = '',
  content = null,
  footer = [],
  width = 520,
  persistent = false,
  onClose = null,
} = {}) {
  const root = document.getElementById('overlayRoot');
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.style.width = `min(${width}px, calc(100vw - 48px))`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `
    <div class="dialog-head">
      <div>
        <h2 class="dialog-title">${esc(title)}</h2>
        ${subtitle ? `<p class="dialog-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      <button class="btn icon-btn subtle dialog-close" aria-label="Lukk">${icon('close', 16)}</button>
    </div>
    <div class="dialog-body"></div>
    <div class="dialog-foot"></div>
  `;
  backdrop.appendChild(dialog);
  root.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('in'));

  const body = dialog.querySelector('.dialog-body');
  if (content) {
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);
  }

  const foot = dialog.querySelector('.dialog-foot');
  const close = () => {
    if (backdrop.classList.contains('out')) return;
    backdrop.classList.remove('in');
    backdrop.classList.add('out');
    removeTrap();
    document.removeEventListener('keydown', onKey);
    setTimeout(() => backdrop.remove(), 160);
    if (onClose) onClose();
  };

  const onKey = (event) => {
    if (event.key === 'Escape' && !persistent) close();
  };
  document.addEventListener('keydown', onKey);
  const removeTrap = trapFocus(dialog);

  footer.forEach((action) => {
    if (!action) return;
    const button = document.createElement('button');
    button.className = `btn ${action.kind || ''}`.trim();
    button.innerHTML = `${action.icon ? icon(action.icon, 16) : ''}<span>${esc(action.label)}</span>`;
    if (action.id) button.dataset.action = action.id;
    button.addEventListener('click', async () => {
      if (!action.onClick) return close();
      button.disabled = true;
      try {
        const result = await action.onClick({ close, dialog, body });
        button.disabled = false;
        if (result !== false) close();
      } catch (err) {
        button.disabled = false;
        toast(err.message || 'Noe gikk galt', 'error');
      }
    });
    foot.appendChild(button);
  });

  dialog.querySelector('.dialog-close').addEventListener('click', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop && !persistent) close();
  });

  const focusTarget = dialog.querySelector('input, textarea, select, .btn.primary');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 40);

  return { close, dialog, body, footer: foot };
}

export function confirmDialog({
  title = 'Er du sikker?',
  message = '',
  confirm = 'OK',
  cancel = 'Avbryt',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    openDialog({
      title,
      width: 440,
      content: `<p class="dialog-text">${esc(message)}</p>`,
      footer: [
        {
          label: cancel,
          onClick: () => {
            done(false);
          },
        },
        {
          label: confirm,
          kind: danger ? 'danger-solid' : 'primary',
          onClick: () => {
            done(true);
          },
        },
      ],
      onClose: () => done(false),
    });
  });
}

export function promptDialog({
  title = 'Nytt navn',
  label = 'Navn',
  value = '',
  placeholder = '',
  hint = '',
  confirm = 'Opprett',
  width = 460,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const form = document.createElement('form');
    form.className = 'dialog-form';
    form.innerHTML = `
      <label class="field">
        <span class="field-label">${esc(label)}</span>
        <input class="input" name="value" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" />
      </label>
      ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ''}
    `;
    form.querySelector('input').value = value;
    const dialog = openDialog({
      title,
      content: form,
      width,
      footer: [
        { label: 'Avbryt', onClick: () => done(null) },
        {
          label: confirm,
          kind: 'primary',
          onClick: () => {
            const input = form.querySelector('input');
            const text = input.value.trim();
            if (!text) {
              input.focus();
              input.classList.add('invalid');
              setTimeout(() => input.classList.remove('invalid'), 900);
              return false;
            }
            done(text);
          },
        },
      ],
      onClose: () => done(null),
    });
    const input = form.querySelector('input');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (text) done(text);
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 60);
    return dialog;
  });
}

let activeMenu = null;

export function closeMenu() {
  if (!activeMenu) return;
  const { element, onClick, onKey } = activeMenu;
  document.removeEventListener('mousedown', onClick, true);
  document.removeEventListener('keydown', onKey, true);
  element.remove();
  activeMenu = null;
}

export function menu(anchor, items) {
  closeMenu();
  const element = document.createElement('div');
  element.className = 'menu';
  element.setAttribute('role', 'menu');
  items.forEach((item) => {
    if (!item) return;
    if (item.separator) {
      element.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>');
      return;
    }
    const button = document.createElement('button');
    button.className = `menu-item ${item.danger ? 'danger' : ''}`.trim();
    button.innerHTML = `${item.icon ? icon(item.icon, 16) : '<span class="menu-ico"></span>'}<span>${esc(item.label)}</span>`;
    button.addEventListener('click', () => {
      closeMenu();
      item.onClick && item.onClick();
    });
    element.appendChild(button);
  });
  document.body.appendChild(element);

  const rect = anchor.getBoundingClientRect();
  const menuRect = element.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + menuRect.width > window.innerWidth - 12) left = window.innerWidth - menuRect.width - 12;
  if (top + menuRect.height > window.innerHeight - 12) top = rect.top - menuRect.height - 6;
  element.style.left = `${Math.max(8, left)}px`;
  element.style.top = `${Math.max(8, top)}px`;
  requestAnimationFrame(() => element.classList.add('in'));

  const onClick = (event) => {
    if (!element.contains(event.target)) {
      closeMenu();
      document.removeEventListener('mousedown', onClick, true);
    }
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      document.removeEventListener('keydown', onKey, true);
    }
  };
  document.addEventListener('mousedown', onClick, true);
  document.addEventListener('keydown', onKey, true);
  activeMenu = { element, onClick, onKey };
  return element;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = String(text);
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function inlineMarkdown(source) {
  const codes = [];
  let text = String(source).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0001${codes.length - 1}\u0001`;
  });
  text = esc(text);
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  text = text.replace(/\u0001(\d+)\u0001/g, (_, index) => `<code>${esc(codes[Number(index)])}</code>`);
  return text;
}

/**
 * Liten, trygg markdown-renderer: kodeblokker, overskrifter, lister,
 * sitater, lenker, fet/kursiv og inline-kode. Alt escapes først.
 */
export function markdown(source) {
  const blocks = [];
  let text = String(source || '').replace(/\r\n/g, '\n');
  text = text.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push({ lang: String(lang || '').toLowerCase(), code: code.replace(/\n$/, '') });
    return `\u0000CODE${blocks.length - 1}\u0000`;
  });

  const lines = text.split('\n');
  const out = [];
  let paragraph = [];
  let list = null;
  let quote = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote) return;
    out.push(`<blockquote>${quote.map(inlineMarkdown).join('<br>')}</blockquote>`);
    quote = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const codeMatch = line.match(/^\u0000CODE(\d+)\u0000$/);
    if (codeMatch) {
      flushAll();
      const block = blocks[Number(codeMatch[1])];
      const lang = block.lang || 'kode';
      out.push(
        `<div class="code-block"><div class="code-head"><span class="code-lang">${esc(lang)}</span><button class="code-copy" type="button">Kopier</button></div><pre><code>${esc(block.code)}</code></pre></div>`
      );
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(6, heading[1].length + 1);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
      flushAll();
      out.push('<hr>');
      continue;
    }
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote = quote || [];
      quote.push(quoteMatch[1]);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }
    if (list) flushList();
    if (quote) {
      quote.push(line);
      continue;
    }
    paragraph.push(line);
  }
  flushAll();
  return out.join('\n');
}

export function wireCopyButtons(root) {
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('.code-copy');
    if (!button) return;
    const block = button.closest('.code-block');
    const code = block ? block.querySelector('code') : null;
    if (!code) return;
    const ok = await copyText(code.textContent || '');
    if (ok) {
      button.textContent = 'Kopiert';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = 'Kopier';
        button.classList.remove('copied');
      }, 1600);
    }
  });
}

export function sparkline(values, width = 132, height = 36, color = 'var(--accent)') {
  const list = (values || []).filter((value) => Number.isFinite(Number(value))).map(Number);
  if (list.length < 2) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><line x1="0" y1="${height - 2}" x2="${width}" y2="${height - 2}" stroke="var(--stroke-2)" stroke-width="1"/></svg>`;
  }
  const max = Math.max(...list, 1);
  const min = Math.min(...list, 0);
  const span = Math.max(1, max - min);
  const step = width / (list.length - 1);
  const points = list.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${points.join(' ')} ${width},${height}`;
  return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="${area}" fill="${color}" opacity=".12"></polygon>
    <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></polyline>
  </svg>`;
}

export function demoBadge() {
  return `<span class="badge">Demo</span>`;
}

export function emptyState({ iconName = 'folder', title = '', text = '', action = null }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  wrapper.innerHTML = `
    <div class="empty-glyph">${icon(iconName, 30)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  `;
  if (action) {
    const button = document.createElement('button');
    button.className = `btn ${action.kind || 'primary'}`;
    button.innerHTML = `${action.icon ? icon(action.icon, 16) : ''}<span>${esc(action.label)}</span>`;
    button.addEventListener('click', action.onClick);
    wrapper.appendChild(button);
  }
  return wrapper;
}

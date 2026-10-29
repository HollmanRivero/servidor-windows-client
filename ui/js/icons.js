/**
 * Fluent-inspirerte linjeikoner (24×24 rutenett, 1.6 px strek).
 */

const ICONS = {
  home: '<path d="M3.5 10.7 12 3.6l8.5 7.1"/><path d="M5.6 9.2V20h12.8V9.2"/><path d="M9.6 20v-5.4h4.8V20"/>',
  folder:
    '<path d="M3.2 6.6A1.6 1.6 0 0 1 4.8 5h4l2 2.2h7.4a1.6 1.6 0 0 1 1.6 1.6v8.7a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z"/>',
  'folder-open':
    '<path d="M3.2 8V6.6A1.6 1.6 0 0 1 4.8 5h4l2 2.2h6.6A1.6 1.6 0 0 1 19 8.8V10"/><path d="M3.4 10h17.2l-1.7 8.2a1.6 1.6 0 0 1-1.6 1.3H5.6a1.6 1.6 0 0 1-1.6-1.3z"/>',
  chat: '<path d="M20.2 11.6a7.6 7.6 0 0 1-11.1 6.7L4 19.7l1.5-4.4a7.6 7.6 0 1 1 14.7-3.7z"/>',
  terminal: '<rect x="3.2" y="4.8" width="17.6" height="14.4" rx="1.6"/><path d="M7 9.4l3 2.8-3 2.8M12.6 15h4.4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  maximize: '<rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.4"/>',
  restore: '<rect x="8.4" y="8.4" width="10.4" height="10.4" rx="1.2"/><path d="M5.2 15.6V6.6a1.4 1.4 0 0 1 1.4-1.4h9"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.2v5h-5"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="M20 20l-4.2-4.2"/>',
  send: '<path d="M4.2 12 20.3 4l-6.1 16.2-3.1-6.4z"/><path d="M11.1 13.8 20.3 4"/>',
  copy: '<rect x="8.6" y="8.6" width="11" height="11" rx="1.4"/><path d="M15.4 5.4H5.8A1.4 1.4 0 0 0 4.4 6.8v9.6"/>',
  check: '<path d="M5 12.6l4.3 4.3L19 7.3"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  'chevron-right': '<path d="M9.5 5.8 15.7 12l-6.2 6.2"/>',
  'chevron-down': '<path d="M5.8 9.5 12 15.7l6.2-6.2"/>',
  'chevron-left': '<path d="M14.5 5.8 8.3 12l6.2 6.2"/>',
  'chevron-up': '<path d="M5.8 14.5 12 8.3l6.2 6.2"/>',
  file: '<path d="M6.6 3.4h7.2l4.2 4.2v13H6.6z"/><path d="M13.8 3.4v4.2h4.2"/>',
  'file-plus': '<path d="M6.6 3.4h7.2l4.2 4.2v13H6.6z"/><path d="M13.8 3.4v4.2h4.2M12 12v6M9 15h6"/>',
  code: '<path d="M8.2 8.2 4.4 12l3.8 3.8M15.8 8.2 19.6 12l-3.8 3.8M13.4 5.2l-2.8 13.6"/>',
  image: '<rect x="3.4" y="4.8" width="17.2" height="14.4" rx="1.6"/><path d="M3.8 16.4l4.8-4.8 4 4 2.8-2.8 4.8 4.8"/><circle cx="9" cy="9.2" r="1.2"/>',
  trash: '<path d="M4.8 7h14.4M9.2 7V4.8h5.6V7M6.6 7l1 13.2h8.8l1-13.2M10 10.8v5.6M14 10.8v5.6"/>',
  edit: '<path d="M4 20l4.2-1L19 8.2l-3.2-3.2L5 15.8z"/><path d="M14.4 6.4l3.2 3.2"/>',
  more: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
  external: '<path d="M14 4.2h5.8V10"/><path d="M19.8 4.2 10.6 13.4"/><path d="M18.6 14.4v4.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4V7a1.4 1.4 0 0 1 1.4-1.4h4.2"/>',
  cpu: '<rect x="7.8" y="7.8" width="8.4" height="8.4" rx="1.2"/><path d="M9.4 2.8v3M14.6 2.8v3M9.4 18.2v3M14.6 18.2v3M2.8 9.4h3M2.8 14.6h3M18.2 9.4h3M18.2 14.6h3"/>',
  memory: '<rect x="2.8" y="7.4" width="18.4" height="9.2" rx="1.4"/><path d="M7 10v4M11 10v4M15 10v4"/>',
  disk: '<rect x="3.4" y="5.2" width="17.2" height="13.6" rx="1.6"/><path d="M6.4 8.6h.1M6.4 11.4h.1M9.4 8.6h7.2M9.4 11.4h7.2"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
  sparkles:
    '<path d="M12 3.2l1.7 4.9 4.9 1.7-4.9 1.7L12 16.4l-1.7-4.9L5.4 9.8l4.9-1.7z"/><path d="M18.4 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  play: '<path d="M7.4 4.6 19 12 7.4 19.4z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.4"/>',
  alert: '<path d="M12 3.8 21 20H3z"/><path d="M12 9.4v4.4M12 16.9h.01"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.8h.01"/>',
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  moon: '<path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z"/>',
  monitor: '<rect x="2.8" y="4.4" width="18.4" height="11.6" rx="1.4"/><path d="M8.6 20h6.8M12 16v4"/>',
  git: '<circle cx="6" cy="5.4" r="2"/><circle cx="18" cy="18.6" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7.4v8.2a4 4 0 0 0 4 4h6"/><path d="M16 7v5a4 4 0 0 1-4 4H9.4"/>',
  server: '<rect x="3.4" y="4.2" width="17.2" height="6.2" rx="1.4"/><rect x="3.4" y="13.6" width="17.2" height="6.2" rx="1.4"/><path d="M6.8 7.3h.01M6.8 16.7h.01"/><path d="M10.4 7.3h6.4M10.4 16.7h6.4"/>',
  link: '<path d="M9.6 14.4l4.8-4.8"/><path d="M10.6 6.4l1.8-1.8a3.7 3.7 0 0 1 5.2 5.2l-1.8 1.8"/><path d="M13.4 17.6l-1.8 1.8a3.7 3.7 0 0 1-5.2-5.2l1.8-1.8"/>',
  eraser: '<path d="M4.4 16.2 15.8 4.8l4 4L8.4 20.2H4.4z"/><path d="M12.4 20.2h7.2"/>',
  keyboard: '<rect x="2.8" y="6.2" width="18.4" height="11.6" rx="1.6"/><path d="M6.4 9.6h.01M9.6 9.6h.01M12.8 9.6h.01M16 9.6h.01M7 13.6h10"/>',
  pin: '<path d="M9 3.8h6M12 3.8v6.4M12 10.2c-3 0-5.4 2.2-5.4 5h10.8c0-2.8-2.4-5-5.4-5zM12 15.2V21"/>',
  layers: '<path d="M12 3.4 21 8l-9 4.6L3 8z"/><path d="M3 12.4l9 4.6 9-4.6"/><path d="M3 16.8l9 4.6 9-4.6"/>',
  package: '<path d="M12 3 21 7.4v9.2L12 21 3 16.6V7.4z"/><path d="M3.4 7.6 12 12l8.6-4.4M12 12v9"/>',
  wifi: '<path d="M3.4 9.2a13 13 0 0 1 17.2 0M6.6 12.6a8.4 8.4 0 0 1 10.8 0M9.8 16a4 4 0 0 1 4.4 0M12 19.2h.01"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.2 3.6 8.6S14.4 18.2 12 20.6C9.6 18.2 8.4 15.4 8.4 12S9.6 5.8 12 3.4z"/>',
  history: '<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.6 4.2v4.6h4.6"/><path d="M12 7.6V12l3 1.8"/>',
  panel: '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="1.6"/><path d="M9.4 4.6v14.8"/>',
  shield: '<path d="M12 3.4 20 6v5.4c0 4.6-3.2 7.8-8 9.2-4.8-1.4-8-4.6-8-9.2V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
  sunDim: '<circle cx="12" cy="12" r="3.4"/><path d="M12 4.6v1.6M12 17.8v1.6M4.6 12h1.6M17.8 12h1.6M6.7 6.7l1.1 1.1M16.2 16.2l1.1 1.1M17.3 6.7l-1.1 1.1M7.8 16.2l-1.1 1.1"/>',
  dots: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
};

export function icon(name, size = 16, className = '') {
  const body = ICONS[name] || '';
  return `<svg class="ico ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function logo(size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#lg)"/>
    <rect x="8" y="9.5" width="16" height="5" rx="1.6" fill="#fff" opacity=".92"/>
    <rect x="8" y="17.5" width="16" height="5" rx="1.6" fill="#fff" opacity=".6"/>
    <circle cx="11" cy="12" r="1" fill="#005FB8"/>
    <circle cx="11" cy="20" r="1" fill="#005FB8"/>
    <defs>
      <linearGradient id="lg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4CC2FF"/><stop offset="1" stop-color="#0A64C8"/>
      </linearGradient>
    </defs>
  </svg>`;
}

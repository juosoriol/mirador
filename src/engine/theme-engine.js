export const THEME_KEY = 'mirador_theme';
export const DEFAULT_THEME = 'dark';

export const THEMES = [
  { id: 'dark', label: 'Oscuro', sub: 'Slate azul oscuro', p: ['#1e293b', '#334155', '#3b82f6', '#e2e8f0'] },
  { id: 'dashboard', label: 'Dashboard', sub: 'Verde esmeralda oscuro', p: ['#11152a', '#1a1f38', '#10b981', '#e2e8f0'] },
  { id: 'dashboard-purple', label: 'Dashboard violeta', sub: 'Púrpura profundo', p: ['#130f28', '#1c1640', '#8b5cf6', '#e2e8f0'] },
  { id: 'azul', label: 'Institucional azul', sub: 'Azul gubernamental', p: ['#1d3461', '#e8f0fb', '#4a90d9', '#1d3461'] },
  { id: 'grafito', label: 'Slate grafito', sub: 'Gris carbón claro', p: ['#2c3444', '#eef0f3', '#3d8c5a', '#1e2535'] },
  { id: 'minimal', label: 'Blanco minimal', sub: 'Violeta sobre blanco', p: ['#ffffff', '#fafafa', '#6c63ff', '#1a1a2e'] },
  { id: 'verde', label: 'Verde esmeralda', sub: 'Verde institucional', p: ['#064e3b', '#ecfdf5', '#10b981', '#064e3b'] },
  { id: 'amber', label: 'Cálido arena ámbar', sub: 'Ámbar cálido', p: ['#78350f', '#fef3c7', '#f59e0b', '#78350f'] },
];

/** @param {Storage} [storage] */
export function readTheme(storage = globalThis.localStorage) {
  if (!storage) return DEFAULT_THEME;
  return storage.getItem(THEME_KEY) || DEFAULT_THEME;
}

/** @param {string} id @param {Storage} [storage] */
export function writeTheme(id, storage = globalThis.localStorage) {
  if (storage) storage.setItem(THEME_KEY, id);
}

/** @param {string} id */
export function findTheme(id) {
  return THEMES.find((t) => t.id === id) || null;
}

/** A "top" color is light if white or starts with #e/#f hex ranges. */
export function isLightThemeTop(top) {
  return top === '#ffffff' || top.startsWith('#e') || top.startsWith('#f');
}

/**
 * Build the theme picker grid HTML.
 * @param {string} currentTheme
 */
export function buildThemeGridHtml(currentTheme) {
  return THEMES.map((t) => {
    const active = t.id === currentTheme;
    const [top, body, acc, txt] = t.p;
    const lightTop = isLightThemeTop(top);
    return `<div onclick="applyTheme('${t.id}')" style="border-radius:8px;border:${active ? '2px solid ' + acc : '1px solid var(--border)'};overflow:hidden;cursor:pointer;${active ? 'box-shadow:0 0 0 3px ' + acc + '33' : ''}">
      <div style="background:${top};padding:7px 10px;display:flex;align-items:center;gap:6px">
        <div style="width:12px;height:12px;border-radius:3px;background:${acc}"></div>
        <span style="font-size:10px;font-weight:500;color:${lightTop ? txt : '#fff'};opacity:.9">Mirador</span>
        ${active ? `<span style="margin-left:auto;font-size:9px;background:${acc};color:#fff;padding:1px 5px;border-radius:8px">activo</span>` : ''}
      </div>
      <div style="background:${body};padding:7px 10px;border-top:1px solid rgba(0,0,0,.08)">
        <div style="display:flex;gap:4px;margin-bottom:5px">
          <div style="padding:2px 7px;border-radius:8px;background:${acc};color:#fff;font-size:9px">${t.label.split(' ')[0]}</div>
          <div style="padding:2px 7px;border-radius:8px;background:rgba(0,0,0,.06);color:${txt};font-size:9px;border:1px solid rgba(0,0,0,.1)">Filtro</div>
        </div>
        <div style="height:2px;border-radius:1px;background:rgba(0,0,0,.07);margin-bottom:3px"></div>
        <div style="height:2px;border-radius:1px;background:rgba(0,0,0,.04)"></div>
      </div>
      <div style="padding:7px 10px;background:${body};border-top:1px solid rgba(0,0,0,.06)">
        <div style="font-size:12px;font-weight:500;color:${txt}">${t.label}</div>
        <div style="font-size:10px;color:${txt};opacity:.55;margin-top:2px">${t.sub}</div>
      </div>
    </div>`;
  }).join('');
}

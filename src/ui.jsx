import { useEffect, useState, useSyncExternalStore } from 'react';

// ---------- Маршруты через # (работает на GitHub Pages без настроек сервера) ----------
function getHash() {
  return window.location.hash.replace(/^#/, '') || '/';
}
export function useRoute() {
  const h = useSyncExternalStore(
    (l) => (window.addEventListener('hashchange', l), () => window.removeEventListener('hashchange', l)),
    getHash
  );
  const [path, query = ''] = h.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}
export function go(path) {
  window.location.hash = path;
}

// ---------- Иконки ----------
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16.5 14.5h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7',
  group: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M16 3.5a3 3 0 0 1 0 6M21 20v-1a4 4 0 0 0-3-3.85',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.26 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 21 10h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.6 1z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  cloud: 'M7 18a5 5 0 0 1-.5-9.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
};
export function Icon({ name, size = 22, stroke = 2, className = '' }) {
  return (
    <svg className={'icon ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || ''} />
    </svg>
  );
}

// ---------- Окно (на телефоне выезжает снизу) ----------
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Badge({ color = 'gray', children }) {
  return <span className={'badge badge-' + color}>{children}</span>;
}

export function Empty({ icon = 'star', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Поиск' }) {
  return (
    <div className="search">
      <Icon name="search" size={18} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Очистить">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];
export const PALETTE = COLORS;
export function colorFor(id = '') {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
export function Avatar({ name = '?', color, id, size = 40 }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span className="avatar" style={{ background: color || colorFor(id || name), width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

// ---------- Всплывающие уведомления ----------
let toastSet = null;
export function toast(text) {
  toastSet && toastSet(text);
}
export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    toastSet = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => (toastSet = null);
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function PageHead({ title, sub, children, back }) {
  return (
    <div className="page-head">
      <div className="page-title">
        {back && (
          <button className="icon-btn back" onClick={() => (window.history.length > 1 ? window.history.back() : go(back))} aria-label="Назад">
            <Icon name="left" />
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {sub && <div className="page-sub">{sub}</div>}
        </div>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Скопировано');
}

// ---------- Открытие окон из любого места: openModal(<LessonEditor lesson={...} />) ----------
import { cloneElement } from 'react';
let modalSet = null;
export function openModal(el) {
  modalSet && modalSet(el);
}
export function ModalHost() {
  const [el, setEl] = useState(null);
  useEffect(() => {
    modalSet = setEl;
    const close = () => setEl(null);
    window.addEventListener('hashchange', close);
    return () => {
      modalSet = null;
      window.removeEventListener('hashchange', close);
    };
  }, []);
  return el ? cloneElement(el, { onClose: () => setEl(null) }) : null;
}

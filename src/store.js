// Хранилище данных: всё живёт в localStorage этого браузера.
// Каждая запись имеет id и updatedAt; удаление = пометка deleted (нужно для синхронизации).
import { useSyncExternalStore } from 'react';

const KEY = 'tcrm-data-v1';
export const COLLECTIONS = ['students', 'groups', 'schedules', 'lessons', 'payments'];

export const DEFAULT_TEMPLATES = [
  {
    id: 'lesson',
    title: 'Напоминание о занятии',
    text: 'Здравствуйте, {родитель}! Напоминаю о занятии: {ученик}, {дата} в {время}. До встречи! {преподаватель}',
  },
  {
    id: 'debt',
    title: 'Напоминание об оплате',
    text: 'Здравствуйте, {родитель}! Напоминаю об оплате занятий ({ученик}): к оплате {сумма}. Спасибо! {преподаватель}',
  },
  {
    id: 'homework',
    title: 'Домашнее задание',
    text: 'Здравствуйте! Домашнее задание ({ученик}): {дз}',
  },
  {
    id: 'cancel',
    title: 'Перенос занятия',
    text: 'Здравствуйте, {родитель}! К сожалению, занятие {дата} в {время} ({ученик}) не состоится. Давайте подберём другое время.',
  },
];

export const DEFAULT_SETTINGS = {
  teacherName: '',
  currency: '₽',
  defaultPrice: 1000,
  defaultDuration: 60,
  chargeAbsent: false,
  theme: 'auto',
  templates: DEFAULT_TEMPLATES,
  updatedAt: 0,
};

function emptyState() {
  return { students: [], groups: [], schedules: [], lessons: [], payments: [], settings: { ...DEFAULT_SETTINGS } };
}

function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  for (const c of COLLECTIONS) s[c] = Array.isArray(raw[c]) ? raw[c].filter((r) => r && r.id) : [];
  s.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  if (!Array.isArray(s.settings.templates) || !s.settings.templates.length) s.settings.templates = DEFAULT_TEMPLATES;
  return s;
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return emptyState();
  }
}

let state = load();
const listeners = new Set();
let saveTimer = null;
const changeHooks = new Set();

function emit(fromSync = false) {
  // Новая ссылка на объект — React перерисует компоненты
  state = { ...state };
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert('Не удалось сохранить данные: ' + e.message);
    }
  }, 150);
  if (!fromSync) changeHooks.forEach((h) => h());
}

export function onLocalChange(fn) {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export function getState() {
  return state;
}

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Только «живые» записи
export function alive(list) {
  return list.filter((r) => !r.deleted);
}

export function upsert(coll, rec) {
  const now = Date.now();
  const list = state[coll];
  const i = list.findIndex((r) => r.id === rec.id);
  let saved;
  if (i >= 0) {
    saved = { ...list[i], ...rec, updatedAt: now };
    state[coll] = list.map((r, j) => (j === i ? saved : r));
  } else {
    saved = { id: uid(), createdAt: now, ...rec, updatedAt: now };
    state[coll] = [...list, saved];
  }
  emit();
  return saved;
}

export function remove(coll, id) {
  state[coll] = state[coll].map((r) => (r.id === id ? { id: r.id, deleted: true, updatedAt: Date.now() } : r));
  emit();
}

export function setSettings(patch) {
  state.settings = { ...state.settings, ...patch, updatedAt: Date.now() };
  emit();
}

export function replaceAll(raw) {
  const next = normalize(raw);
  const now = Date.now();
  // Записи, которых нет в новой копии, помечаем удалёнными — чтобы синхронизация их не вернула
  for (const c of COLLECTIONS) {
    const ids = new Set(next[c].map((r) => r.id));
    for (const r of state[c]) if (!ids.has(r.id)) next[c].push({ id: r.id, deleted: true, updatedAt: now });
    next[c] = next[c].map((r) => ({ ...r, updatedAt: now }));
  }
  next.settings.updatedAt = now;
  state = next;
  emit();
}

export function mergeIn(raw, fromSync = false) {
  state = mergeStates(state, normalize(raw));
  emit(fromSync);
}

// Слияние двух копий: по каждой записи берём более свежую
export function mergeStates(a, b) {
  const out = emptyState();
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const r of a[c]) map.set(r.id, r);
    for (const r of b[c]) {
      const cur = map.get(r.id);
      if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) map.set(r.id, r);
    }
    out[c] = [...map.values()];
  }
  out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
  return out;
}

export function exportData() {
  const s = getState();
  const out = { app: 'teacher-crm', version: 1, exportedAt: new Date().toISOString(), settings: s.settings };
  for (const c of COLLECTIONS) out[c] = alive(s[c]);
  return out;
}

export function clearAll() {
  replaceAll(emptyState());
}

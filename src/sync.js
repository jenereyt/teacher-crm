// Необязательная синхронизация между устройствами через закрытый репозиторий GitHub.
// Данные лежат одним файлом data.json; копии сливаются по дате изменения каждой записи.
import { useSyncExternalStore } from 'react';
import { COLLECTIONS, getState, mergeIn, onLocalChange } from './store.js';
import { checkAccess, explain, syncFile } from './github.js';

const CFG_KEY = 'tcrm-github-sync';
const FILE = 'data.json';
export const DEFAULT_REPO = 'teacher-crm-data';

let cfg = loadConfig();
let status = cfg
  ? { state: 'on', message: 'Подключено', repo: cfg.repo, lastSync: 0 }
  : { state: 'off', message: 'Синхронизация выключена', repo: '', lastSync: 0 };
const listeners = new Set();
let pushTimer = null;
let busy = false;
let again = false;

function loadConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY));
    return c?.token && c?.repo ? c : null;
  } catch {
    return null;
  }
}

function setStatus(patch) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status
  );
}

// Отпечаток данных: какие записи и в какой версии есть
function fingerprint(s) {
  const parts = [String(s.settings?.updatedAt || 0)];
  for (const c of COLLECTIONS) parts.push((s[c] || []).map((r) => r.id + ':' + (r.updatedAt || 0)).sort().join(','));
  return parts.join('|');
}

export async function connect(token, repo) {
  const info = await checkAccess(token.trim(), (repo || DEFAULT_REPO).trim()).catch((e) => {
    throw new Error(explain(e));
  });
  if (!info.isPrivate) throw new Error('Этот репозиторий публичный — данные учеников увидят все. Сделайте его закрытым (Settings → Danger Zone → Change visibility) или выберите другой.');
  cfg = { token: token.trim(), repo: info.repo };
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  setStatus({ state: 'on', repo: info.repo, message: 'Подключено' });
  await syncNow();
}

export function disconnect() {
  localStorage.removeItem(CFG_KEY);
  cfg = null;
  clearTimeout(pushTimer);
  setStatus({ state: 'off', repo: '', message: 'Синхронизация выключена. Данные остались в этом браузере.' });
}

export async function syncNow() {
  if (!cfg) return;
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  setStatus({ state: 'syncing', message: 'Синхронизация…' });
  try {
    await syncFile(
      cfg.token,
      cfg.repo,
      FILE,
      (remote) => {
        if (remote) mergeIn(remote, true);
        return getState();
      },
      (remote, merged) => fingerprint(remote) === fingerprint(merged)
    );
    setStatus({ state: 'on', message: 'Синхронизировано', lastSync: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', message: explain(e) });
  } finally {
    busy = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

export function initSync() {
  if (cfg) syncNow();
}

// Отправляем изменения через 3 секунды после последней правки
onLocalChange(() => {
  if (!cfg) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 3000);
});

if (typeof document !== 'undefined') {
  // Подтягиваем изменения с другого устройства, когда вкладка снова открыта
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
    // Уходя со страницы, сразу отправляем несохранённое
    if (document.visibilityState === 'hidden' && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      syncNow();
    }
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000);
}

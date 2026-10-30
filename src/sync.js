// Необязательная облачная синхронизация через бесплатный Supabase.
// Все данные хранятся одной JSON-записью на пользователя; копии сливаются по дате изменения записей.
import { useSyncExternalStore } from 'react';
import { getState, mergeIn, onLocalChange } from './store.js';

const CFG_KEY = 'tcrm-sync-config';

export const SETUP_SQL = `create table if not exists public.crm_data (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.crm_data enable row level security;
create policy "own data" on public.crm_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

let client = null;
let status = { state: 'off', message: 'Синхронизация выключена', email: '', lastSync: 0 };
const listeners = new Set();
let pushTimer = null;
let busy = false;

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

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null;
  } catch {
    return null;
  }
}

async function makeClient(cfg) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(cfg.url.trim(), cfg.key.trim(), { auth: { persistSession: true, storageKey: 'tcrm-sb-auth' } });
}

export async function initSync() {
  const cfg = getConfig();
  if (!cfg?.url || !cfg?.key) return;
  try {
    client = await makeClient(cfg);
    const { data } = await client.auth.getSession();
    if (data.session) {
      setStatus({ state: 'on', email: data.session.user.email, message: 'Подключено' });
      await syncNow();
    } else {
      setStatus({ state: 'login', message: 'Войдите, чтобы включить синхронизацию' });
    }
  } catch (e) {
    setStatus({ state: 'error', message: 'Ошибка подключения: ' + e.message });
  }
}

export async function saveConfig(url, key) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url, key }));
  client = await makeClient({ url, key });
  setStatus({ state: 'login', message: 'Ключи сохранены. Теперь войдите или зарегистрируйтесь.' });
}

export async function signIn(email, password, register = false) {
  if (!client) throw new Error('Сначала сохраните адрес и ключ проекта');
  const fn = register ? client.auth.signUp : client.auth.signInWithPassword;
  const { data, error } = await fn.call(client.auth, { email, password });
  if (error) throw new Error(error.message);
  if (!data.session) {
    setStatus({ state: 'login', message: 'Проверьте почту и подтвердите адрес, затем войдите.' });
    return;
  }
  setStatus({ state: 'on', email: data.session.user.email, message: 'Подключено' });
  await syncNow();
}

export async function signOut() {
  if (client) await client.auth.signOut();
  setStatus({ state: 'login', email: '', message: 'Вы вышли. Данные остались в этом браузере.' });
}

export function disableSync() {
  localStorage.removeItem(CFG_KEY);
  client = null;
  setStatus({ state: 'off', email: '', message: 'Синхронизация выключена' });
}

export async function syncNow() {
  if (!client || busy || !['on', 'error'].includes(status.state)) return;
  busy = true;
  setStatus({ state: 'syncing', message: 'Синхронизация…' });
  try {
    const { data: u } = await client.auth.getUser();
    if (!u?.user) {
      setStatus({ state: 'login', message: 'Сессия истекла, войдите снова' });
      return;
    }
    const { data: rows, error } = await client.from('crm_data').select('data').eq('user_id', u.user.id).maybeSingle();
    if (error) throw error;
    if (rows?.data) mergeIn(rows.data, true);
    const { error: e2 } = await client
      .from('crm_data')
      .upsert({ user_id: u.user.id, data: getState(), updated_at: new Date().toISOString() });
    if (e2) throw e2;
    setStatus({ state: 'on', message: 'Синхронизировано', lastSync: Date.now() });
  } catch (e) {
    const msg = e.message || String(e);
    setStatus({
      state: 'error',
      message: /crm_data/.test(msg) ? 'Таблица не найдена — выполните SQL из инструкции' : 'Ошибка: ' + msg,
    });
  } finally {
    busy = false;
  }
}

// Автоматически отправляем изменения через 3 секунды после правки
onLocalChange(() => {
  if (!client || (status.state !== 'on' && status.state !== 'error')) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 3000);
});

// Подтягиваем изменения с другого устройства при возвращении на вкладку
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000);
}

// Хранение файла с данными в закрытом репозитории GitHub через REST API.
const API = 'https://api.github.com';

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(token, path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + token.trim(),
      Accept: opts.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (res.ok) return opts.raw ? res.text() : res.json();
  let msg = '';
  try {
    msg = (await res.json()).message || '';
  } catch {}
  throw new GitHubError(msg || 'HTTP ' + res.status, res.status);
}

// Понятные сообщения об ошибках
export function explain(e) {
  if (e instanceof GitHubError) {
    if (e.status === 401) return 'Ключ не подходит или срок его действия истёк. Создайте новый ключ.';
    if (e.status === 403) return 'У ключа нет права записи. Проверьте, что в Permissions → Contents выбрано «Read and write».';
    if (e.status === 404) return 'Репозиторий не найден. Проверьте имя репозитория и что ключ выдан именно для него.';
    return 'GitHub: ' + e.message;
  }
  if (e instanceof TypeError) return 'Нет связи с GitHub. Проверьте интернет.';
  return e.message || String(e);
}

// Проверка ключа: кто владелец и закрыт ли репозиторий
export async function checkAccess(token, repo) {
  const user = await call(token, '/user');
  const full = repo.includes('/') ? repo : `${user.login}/${repo}`;
  const info = await call(token, `/repos/${full}`);
  if (info.permissions && !info.permissions.push) throw new GitHubError('no push', 403);
  return { login: user.login, repo: full, isPrivate: info.private };
}

// Прочитать файл: { data, sha } или { data: null, sha: null }, если файла ещё нет
export async function readFile(token, repo, path) {
  try {
    const meta = await call(token, `/repos/${repo}/contents/${encodeURIComponent(path)}`);
    let text = meta.content ? fromBase64(meta.content) : '';
    if (!text && meta.size > 0) {
      // Файлы больше 1 МБ API отдаёт только «сырыми»
      text = await call(token, `/repos/${repo}/contents/${encodeURIComponent(path)}`, { accept: 'application/vnd.github.raw', raw: true });
    }
    return { data: text ? JSON.parse(text) : null, sha: meta.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      // Отличаем «нет файла» от «нет репозитория»
      await call(token, `/repos/${repo}`);
      return { data: null, sha: null };
    }
    throw e;
  }
}

export async function writeFile(token, repo, path, data, sha, message) {
  const body = { message, content: toBase64(JSON.stringify(data)) };
  if (sha) body.sha = sha;
  const res = await call(token, `/repos/${repo}/contents/${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify(body) });
  return res.content.sha;
}

// Слить локальные данные с файлом в репозитории и записать результат.
// merge(remote) возвращает объединённые данные. При одновременной записи с другого устройства повторяем.
export async function syncFile(token, repo, path, merge, isSame) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await readFile(token, repo, path);
    const merged = merge(data);
    if (data && isSame(data, merged)) return { written: false };
    try {
      await writeFile(token, repo, path, merged, sha, 'Обновление данных CRM');
      return { written: true };
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
  throw new Error('Не удалось сохранить: данные одновременно меняются с другого устройства. Попробуйте ещё раз.');
}

import { useRef, useState } from 'react';
import { DEFAULT_TEMPLATES, alive, clearAll, exportData, mergeIn, replaceAll, setSettings, uid, useStore } from '../store.js';
import { today } from '../logic.js';
import { importStudentsCsv, lessonsCsv, paymentsCsv, studentsCsv } from '../csv.js';
import { loadDemo } from '../demo.js';
import { SETUP_SQL, disableSync, getConfig, saveConfig, signIn, signOut, syncNow, useSyncStatus } from '../sync.js';
import { Field, Icon, PageHead, Segmented, copyText, downloadFile, toast } from '../ui.jsx';

const CURRENCIES = ['₽', 'сум', '₸', '₴', 'сом', 'BYN', '$', '€'];

export default function Settings() {
  const st = useStore();
  const s = st.settings;
  const set = (k) => (e) => setSettings({ [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  return (
    <div className="page narrow">
      <PageHead title="Настройки" />

      <section className="card">
        <h2>Основное</h2>
        <div className="form-grid">
          <Field label="Ваше имя" hint="Подставляется в сообщения родителям"><input value={s.teacherName} onChange={set('teacherName')} placeholder="Мария Сергеевна" /></Field>
          <Field label="Валюта">
            <select value={CURRENCIES.includes(s.currency) ? s.currency : ''} onChange={set('currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              {!CURRENCIES.includes(s.currency) && <option value="">{s.currency}</option>}
            </select>
          </Field>
          <Field label={`Цена занятия по умолчанию, ${s.currency}`}><input type="number" inputMode="decimal" min="0" value={s.defaultPrice} onChange={set('defaultPrice')} /></Field>
          <Field label="Длительность по умолчанию, мин"><input type="number" inputMode="numeric" min="5" step="5" value={s.defaultDuration} onChange={set('defaultDuration')} /></Field>
          <Field label="Пропуск без уважительной причины" full>
            <Segmented value={s.chargeAbsent ? 'yes' : 'no'} onChange={(v) => setSettings({ chargeAbsent: v === 'yes' })}
              options={[['no', 'Не списывать оплату'], ['yes', 'Списывать как занятие']]} />
          </Field>
          <Field label="Тема оформления" full>
            <Segmented value={s.theme} onChange={(v) => setSettings({ theme: v })} options={[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']]} />
          </Field>
        </div>
      </section>

      <Templates templates={s.templates} />
      <Backup st={st} />
      <SyncSection />

      <section className="card">
        <h2>Установить на телефон</h2>
        <p className="muted">
          Сайт можно добавить на главный экран как обычное приложение. <b>iPhone:</b> откройте сайт в Safari → «Поделиться» → «На экран „Домой“».
          <b> Android:</b> в Chrome нажмите ⋮ → «Добавить на главный экран».
        </p>
      </section>

      <section className="card">
        <h2>Пример и очистка</h2>
        <p className="muted small mt0">Пример добавит нескольких вымышленных учеников, группу и занятия, чтобы посмотреть, как всё работает.</p>
        <div className="row gap8 wrap">
          <button className="btn soft" onClick={() => { loadDemo(); toast('Пример добавлен'); }}>Добавить пример данных</button>
          <button className="btn danger ghost" onClick={() => {
            if (!window.confirm('Удалить ВСЕ данные: учеников, занятия, оплаты? Сначала лучше скачать резервную копию.')) return;
            if (!window.confirm('Точно удалить всё? Отменить будет нельзя.')) return;
            clearAll();
            toast('Все данные удалены');
          }}><Icon name="trash" size={18} />Удалить все данные</button>
        </div>
      </section>
    </div>
  );
}

function Templates({ templates }) {
  const update = (id, patch) => setSettings({ templates: templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  return (
    <section className="card">
      <div className="card-head">
        <h2>Шаблоны сообщений</h2>
        <button className="btn small soft" onClick={() => setSettings({ templates: [...templates, { id: uid(), title: 'Новый шаблон', text: 'Здравствуйте, {родитель}! ' }] })}>
          <Icon name="plus" size={16} />Шаблон
        </button>
      </div>
      <p className="muted small mt0">
        Подстановки: <code>{'{ученик}'}</code> <code>{'{родитель}'}</code> <code>{'{дата}'}</code> <code>{'{время}'}</code> <code>{'{сумма}'}</code> (долг)
        {' '}<code>{'{баланс}'}</code> <code>{'{дз}'}</code> <code>{'{преподаватель}'}</code>
      </p>
      <div className="list">
        {templates.map((t) => (
          <div key={t.id} className="tpl">
            <div className="row gap8">
              <input className="grow" value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} aria-label="Название шаблона" />
              <button className="icon-btn soft" aria-label="Удалить шаблон" onClick={() => templates.length > 1 && window.confirm('Удалить шаблон?') && setSettings({ templates: templates.filter((x) => x.id !== t.id) })}>
                <Icon name="trash" size={18} />
              </button>
            </div>
            <textarea rows={3} value={t.text} onChange={(e) => update(t.id, { text: e.target.value })} aria-label="Текст шаблона" />
          </div>
        ))}
      </div>
      <button className="btn small ghost mt8" onClick={() => window.confirm('Вернуть стандартные шаблоны?') && setSettings({ templates: DEFAULT_TEMPLATES })}>Вернуть стандартные</button>
    </section>
  );
}

function Backup({ st }) {
  const jsonRef = useRef();
  const csvRef = useRef();
  const [mode, setMode] = useState('merge');
  const counts = `${alive(st.students).length} уч., ${alive(st.lessons).length} зан., ${alive(st.payments).length} оплат`;

  async function onJson(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.students)) throw new Error('Это не файл резервной копии CRM');
      if (mode === 'replace') {
        if (!window.confirm('Заменить все текущие данные данными из файла?')) return;
        replaceAll(data);
      } else mergeIn(data);
      toast(`Загружено: ${data.students.length} учеников`);
    } catch (err) {
      alert('Не удалось загрузить файл: ' + err.message);
    }
  }
  async function onCsv(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { added, skipped } = importStudentsCsv(await file.text());
      toast(`Добавлено учеников: ${added}${skipped ? `, пропущено (уже есть): ${skipped}` : ''}`);
    } catch (err) {
      alert('Не удалось загрузить таблицу: ' + err.message);
    }
  }

  return (
    <section className="card">
      <h2>Резервная копия</h2>
      <p className="muted small mt0">
        Данные хранятся в этом браузере ({counts}). Раз в неделю скачивайте копию — так ничего не потеряется, даже если почистить браузер.
        Файл копии также переносит данные на другое устройство.
      </p>
      <div className="row gap8 wrap">
        <button className="btn primary" onClick={() => downloadFile(`crm-копия-${today()}.json`, JSON.stringify(exportData(), null, 1))}>
          <Icon name="download" size={18} />Скачать копию (JSON)
        </button>
        <button className="btn soft" onClick={() => jsonRef.current.click()}><Icon name="upload" size={18} />Загрузить копию</button>
        <input ref={jsonRef} type="file" accept=".json,application/json" hidden onChange={onJson} />
      </div>
      <Field label="При загрузке копии" full>
        <Segmented value={mode} onChange={setMode} options={[['merge', 'Объединить с текущими'], ['replace', 'Заменить всё']]} />
      </Field>
      <h3 className="sub-head">Таблицы для Excel (CSV)</h3>
      <div className="row gap8 wrap">
        <button className="btn soft" onClick={() => downloadFile(`ученики-${today()}.csv`, studentsCsv(), 'text/csv')}><Icon name="download" size={18} />Ученики</button>
        <button className="btn soft" onClick={() => downloadFile(`оплаты-${today()}.csv`, paymentsCsv(), 'text/csv')}><Icon name="download" size={18} />Оплаты</button>
        <button className="btn soft" onClick={() => downloadFile(`занятия-${today()}.csv`, lessonsCsv(), 'text/csv')}><Icon name="download" size={18} />Занятия и оценки</button>
        <button className="btn soft" onClick={() => csvRef.current.click()}><Icon name="upload" size={18} />Загрузить учеников из CSV</button>
        <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={onCsv} />
      </div>
      <p className="muted small">Для загрузки учеников первая строка таблицы должна содержать заголовки, как в скачанном файле «Ученики» (обязательна только колонка «Имя»).</p>
    </section>
  );
}

function SyncSection() {
  const status = useSyncStatus();
  const cfg = getConfig();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(cfg?.url || '');
  const [key, setKey] = useState(cfg?.key || '');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const color = { on: 'green', syncing: 'blue', error: 'red', login: 'amber', off: 'gray' }[status.state];

  return (
    <section className="card">
      <div className="card-head">
        <h2><Icon name="cloud" size={20} /> Синхронизация между устройствами</h2>
        <span className={'badge badge-' + color}>{status.state === 'off' ? 'выключена' : status.state === 'on' ? 'включена' : status.state === 'syncing' ? 'идёт…' : status.state === 'login' ? 'нужен вход' : 'ошибка'}</span>
      </div>
      <p className="muted small mt0">
        Необязательно. Чтобы одни и те же данные были на ноутбуке и телефоне, подключите бесплатную облачную базу Supabase.
        {status.message && status.state !== 'off' && <><br /><b>{status.message}</b>{status.lastSync ? ` · ${new Date(status.lastSync).toLocaleTimeString('ru-RU')}` : ''}</>}
      </p>

      {status.state === 'on' || status.state === 'syncing' || status.state === 'error' ? (
        <div className="row gap8 wrap">
          {status.email && <span className="muted">Вход: {status.email}</span>}
          <button className="btn soft" disabled={busy} onClick={() => run(syncNow)}>Синхронизировать сейчас</button>
          <button className="btn ghost" onClick={() => run(signOut)}>Выйти</button>
        </div>
      ) : null}

      {status.state === 'login' && (
        <div className="form-grid">
          <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Пароль"><input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          <div className="full row gap8 wrap">
            <button className="btn primary" disabled={busy} onClick={() => run(() => signIn(email, pass))}>Войти</button>
            <button className="btn soft" disabled={busy} onClick={() => run(() => signIn(email, pass, true))}>Зарегистрироваться</button>
            <button className="btn ghost" onClick={() => { disableSync(); setUrl(''); setKey(''); }}>Отключить облако</button>
          </div>
          <p className="full muted small">На первом устройстве нажмите «Зарегистрироваться», на втором — «Войти» с теми же email и паролем.</p>
        </div>
      )}

      {status.state === 'off' && (
        <>
          <button className="btn soft" onClick={() => setOpen(!open)}>{open ? 'Скрыть инструкцию' : 'Настроить синхронизацию'}</button>
          {open && (
            <div className="howto">
              <ol>
                <li>Зайдите на <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>, нажмите «Start your project» и войдите (можно через GitHub). Карта не нужна.</li>
                <li>Нажмите «New project», придумайте название и пароль базы, регион — ближайший (например, Frankfurt). Подождите 1–2 минуты.</li>
                <li>Слева откройте <b>SQL Editor</b>, вставьте текст ниже и нажмите <b>Run</b>.
                  <pre className="code">{SETUP_SQL}</pre>
                  <button className="btn small soft" onClick={() => copyText(SETUP_SQL)}>Скопировать SQL</button>
                </li>
                <li>Чтобы не подтверждать почту: <b>Authentication → Sign In / Providers → Email</b>, выключите «Confirm email» и сохраните (необязательно).</li>
                <li>Откройте <b>Project Settings → API</b> (или кнопку «Connect»). Скопируйте <b>Project URL</b> и ключ <b>anon public</b> (или Publishable key) в поля ниже.</li>
              </ol>
              <div className="form-grid">
                <Field label="Project URL" full><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
                <Field label="anon public key" full><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></Field>
              </div>
              <button className="btn primary mt8" disabled={busy || !url || !key} onClick={() => run(() => saveConfig(url, key))}>Сохранить и продолжить</button>
              <p className="muted small">Эти шаги нужно сделать один раз. На втором устройстве вставьте те же URL и ключ и нажмите «Войти».</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

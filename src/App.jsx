import { useEffect } from 'react';
import { useStore } from './store.js';
import { initSync, useSyncStatus } from './sync.js';
import { Icon, ModalHost, Toaster, go, useRoute } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import Students from './pages/Students.jsx';
import Groups from './pages/Groups.jsx';
import Homework from './pages/Homework.jsx';
import Payments from './pages/Payments.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  ['/', 'home', 'Главная'],
  ['/schedule', 'calendar', 'Расписание'],
  ['/students', 'users', 'Ученики'],
  ['/groups', 'group', 'Группы'],
  ['/homework', 'book', 'ДЗ и оценки'],
  ['/payments', 'wallet', 'Оплаты'],
  ['/settings', 'settings', 'Настройки'],
];
const MOBILE_NAV = ['/', '/schedule', '/students', '/payments'];

function useTheme(theme) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#111827' : '#4f46e5');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function More() {
  return (
    <div className="page">
      <div className="page-head"><h1>Ещё</h1></div>
      <div className="card list p0">
        {NAV.filter(([p]) => !MOBILE_NAV.includes(p)).map(([p, icon, label]) => (
          <button key={p} className="more-row" onClick={() => go(p)}>
            <span className="more-icon"><Icon name={icon} /></span>
            <span className="grow">{label}</span>
            <Icon name="right" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const st = useStore();
  const { parts } = useRoute();
  const sync = useSyncStatus();
  useTheme(st.settings.theme);
  useEffect(() => {
    initSync();
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [parts[0], parts[1]]);

  const section = '/' + (parts[0] || '');
  const pages = { '/': Dashboard, '/schedule': Schedule, '/students': Students, '/groups': Groups, '/homework': Homework, '/payments': Payments, '/settings': Settings, '/more': More };
  const Page = pages[section] || Dashboard;
  const moreActive = !MOBILE_NAV.includes(section);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><img src="./icon.svg" alt="" width="34" height="34" /><span>Мои ученики</span></div>
        <nav>
          {NAV.map(([p, icon, label]) => (
            <a key={p} href={'#' + p} className={'nav-item' + (section === p ? ' on' : '')}>
              <Icon name={icon} /><span>{label}</span>
            </a>
          ))}
        </nav>
        {sync.state !== 'off' && (
          <a href="#/settings" className={'sync-pill s-' + sync.state}><Icon name="cloud" size={16} />{sync.state === 'on' ? 'Синхронизировано' : sync.state === 'syncing' ? 'Синхронизация…' : sync.state === 'login' ? 'Нужен вход' : 'Ошибка синхр.'}</a>
        )}
      </aside>
      <main className="main">
        <Page />
      </main>
      <nav className="bottom-nav">
        {NAV.filter(([p]) => MOBILE_NAV.includes(p)).map(([p, icon, label]) => (
          <a key={p} href={'#' + p} className={'bn-item' + (section === p ? ' on' : '')}>
            <Icon name={icon} /><span>{label}</span>
          </a>
        ))}
        <a href="#/more" className={'bn-item' + (moreActive ? ' on' : '')}><Icon name="more" /><span>Ещё</span></a>
      </nav>
      <ModalHost />
      <Toaster />
    </div>
  );
}

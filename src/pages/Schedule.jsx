import { useMemo, useState } from 'react';
import { alive, useStore } from '../store.js';
import {
  WD_SHORT, addDays, addMonths, fmtDate, fmtMonth, indexById, lessonStudentIds, monthEnd, monthStart, occurrences, parse,
  relDay, today, weekStart, endTime,
} from '../logic.js';
import { LessonEditor, ScheduleForm } from '../forms.jsx';
import { Empty, Icon, PageHead, Segmented, openModal } from '../ui.jsx';
import { LessonCard } from './LessonCard.jsx';

const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

export default function Schedule() {
  const st = useStore();
  const [view, setView] = useState(() => (isMobile() ? 'day' : 'week'));
  const [date, setDate] = useState(today());
  const [who, setWho] = useState('');
  const [showRegular, setShowRegular] = useState(false);
  const idx = useMemo(() => ({ students: indexById(st.students), groups: indexById(st.groups) }), [st]);

  const range = view === 'day' ? [weekStart(date), addDays(weekStart(date), 6)]
    : view === 'week' ? [weekStart(date), addDays(weekStart(date), 6)]
    : [weekStart(monthStart(date)), addDays(weekStart(monthEnd(date)), 6)];

  const occ = useMemo(() => {
    let list = occurrences(st, range[0], range[1]);
    if (who) {
      const [kind, id] = who.split(':');
      list = list.filter((l) => (kind === 'g' ? l.groupId === id : lessonStudentIds(l, idx.groups).includes(id)));
    }
    return list;
  }, [st, range[0], range[1], who, idx]);

  const byDay = useMemo(() => {
    const m = new Map();
    for (const l of occ) {
      if (!m.has(l.date)) m.set(l.date, []);
      m.get(l.date).push(l);
    }
    return m;
  }, [occ]);

  const step = (n) => setDate(view === 'month' ? addMonths(date, n) : addDays(date, n * (view === 'day' ? 1 : 7)));
  const ws = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const label = view === 'month' ? fmtMonth(date) : view === 'week' ? `${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}` : relDay(date);
  const add = (d = date) => openModal(<LessonEditor preset={{ date: d }} />);

  return (
    <div className="page">
      <PageHead title="Расписание">
        <button className="btn soft" onClick={() => setShowRegular(!showRegular)}><Icon name="repeat" size={18} /><span className="hide-xs">Регулярные</span></button>
        <button className="btn primary" onClick={() => add()}><Icon name="plus" size={18} /><span className="hide-xs">Занятие</span></button>
      </PageHead>

      {showRegular && <RegularList st={st} idx={idx} />}

      <div className="toolbar">
        <Segmented value={view} onChange={setView} options={[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]} />
        <select className="who-filter" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Фильтр">
          <option value="">Все ученики и группы</option>
          {alive(st.groups).length > 0 && <optgroup label="Группы">{alive(st.groups).map((g) => <option key={g.id} value={'g:' + g.id}>{g.name}</option>)}</optgroup>}
          <optgroup label="Ученики">{alive(st.students).filter((s) => s.status !== 'left').sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => <option key={s.id} value={'s:' + s.id}>{s.name}</option>)}</optgroup>
        </select>
      </div>

      <div className="date-nav">
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Назад"><Icon name="left" /></button>
        <div className="date-label">{label}</div>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Вперёд"><Icon name="right" /></button>
        <button className="btn small soft" onClick={() => setDate(today())}>Сегодня</button>
      </div>

      {view === 'day' && (
        <>
          <div className="day-strip">
            {days.map((d, i) => {
              const n = (byDay.get(d) || []).filter((l) => l.status !== 'cancelled').length;
              return (
                <button key={d} className={'day-pill' + (d === date ? ' on' : '') + (d === today() ? ' today' : '')} onClick={() => setDate(d)}>
                  <span>{WD_SHORT[i]}</span>
                  <b>{parse(d).getDate()}</b>
                  <i className={n ? 'dot' : 'dot empty'}>{n || ''}</i>
                </button>
              );
            })}
          </div>
          <div className="card">
            {(byDay.get(date) || []).length ? (
              <div className="list">{byDay.get(date).map((l) => <LessonCard key={l.id} lesson={l} idx={idx} />)}</div>
            ) : (
              <Empty icon="calendar" title="Занятий нет" action={<button className="btn soft" onClick={() => add()}><Icon name="plus" size={18} />Добавить занятие</button>} />
            )}
          </div>
        </>
      )}

      {view === 'week' && (
        <div className="week">
          {days.map((d, i) => (
            <div key={d} className={'week-day' + (d === today() ? ' today' : '')}>
              <div className="week-day-head">
                <span>{WD_SHORT[i]}, {parse(d).getDate()}</span>
                <button className="icon-btn tiny" onClick={() => add(d)} aria-label="Добавить занятие"><Icon name="plus" size={16} /></button>
              </div>
              <div className="list">
                {(byDay.get(d) || []).map((l) => <LessonCard key={l.id} lesson={l} idx={idx} compact />)}
                {!(byDay.get(d) || []).length && <div className="week-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'month' && (
        <div className="month">
          {WD_SHORT.map((w) => <div key={w} className="month-wd">{w}</div>)}
          {Array.from({ length: Math.round((parse(range[1]) - parse(range[0])) / 864e5) + 1 }, (_, i) => addDays(range[0], i)).map((d) => {
            const list = (byDay.get(d) || []).filter((l) => l.status !== 'cancelled');
            const out = d.slice(0, 7) !== date.slice(0, 7);
            return (
              <button key={d} className={'month-cell' + (out ? ' out' : '') + (d === today() ? ' today' : '')} onClick={() => { setDate(d); setView('day'); }}>
                <span className="mc-num">{parse(d).getDate()}</span>
                <span className="mc-items">
                  {list.slice(0, 3).map((l) => (
                    <span key={l.id} className={'mc-item st-' + l.status} style={l.groupId ? { '--accent': idx.groups.get(l.groupId)?.color } : undefined}>
                      {l.time} {l.groupId ? idx.groups.get(l.groupId)?.name : idx.students.get(l.studentId)?.name?.split(' ')[0]}
                    </span>
                  ))}
                  {list.length > 3 && <span className="mc-more">+{list.length - 3}</span>}
                </span>
                {list.length > 0 && <span className="mc-count">{list.length}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RegularList({ st, idx }) {
  const list = alive(st.schedules).filter((s) => !s.endDate || s.endDate >= today());
  return (
    <div className="card mb16">
      <div className="card-head">
        <h2>Регулярные занятия</h2>
        <button className="btn small primary" onClick={() => openModal(<ScheduleForm />)}><Icon name="plus" size={16} />Добавить</button>
      </div>
      <p className="muted small mt0">Задайте дни и время один раз — занятия будут появляться в расписании каждую неделю.</p>
      {list.length ? (
        <div className="list">
          {list.map((sc) => (
            <button key={sc.id} className="row-main bordered" onClick={() => openModal(<ScheduleForm schedule={sc} />)}>
              <Icon name="repeat" size={18} />
              <span className="grow">
                <b>{sc.groupId ? idx.groups.get(sc.groupId)?.name : idx.students.get(sc.studentId)?.name || '—'}</b>
                <span className="muted small block">
                  {sc.weekdays.map((w) => WD_SHORT[w - 1]).join(', ')} · {sc.time}–{endTime(sc.time, sc.duration)}
                  {sc.endDate ? ` · до ${fmtDate(sc.endDate)}` : ''}
                </span>
              </span>
              <Icon name="edit" size={18} />
            </button>
          ))}
        </div>
      ) : (
        <div className="muted">Пока нет регулярных занятий.</div>
      )}
    </div>
  );
}

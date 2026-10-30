import { useMemo, useState } from 'react';
import { alive, useStore } from '../store.js';
import { fmtDate, indexById, lessonStudentIds, lessonTitle } from '../logic.js';
import { LessonEditor, MessageDialog } from '../forms.jsx';
import { Avatar, Empty, Icon, PageHead, Segmented, go, openModal } from '../ui.jsx';

export default function Homework() {
  const st = useStore();
  const [tab, setTab] = useState('hw');
  const [who, setWho] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const idx = useMemo(() => ({ students: indexById(st.students), groups: indexById(st.groups) }), [st]);

  const lessons = useMemo(() => {
    let list = alive(st.lessons).filter((l) => l.status === 'done' && (l.homework || Object.values(l.grades || {}).some(Boolean)));
    if (who) {
      const [k, id] = who.split(':');
      list = list.filter((l) => (k === 'g' ? l.groupId === id : lessonStudentIds(l, idx.groups).includes(id)));
    }
    if (onlyOpen) list = list.filter((l) => l.homework && lessonStudentIds(l, idx.groups).some((sid) => !l.hwDone?.[sid]));
    return list.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  }, [st, who, onlyOpen, idx]);

  const journal = useMemo(() => {
    const rows = new Map();
    for (const l of alive(st.lessons)) {
      if (l.status !== 'done') continue;
      for (const sid of lessonStudentIds(l, idx.groups)) {
        if (!idx.students.has(sid)) continue;
        if (!rows.has(sid)) rows.set(sid, { grades: [], hw: 0, hwDone: 0 });
        const r = rows.get(sid);
        const g = l.grades?.[sid];
        if (g) r.grades.push({ g, date: l.date });
        if (l.homework) {
          r.hw++;
          if (l.hwDone?.[sid]) r.hwDone++;
        }
      }
    }
    return [...rows.entries()]
      .map(([sid, r]) => {
        const nums = r.grades.map((x) => parseFloat(String(x.g).replace(',', '.'))).filter((n) => !isNaN(n));
        return { s: idx.students.get(sid), ...r, avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null };
      })
      .filter((r) => r.s.status !== 'left')
      .sort((a, b) => a.s.name.localeCompare(b.s.name, 'ru'));
  }, [st, idx]);

  return (
    <div className="page">
      <PageHead title="Домашние задания и оценки" />
      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={[['hw', 'Задания'], ['journal', 'Журнал']]} />
        {tab === 'hw' && (
          <>
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Фильтр">
              <option value="">Все</option>
              {alive(st.groups).map((g) => <option key={g.id} value={'g:' + g.id}>Группа: {g.name}</option>)}
              {alive(st.students).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => <option key={s.id} value={'s:' + s.id}>{s.name}</option>)}
            </select>
            <button className={'chip' + (onlyOpen ? ' on' : '')} onClick={() => setOnlyOpen(!onlyOpen)}>Не сделанные</button>
          </>
        )}
      </div>

      {tab === 'hw' && (lessons.length ? (
        <div className="list">
          {lessons.slice(0, 100).map((l) => {
            const sids = lessonStudentIds(l, idx.groups);
            return (
              <div key={l.id} className="card hw-card">
                <button className="hw-card-head" onClick={() => openModal(<LessonEditor lesson={l} />)}>
                  <span className="hw-date">{fmtDate(l.date)}</span>
                  <span className="grow minw0"><b>{lessonTitle(l, idx.students, idx.groups)}</b>{l.topic && <span className="muted small block">{l.topic}</span>}</span>
                  <Icon name="edit" size={18} />
                </button>
                {l.homework && <div className="hw-text">📝 {l.homework}</div>}
                <div className="hw-students">
                  {sids.map((sid) => {
                    const s = idx.students.get(sid);
                    if (!s) return null;
                    return (
                      <span key={sid} className={'hw-st' + (l.hwDone?.[sid] ? ' done' : '')}>
                        {s.name.split(' ')[0]}
                        {l.homework && <i>{l.hwDone?.[sid] ? '✓' : '…'}</i>}
                        {l.grades?.[sid] && <b>{l.grades[sid]}</b>}
                      </span>
                    );
                  })}
                  {l.homework && sids.length === 1 && (
                    <button className="btn small soft" onClick={() => openModal(<MessageDialog studentId={sids[0]} templateId="homework" lesson={l} />)}>
                      <Icon name="chat" size={16} />Отправить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon="book" title="Пока пусто" text="Домашние задания и оценки ставятся в окне проведённого занятия." />
      ))}

      {tab === 'journal' && (journal.length ? (
        <div className="card p0">
          <div className="journal">
            <div className="j-row j-head"><span>Ученик</span><span>Средняя</span><span>ДЗ сделано</span><span className="hide-mobile">Последние оценки</span></div>
            {journal.map((r) => (
              <button key={r.s.id} className="j-row" onClick={() => go('/students/' + r.s.id)}>
                <span className="row gap8 minw0"><Avatar name={r.s.name} id={r.s.id} size={30} /><span className="ellipsis">{r.s.name}</span></span>
                <span><b>{r.avg === null ? '—' : r.avg.toFixed(1)}</b></span>
                <span>{r.hw ? `${r.hwDone}/${r.hw}` : '—'}</span>
                <span className="hide-mobile j-grades">{r.grades.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((x, i) => <i key={i} className="grade-pill sm">{x.g}</i>)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Empty icon="star" title="Журнал пуст" text="Появится после первых проведённых занятий." />
      ))}
    </div>
  );
}

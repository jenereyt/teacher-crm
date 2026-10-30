import { useMemo } from 'react';
import { alive, useStore } from '../store.js';
import { WD_SHORT, addDays, computeFinance, endTime, fmtMoney, indexById, occurrences, plural, today } from '../logic.js';
import { GroupForm, LessonEditor, ScheduleForm } from '../forms.jsx';
import { Avatar, Empty, Icon, PageHead, go, openModal, useRoute } from '../ui.jsx';
import { LessonCard } from './LessonCard.jsx';

export default function Groups() {
  const { parts } = useRoute();
  return parts[1] ? <GroupCard id={parts[1]} /> : <GroupList />;
}

function scheduleText(list) {
  return list.map((sc) => `${sc.weekdays.map((w) => WD_SHORT[w - 1]).join(', ')} ${sc.time}`).join('; ');
}

function GroupList() {
  const st = useStore();
  const groups = alive(st.groups).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const schedules = alive(st.schedules);
  return (
    <div className="page">
      <PageHead title="Группы" sub={`${groups.length} ${plural(groups.length, 'группа', 'группы', 'групп')}`}>
        <button className="btn primary" onClick={() => openModal(<GroupForm />)}><Icon name="plus" size={18} /><span className="hide-xs">Новая группа</span></button>
      </PageHead>
      {groups.length ? (
        <div className="cards-grid">
          {groups.map((g) => {
            const sc = schedules.filter((s) => s.groupId === g.id);
            return (
              <button key={g.id} className="group-card" style={{ '--accent': g.color }} onClick={() => go('/groups/' + g.id)}>
                <span className="gc-name">{g.name}</span>
                <span className="muted small">{[g.subject, g.level].filter(Boolean).join(' · ') || ' '}</span>
                <span className="gc-meta"><Icon name="users" size={16} />{(g.studentIds || []).length} {plural((g.studentIds || []).length, 'ученик', 'ученика', 'учеников')}</span>
                {sc.length > 0 && <span className="gc-meta"><Icon name="repeat" size={16} />{scheduleText(sc)}</span>}
                {g.price !== '' && g.price != null && <span className="gc-meta"><Icon name="wallet" size={16} />{fmtMoney(g.price, st.settings.currency)} с ученика</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon="group" title="Групп пока нет" text="Объедините учеников, которые занимаются вместе, — отмечать посещаемость будет быстрее."
          action={<button className="btn primary" onClick={() => openModal(<GroupForm />)}><Icon name="plus" size={18} />Создать группу</button>} />
      )}
    </div>
  );
}

function GroupCard({ id }) {
  const st = useStore();
  const g = alive(st.groups).find((x) => x.id === id);
  const data = useMemo(() => {
    if (!g) return null;
    const idx = { students: indexById(st.students), groups: indexById(st.groups) };
    const fin = computeFinance(st);
    const occ = occurrences(st, addDays(today(), -60), addDays(today(), 21)).filter((l) => l.groupId === id);
    return {
      idx, fin,
      upcoming: occ.filter((l) => l.date >= today() && l.status === 'planned').slice(0, 6),
      past: occ.filter((l) => l.date < today() || l.status !== 'planned').reverse().slice(0, 20),
      schedules: alive(st.schedules).filter((s) => s.groupId === id),
    };
  }, [st, id]);
  if (!g) return <div className="page"><PageHead title="Группа не найдена" back="/groups" /></div>;
  const { idx, fin, upcoming, past, schedules } = data;
  const cur = st.settings.currency;

  return (
    <div className="page">
      <PageHead title={g.name} back="/groups" sub={[g.subject, g.level].filter(Boolean).join(' · ')}>
        <button className="btn soft" onClick={() => openModal(<GroupForm group={g} />)}><Icon name="edit" size={18} /><span className="hide-xs">Изменить</span></button>
        <button className="btn primary" onClick={() => openModal(<LessonEditor preset={{ groupId: id, studentId: null }} />)}><Icon name="plus" size={18} /><span className="hide-xs">Занятие</span></button>
      </PageHead>
      <div className="detail-grid">
        <div className="col">
          <section className="card">
            <div className="card-head"><h2>Ученики ({(g.studentIds || []).length})</h2>
              <button className="btn small soft" onClick={() => openModal(<GroupForm group={g} />)}>Состав</button></div>
            <div className="list">
              {(g.studentIds || []).map((sid) => {
                const s = idx.students.get(sid);
                if (!s) return null;
                const b = fin.get(sid)?.balance || 0;
                return (
                  <button key={sid} className="row-main" onClick={() => go('/students/' + sid)}>
                    <Avatar name={s.name} id={sid} size={36} />
                    <span className="grow">{s.name}</span>
                    <span className={'money ' + (b < -0.5 ? 'neg' : b > 0.5 ? 'pos' : '')}>{fmtMoney(b, cur)}</span>
                  </button>
                );
              })}
              {!(g.studentIds || []).length && <div className="muted">В группе пока никого</div>}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2>Регулярно</h2>
              <button className="btn small soft" onClick={() => openModal(<ScheduleForm preset={{ groupId: id, studentId: null }} />)}><Icon name="plus" size={16} />Добавить</button></div>
            {schedules.length ? schedules.map((sc) => (
              <button key={sc.id} className="row-main bordered" onClick={() => openModal(<ScheduleForm schedule={sc} />)}>
                <Icon name="repeat" size={18} /><span className="grow">{sc.weekdays.map((w) => WD_SHORT[w - 1]).join(', ')} · {sc.time}–{endTime(sc.time, sc.duration)}</span>
              </button>
            )) : <div className="muted small">Нет регулярного расписания</div>}
            {g.notes && <><h3 className="sub-head">Заметки</h3><p className="notes">{g.notes}</p></>}
          </section>
        </div>
        <div className="col">
          <section className="card">
            <h2>Ближайшие занятия</h2>
            {upcoming.length ? <div className="list">{upcoming.map((l) => <LessonCard key={l.id} lesson={l} idx={idx} showDate compact />)}</div> : <div className="muted">Нет запланированных</div>}
          </section>
          <section className="card">
            <h2>Прошедшие</h2>
            {past.length ? <div className="list">{past.map((l) => <LessonCard key={l.id} lesson={l} idx={idx} showDate compact />)}</div> : <div className="muted">Пока не было</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

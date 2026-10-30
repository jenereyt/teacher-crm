import { useMemo, useState } from 'react';
import { alive, useStore } from '../store.js';
import {
  ATTENDANCE, STUDENT_STATUS, WD_SHORT, addDays, computeFinance, endTime, fmtDate, fmtMoney, indexById, lessonStudentIds,
  occurrences, phoneDigits, plural, relDay, today,
} from '../logic.js';
import { LessonEditor, MessageDialog, PaymentForm, ScheduleForm, StudentForm } from '../forms.jsx';
import { Avatar, Badge, Empty, Icon, PageHead, SearchBox, Segmented, go, openModal, useRoute } from '../ui.jsx';
import { LessonCard } from './LessonCard.jsx';

const FILTERS = [['current', 'Текущие'], ['trial', 'Пробные'], ['paused', 'Пауза'], ['debt', 'Должники'], ['left', 'Ушли'], ['all', 'Все']];

export default function Students() {
  const { parts } = useRoute();
  if (parts[1]) return <StudentCard id={parts[1]} />;
  return <StudentList />;
}

function StudentList() {
  const st = useStore();
  const { query } = useRoute();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(query.get('filter') || 'current');
  const [group, setGroup] = useState('');
  const [sort, setSort] = useState('name');
  const cur = st.settings.currency;
  const fin = useMemo(() => computeFinance(st), [st]);
  const groups = alive(st.groups);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const ingroup = group ? new Set(groups.find((g) => g.id === group)?.studentIds || []) : null;
    return alive(st.students)
      .filter((s) => {
        if (ql && ![s.name, s.phone, s.parentName, s.parentPhone, s.level, s.subject, s.notes].some((v) => (v || '').toLowerCase().includes(ql))) return false;
        if (ingroup && !ingroup.has(s.id)) return false;
        const b = fin.get(s.id)?.balance || 0;
        if (filter === 'current') return s.status === 'active' || s.status === 'trial';
        if (filter === 'debt') return b < -0.5;
        if (filter === 'all') return true;
        return s.status === filter;
      })
      .sort((a, b) => (sort === 'balance' ? (fin.get(a.id)?.balance || 0) - (fin.get(b.id)?.balance || 0) : a.name.localeCompare(b.name, 'ru')));
  }, [st, q, filter, group, sort, fin]);

  const groupNames = (sid) => groups.filter((g) => (g.studentIds || []).includes(sid)).map((g) => g.name).join(', ');

  return (
    <div className="page">
      <PageHead title="Ученики" sub={`${list.length} ${plural(list.length, 'ученик', 'ученика', 'учеников')}`}>
        <button className="btn primary" onClick={() => openModal(<StudentForm onSaved={(s) => go('/students/' + s.id)} />)}>
          <Icon name="plus" size={18} /><span className="hide-xs">Добавить</span>
        </button>
      </PageHead>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Имя, телефон, родитель…" />
        {groups.length > 0 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Группа">
            <option value="">Все группы</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
          <option value="name">По имени</option>
          <option value="balance">По балансу</option>
        </select>
      </div>
      <div className="chips scroll-x mb16">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
      </div>

      {list.length ? (
        <div className="card list p0">
          {list.map((s) => {
            const f = fin.get(s.id);
            const gn = groupNames(s.id);
            return (
              <button key={s.id} className="student-row" onClick={() => go('/students/' + s.id)}>
                <Avatar name={s.name} id={s.id} size={44} />
                <span className="grow minw0">
                  <span className="sr-name">{s.name} {s.status !== 'active' && <Badge color={STUDENT_STATUS[s.status]?.color}>{STUDENT_STATUS[s.status]?.label}</Badge>}</span>
                  <span className="sr-sub">{[s.level, s.subject, gn].filter(Boolean).join(' · ') || s.parentName || s.phone || '—'}</span>
                </span>
                <span className="sr-right">
                  <span className={'money ' + (f?.balance < -0.5 ? 'neg' : f?.balance > 0.5 ? 'pos' : '')}>{fmtMoney(f?.balance || 0, cur)}</span>
                  {f?.pkgLeft > 0 && <span className="muted small">абон.: {f.pkgLeft}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon="users" title={alive(st.students).length ? 'Никого не найдено' : 'Учеников пока нет'}
          text={alive(st.students).length ? 'Попробуйте изменить поиск или фильтр' : 'Добавьте первого ученика'}
          action={!alive(st.students).length && <button className="btn primary" onClick={() => openModal(<StudentForm />)}><Icon name="plus" size={18} />Добавить ученика</button>} />
      )}
    </div>
  );
}

function StudentCard({ id }) {
  const st = useStore();
  const [tab, setTab] = useState('lessons');
  const s = alive(st.students).find((x) => x.id === id);
  const cur = st.settings.currency;
  const data = useMemo(() => {
    if (!s) return null;
    const idx = { students: indexById(st.students), groups: indexById(st.groups) };
    const fin = computeFinance(st).get(id);
    const groups = alive(st.groups).filter((g) => (g.studentIds || []).includes(id));
    const gids = new Set(groups.map((g) => g.id));
    const from = s.startDate && s.startDate < addDays(today(), -365) ? addDays(today(), -365) : s.startDate || addDays(today(), -365);
    const occ = occurrences(st, from, addDays(today(), 28)).filter((l) => lessonStudentIds(l, idx.groups).includes(id));
    const upcoming = occ.filter((l) => l.date >= today() && l.status === 'planned').slice(0, 5);
    const past = occ.filter((l) => l.date < today() || l.status !== 'planned').reverse();
    const done = alive(st.lessons).filter((l) => l.status === 'done' && lessonStudentIds(l, idx.groups).includes(id)).sort((a, b) => b.date.localeCompare(a.date));
    const att = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const l of done) if (l.attendance?.[id]) att[l.attendance[id]]++;
    const grades = done.filter((l) => l.grades?.[id]).map((l) => ({ l, g: l.grades[id] }));
    const nums = grades.map((x) => parseFloat(String(x.g).replace(',', '.'))).filter((n) => !isNaN(n));
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : null;
    const hw = done.filter((l) => l.homework);
    const payments = alive(st.payments).filter((p) => p.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
    const schedules = alive(st.schedules).filter((sc) => sc.studentId === id || gids.has(sc.groupId));
    return { idx, fin, groups, upcoming, past, att, grades, avg, hw, payments, schedules, done };
  }, [st, id]);

  if (!s) return <div className="page"><PageHead title="Ученик не найден" back="/students" /></div>;
  const { idx, fin, groups, upcoming, past, att, grades, avg, hw, payments, schedules, done } = data;
  const totalAtt = att.present + att.late + att.absent + att.excused;
  const attPct = totalAtt ? Math.round(((att.present + att.late) / totalAtt) * 100) : null;
  const status = STUDENT_STATUS[s.status] || STUDENT_STATUS.active;

  return (
    <div className="page">
      <PageHead title={s.name} back="/students" sub={[s.level, s.subject].filter(Boolean).join(' · ')}>
        <button className="btn soft" onClick={() => openModal(<StudentForm student={s} />)}><Icon name="edit" size={18} /><span className="hide-xs">Изменить</span></button>
      </PageHead>

      <div className="profile-top card">
        <Avatar name={s.name} id={s.id} size={64} />
        <div className="grow minw0">
          <div className="row gap8 wrap"><Badge color={status.color}>{status.label}</Badge>{groups.map((g) => <button key={g.id} className="badge badge-link" onClick={() => go('/groups/' + g.id)}>{g.name}</button>)}</div>
          <div className={'balance ' + (fin.balance < -0.5 ? 'neg' : fin.balance > 0.5 ? 'pos' : '')}>
            {fmtMoney(fin.balance, cur)}
            <span>{fin.balance < -0.5 ? 'долг' : fin.balance > 0.5 ? 'предоплата' : 'баланс'}</span>
          </div>
          {fin.pkgLeft > 0 && <div className="muted small">По абонементу осталось {fin.pkgLeft} {plural(fin.pkgLeft, 'занятие', 'занятия', 'занятий')}</div>}
        </div>
      </div>

      <div className="quick-actions">
        <button className="qa" onClick={() => openModal(<PaymentForm preset={{ studentId: id, amount: fin.balance < 0 ? -Math.round(fin.balance) : '' }} />)}><Icon name="wallet" /><span>Оплата</span></button>
        <button className="qa" onClick={() => openModal(<LessonEditor preset={{ studentId: id, groupId: null }} />)}><Icon name="plus" /><span>Занятие</span></button>
        <button className="qa" onClick={() => openModal(<MessageDialog studentId={id} templateId={fin.balance < -0.5 ? 'debt' : 'lesson'} />)}><Icon name="chat" /><span>Написать</span></button>
        <a className={'qa' + (phoneDigits(s.parentPhone || s.phone) ? '' : ' disabled')} href={phoneDigits(s.parentPhone || s.phone) ? 'tel:+' + phoneDigits(s.parentPhone || s.phone) : undefined}><Icon name="phone" /><span>Позвонить</span></a>
      </div>

      <div className="detail-grid">
        <div className="col">
          <section className="card">
            <h2>Контакты</h2>
            <dl className="info">
              <Info label="Телефон" value={s.phone} tel />
              <Info label="Telegram" value={s.contact} />
              <Info label="Родитель" value={s.parentName} />
              <Info label="Тел. родителя" value={s.parentPhone} tel />
              <Info label="Telegram родителя" value={s.parentContact} />
              <Info label="День рождения" value={s.birthday && fmtDate(s.birthday)} />
              <Info label="Занимается с" value={s.startDate && fmtDate(s.startDate)} />
              <Info label="Цена занятия" value={fmtMoney(s.price !== '' && s.price != null ? s.price : st.settings.defaultPrice, cur)} />
            </dl>
            {s.notes && <><h3 className="sub-head">Заметки</h3><p className="notes">{s.notes}</p></>}
          </section>

          <section className="card">
            <h2>Статистика</h2>
            <div className="mini-stats">
              <div><b>{fin.lessonsDone}</b><span>оплачиваемых занятий</span></div>
              <div><b>{attPct === null ? '—' : attPct + '%'}</b><span>посещаемость</span></div>
              <div><b>{avg || '—'}</b><span>средняя оценка</span></div>
              <div><b>{fmtMoney(fin.paid, cur)}</b><span>оплачено всего</span></div>
            </div>
            {totalAtt > 0 && (
              <div className="att-bar" aria-label="Посещаемость">
                {Object.entries(att).filter(([, n]) => n).map(([k, n]) => (
                  <span key={k} className={'seg seg-' + ATTENDANCE[k].color} style={{ flex: n }} title={`${ATTENDANCE[k].label}: ${n}`}>{n}</span>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Регулярно</h2>
              <button className="btn small soft" onClick={() => openModal(<ScheduleForm preset={{ studentId: id, groupId: null }} />)}><Icon name="plus" size={16} />Добавить</button>
            </div>
            {schedules.length ? schedules.map((sc) => (
              <button key={sc.id} className="row-main bordered" onClick={() => openModal(<ScheduleForm schedule={sc} />)}>
                <Icon name="repeat" size={18} />
                <span className="grow">{sc.weekdays.map((w) => WD_SHORT[w - 1]).join(', ')} · {sc.time}–{endTime(sc.time, sc.duration)}{sc.groupId ? ` · ${idx.groups.get(sc.groupId)?.name}` : ''}</span>
              </button>
            )) : <div className="muted small">Нет регулярного расписания</div>}
          </section>
        </div>

        <div className="col">
          {upcoming.length > 0 && (
            <section className="card">
              <h2>Ближайшие занятия</h2>
              <div className="list">{upcoming.map((l) => <LessonCard key={l.id} lesson={l} idx={idx} showDate compact />)}</div>
            </section>
          )}
          <section className="card">
            <Segmented value={tab} onChange={setTab} options={[['lessons', 'Занятия'], ['grades', 'ДЗ и оценки'], ['payments', 'Оплаты']]} />
            <div className="mt16">
              {tab === 'lessons' && (past.length ? (
                <div className="list">{past.slice(0, 60).map((l) => <LessonCard key={l.id} lesson={l} idx={idx} showDate compact />)}</div>
              ) : <Empty icon="calendar" title="Занятий пока не было" />)}

              {tab === 'grades' && (grades.length || hw.length ? (
                <div className="list">
                  {done.filter((l) => l.grades?.[id] || l.homework).map((l) => (
                    <button key={l.id} className="hw-row" onClick={() => openModal(<LessonEditor lesson={l} />)}>
                      <span className="hw-date">{fmtDate(l.date)}</span>
                      <span className="grow minw0">
                        {l.topic && <b className="block">{l.topic}</b>}
                        {l.homework && <span className="block muted small">ДЗ: {l.homework}</span>}
                      </span>
                      {l.homework && <Badge color={l.hwDone?.[id] ? 'green' : 'gray'}>{l.hwDone?.[id] ? 'сделано' : 'ДЗ'}</Badge>}
                      {l.grades?.[id] && <span className="grade-pill">{l.grades[id]}</span>}
                    </button>
                  ))}
                </div>
              ) : <Empty icon="book" title="Оценок и ДЗ пока нет" text="Их можно поставить в окне занятия" />)}

              {tab === 'payments' && (payments.length || fin.charges.length ? (
                <div className="list">
                  {payments.map((p) => (
                    <button key={p.id} className="pay-row" onClick={() => openModal(<PaymentForm payment={p} />)}>
                      <span className="hw-date">{fmtDate(p.date)}</span>
                      <span className="grow">{p.lessonsCount > 0 ? `Абонемент на ${p.lessonsCount} ${plural(p.lessonsCount, 'занятие', 'занятия', 'занятий')}` : 'Оплата'}<span className="muted small block">{[p.method, p.comment].filter(Boolean).join(' · ')}</span></span>
                      <span className="money pos">+{fmtMoney(p.amount, cur)}</span>
                    </button>
                  ))}
                  <h3 className="sub-head">Списания за занятия</h3>
                  {fin.charges.slice().reverse().slice(0, 50).map((c) => (
                    <div key={c.lessonId} className="pay-row static">
                      <span className="hw-date">{fmtDate(c.date)}</span>
                      <span className="grow muted">Занятие{c.fromPackage ? ' (абонемент)' : ''}</span>
                      <span className="money">−{fmtMoney(c.cost, cur)}</span>
                    </div>
                  ))}
                  {!fin.charges.length && <div className="muted small">Пока нет</div>}
                </div>
              ) : <Empty icon="wallet" title="Оплат пока нет" />)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, tel }) {
  if (!value) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{tel ? <a href={'tel:+' + phoneDigits(value)}>{value}</a> : value}</dd>
    </>
  );
}

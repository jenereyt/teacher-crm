import { useMemo } from 'react';
import { alive, useStore } from '../store.js';
import { addDays, computeFinance, fmtDate, fmtMoney, indexById, monthEnd, monthStart, occurrences, parse, plural, today, WD_LONG, weekday, MONTHS } from '../logic.js';
import { LessonEditor, MessageDialog, PaymentForm, StudentForm } from '../forms.jsx';
import { Avatar, Empty, Icon, go, openModal } from '../ui.jsx';
import { LessonCard } from './LessonCard.jsx';

export default function Dashboard() {
  const st = useStore();
  const cur = st.settings.currency;
  const t = today();
  const data = useMemo(() => {
    const idx = { students: indexById(st.students), groups: indexById(st.groups) };
    const fin = computeFinance(st);
    const occ = occurrences(st, addDays(t, -14), addDays(t, 1));
    const todays = occ.filter((l) => l.date === t);
    const tomorrow = occ.filter((l) => l.date === addDays(t, 1) && l.status !== 'cancelled');
    const unmarked = occ.filter((l) => l.date < t && l.status === 'planned');
    const ms = monthStart(t), me = monthEnd(t);
    const income = alive(st.payments).filter((p) => p.date >= ms && p.date <= me).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let earned = 0;
    for (const r of fin.values()) for (const c of r.charges) if (c.date >= ms && c.date <= me) earned += c.cost;
    const debtors = [...fin.entries()]
      .filter(([sid, r]) => r.balance < -0.5 && idx.students.get(sid))
      .map(([sid, r]) => ({ s: idx.students.get(sid), r }))
      .sort((a, b) => a.r.balance - b.r.balance);
    const active = alive(st.students).filter((s) => s.status === 'active' || s.status === 'trial').length;
    // Дни рождения в ближайшую неделю
    const bdays = alive(st.students).filter((s) => s.birthday && s.status !== 'left').map((s) => {
      for (let i = 0; i < 8; i++) {
        const d = addDays(t, i);
        if (d.slice(5) === s.birthday.slice(5)) return { s, d, age: Number(d.slice(0, 4)) - Number(s.birthday.slice(0, 4)) };
      }
      return null;
    }).filter(Boolean);
    return { idx, todays, tomorrow, unmarked, income, earned, debtors, active, bdays };
  }, [st, t]);

  const debtSum = data.debtors.reduce((s, d) => s - d.r.balance, 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = st.settings.teacherName ? ', ' + st.settings.teacherName.split(' ')[0] : '';
  const isEmpty = !alive(st.students).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{hello}{name}!</h1>
          <div className="page-sub">Сегодня {WD_LONG[weekday(t) - 1]}, {fmtDate(t)}</div>
        </div>
        <div className="page-actions hide-mobile">
          <button className="btn soft" onClick={() => openModal(<StudentForm />)}><Icon name="plus" size={18} />Ученик</button>
          <button className="btn soft" onClick={() => openModal(<PaymentForm />)}><Icon name="plus" size={18} />Оплата</button>
          <button className="btn primary" onClick={() => openModal(<LessonEditor preset={{ date: t }} />)}><Icon name="plus" size={18} />Занятие</button>
        </div>
      </div>

      <div className="quick-actions show-mobile">
        <button className="qa" onClick={() => openModal(<LessonEditor preset={{ date: t }} />)}><Icon name="calendar" /><span>Занятие</span></button>
        <button className="qa" onClick={() => openModal(<StudentForm />)}><Icon name="users" /><span>Ученик</span></button>
        <button className="qa" onClick={() => openModal(<PaymentForm />)}><Icon name="wallet" /><span>Оплата</span></button>
      </div>

      {isEmpty && (
        <div className="card welcome">
          <h2>Добро пожаловать! 👋</h2>
          <p>Это ваша CRM: ученики, расписание, посещаемость, домашние задания и оплаты в одном месте. Начните с добавления первого ученика.</p>
          <div className="row gap8 wrap">
            <button className="btn primary" onClick={() => openModal(<StudentForm />)}><Icon name="plus" size={18} />Добавить ученика</button>
            <button className="btn soft" onClick={() => go('/settings')}>Загрузить резервную копию</button>
          </div>
        </div>
      )}

      <div className="stats">
        <button className="stat" onClick={() => go('/schedule')}>
          <span className="stat-label">Занятий сегодня</span>
          <span className="stat-value">{data.todays.filter((l) => l.status !== 'cancelled').length}</span>
          <span className="stat-sub">завтра {data.tomorrow.length}</span>
        </button>
        <button className="stat" onClick={() => go('/payments')}>
          <span className="stat-label">Получено за {MONTHS[parse(t).getMonth()]}</span>
          <span className="stat-value">{fmtMoney(data.income, cur)}</span>
          <span className="stat-sub">проведено на {fmtMoney(data.earned, cur)}</span>
        </button>
        <button className={'stat' + (data.debtors.length ? ' warn' : '')} onClick={() => go('/students?filter=debt')}>
          <span className="stat-label">Должники</span>
          <span className="stat-value">{data.debtors.length}</span>
          <span className="stat-sub">{data.debtors.length ? 'на ' + fmtMoney(debtSum, cur) : 'всё оплачено'}</span>
        </button>
        <button className="stat" onClick={() => go('/students')}>
          <span className="stat-label">Активных учеников</span>
          <span className="stat-value">{data.active}</span>
          <span className="stat-sub">групп {alive(st.groups).length}</span>
        </button>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>Сегодня</h2>
            <button className="btn small soft" onClick={() => openModal(<LessonEditor preset={{ date: t }} />)}><Icon name="plus" size={16} />Занятие</button>
          </div>
          {data.todays.length ? (
            <div className="list">{data.todays.map((l) => <LessonCard key={l.id} lesson={l} idx={data.idx} />)}</div>
          ) : (
            <Empty icon="calendar" title="Сегодня занятий нет" text="Можно отдохнуть или добавить занятие" />
          )}
          {data.tomorrow.length > 0 && (
            <>
              <h3 className="sub-head">Завтра</h3>
              <div className="list">{data.tomorrow.map((l) => <LessonCard key={l.id} lesson={l} idx={data.idx} compact />)}</div>
            </>
          )}
        </section>

        <div className="col">
          {data.unmarked.length > 0 && (
            <section className="card attention">
              <div className="card-head">
                <h2><Icon name="alert" size={20} /> Не отмечены</h2>
                <span className="muted small">{data.unmarked.length} {plural(data.unmarked.length, 'занятие', 'занятия', 'занятий')}</span>
              </div>
              <p className="muted small mt0">Отметьте посещаемость, чтобы баланс учеников считался верно.</p>
              <div className="list">{data.unmarked.slice(0, 6).map((l) => <LessonCard key={l.id} lesson={l} idx={data.idx} showDate compact />)}</div>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Должники</h2>
              {data.debtors.length > 0 && <span className="money neg">{fmtMoney(-debtSum, cur)}</span>}
            </div>
            {data.debtors.length ? (
              <div className="list">
                {data.debtors.slice(0, 8).map(({ s, r }) => (
                  <div className="row-item" key={s.id}>
                    <button className="row-main" onClick={() => go('/students/' + s.id)}>
                      <Avatar name={s.name} id={s.id} size={36} />
                      <span className="grow ellipsis">{s.name}</span>
                      <span className="money neg">{fmtMoney(r.balance, cur)}</span>
                    </button>
                    <button className="icon-btn soft" title="Напомнить об оплате" aria-label="Напомнить об оплате"
                      onClick={() => openModal(<MessageDialog studentId={s.id} templateId="debt" />)}>
                      <Icon name="chat" size={20} />
                    </button>
                    <button className="icon-btn soft" title="Записать оплату" aria-label="Записать оплату"
                      onClick={() => openModal(<PaymentForm preset={{ studentId: s.id, amount: -Math.round(r.balance) }} />)}>
                      <Icon name="wallet" size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="wallet" title="Долгов нет" text="Все ученики оплатили занятия" />
            )}
          </section>

          {data.bdays.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>🎂 Дни рождения</h2></div>
              <div className="list">
                {data.bdays.map(({ s, d, age }) => (
                  <button className="row-main" key={s.id} onClick={() => go('/students/' + s.id)}>
                    <Avatar name={s.name} id={s.id} size={36} />
                    <span className="grow">{s.name}{age > 0 && age < 100 ? `, ${age}` : ''}</span>
                    <span className="muted">{d === t ? 'сегодня' : fmtDate(d)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

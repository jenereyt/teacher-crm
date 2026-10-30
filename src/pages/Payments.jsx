import { useMemo, useState } from 'react';
import { alive, useStore } from '../store.js';
import { addMonths, computeFinance, fmtDate, fmtMoney, fmtMonth, indexById, monthEnd, monthStart, plural, today } from '../logic.js';
import { MessageDialog, PaymentForm } from '../forms.jsx';
import { Avatar, Empty, Icon, PageHead, Segmented, go, openModal } from '../ui.jsx';

export default function Payments() {
  const st = useStore();
  const [month, setMonth] = useState(monthStart(today()));
  const [tab, setTab] = useState('history');
  const [who, setWho] = useState('');
  const cur = st.settings.currency;

  const data = useMemo(() => {
    const students = indexById(st.students);
    const fin = computeFinance(st);
    const me = monthEnd(month);
    const pays = alive(st.payments)
      .filter((p) => p.date >= month && p.date <= me && (!who || p.studentId === who))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const received = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let earned = 0, lessons = 0;
    for (const [sid, r] of fin) {
      if (who && sid !== who) continue;
      for (const c of r.charges) if (c.date >= month && c.date <= me) { earned += c.cost; lessons++; }
    }
    const balances = [...fin.entries()]
      .map(([sid, r]) => ({ s: students.get(sid), r }))
      .filter((x) => x.s && (x.s.status !== 'left' || Math.abs(x.r.balance) > 0.5))
      .sort((a, b) => a.r.balance - b.r.balance);
    const debt = balances.filter((x) => x.r.balance < -0.5).reduce((s, x) => s - x.r.balance, 0);
    return { students, pays, received, earned, lessons, balances, debt };
  }, [st, month, who]);

  return (
    <div className="page">
      <PageHead title="Оплаты">
        <button className="btn primary" onClick={() => openModal(<PaymentForm preset={who ? { studentId: who } : undefined} />)}><Icon name="plus" size={18} /><span className="hide-xs">Оплата</span></button>
      </PageHead>

      <div className="date-nav">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Предыдущий месяц"><Icon name="left" /></button>
        <div className="date-label cap">{fmtMonth(month)}</div>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Следующий месяц"><Icon name="right" /></button>
      </div>

      <div className="stats three">
        <div className="stat"><span className="stat-label">Получено</span><span className="stat-value pos">{fmtMoney(data.received, cur)}</span><span className="stat-sub">{data.pays.length} {plural(data.pays.length, 'оплата', 'оплаты', 'оплат')}</span></div>
        <div className="stat"><span className="stat-label">Проведено занятий на</span><span className="stat-value">{fmtMoney(data.earned, cur)}</span><span className="stat-sub">{data.lessons} {plural(data.lessons, 'занятие', 'занятия', 'занятий')}</span></div>
        <div className={'stat' + (data.debt ? ' warn' : '')}><span className="stat-label">Общий долг сейчас</span><span className="stat-value">{fmtMoney(data.debt, cur)}</span><span className="stat-sub">по всем ученикам</span></div>
      </div>

      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={[['history', 'История'], ['balances', 'Балансы']]} />
        {tab === 'history' && (
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Ученик">
            <option value="">Все ученики</option>
            {alive(st.students).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {tab === 'history' && (data.pays.length ? (
        <div className="card list p0">
          {data.pays.map((p) => {
            const s = data.students.get(p.studentId);
            return (
              <button key={p.id} className="student-row" onClick={() => openModal(<PaymentForm payment={p} />)}>
                <Avatar name={s?.name || '?'} id={p.studentId} size={40} />
                <span className="grow minw0">
                  <span className="sr-name">{s?.name || 'Удалённый ученик'}</span>
                  <span className="sr-sub">{fmtDate(p.date)} · {p.lessonsCount > 0 ? `абонемент ${p.lessonsCount} зан.` : p.method}{p.comment ? ' · ' + p.comment : ''}</span>
                </span>
                <span className="money pos">+{fmtMoney(p.amount, cur)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon="wallet" title="В этом месяце оплат нет" action={<button className="btn soft" onClick={() => openModal(<PaymentForm />)}><Icon name="plus" size={18} />Записать оплату</button>} />
      ))}

      {tab === 'balances' && (data.balances.length ? (
        <div className="card list p0">
          {data.balances.map(({ s, r }) => (
            <div key={s.id} className="student-row">
              <button className="row-main grow" onClick={() => go('/students/' + s.id)}>
                <Avatar name={s.name} id={s.id} size={40} />
                <span className="grow minw0">
                  <span className="sr-name">{s.name}</span>
                  <span className="sr-sub">оплачено {fmtMoney(r.paid, cur)} · занятий {r.lessonsDone}{r.pkgLeft ? ` · абонемент: ${r.pkgLeft}` : ''}</span>
                </span>
                <span className={'money ' + (r.balance < -0.5 ? 'neg' : r.balance > 0.5 ? 'pos' : '')}>{fmtMoney(r.balance, cur)}</span>
              </button>
              {r.balance < -0.5 && (
                <button className="icon-btn soft" aria-label="Напомнить" title="Напомнить об оплате" onClick={() => openModal(<MessageDialog studentId={s.id} templateId="debt" />)}>
                  <Icon name="chat" size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : <Empty icon="users" title="Учеников пока нет" />)}
    </div>
  );
}

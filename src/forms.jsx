import { useMemo, useState } from 'react';
import { alive, getState, remove, upsert, useStore } from './store.js';
import {
  ATTENDANCE, LESSON_STATUS, PAY_METHODS, STUDENT_STATUS, WD_SHORT, computeFinance, endTime, fillTemplate, fmtDate,
  fmtMoney, indexById, lessonStudentIds, occurrences, phoneDigits, today, addDays,
} from './logic.js';
import { Avatar, Field, Icon, Modal, PALETTE, Segmented, copyText, toast } from './ui.jsx';

const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));
const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

function confirmDel(text) {
  return window.confirm(text);
}

// ================= Ученик =================
export function StudentForm({ student, onClose, onSaved }) {
  const st = useStore();
  const groups = alive(st.groups).sort(byName);
  const [f, setF] = useState(() => ({
    name: '', status: 'active', level: '', subject: '', phone: '', contact: '', birthday: '', parentName: '',
    parentPhone: '', parentContact: '', price: '', startDate: today(), notes: '', ...student,
  }));
  const [groupIds, setGroupIds] = useState(() => groups.filter((g) => (g.studentIds || []).includes(student?.id)).map((g) => g.id));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function save() {
    if (!f.name.trim()) return alert('Введите имя ученика');
    const saved = upsert('students', { ...f, name: f.name.trim(), price: num(f.price) });
    for (const g of groups) {
      const has = (g.studentIds || []).includes(saved.id);
      const want = groupIds.includes(g.id);
      if (has !== want) upsert('groups', { id: g.id, studentIds: want ? [...(g.studentIds || []), saved.id] : g.studentIds.filter((x) => x !== saved.id) });
    }
    toast(student ? 'Сохранено' : 'Ученик добавлен');
    onSaved?.(saved);
    onClose();
  }
  function del() {
    if (!confirmDel(`Удалить ученика «${student.name}»? Его оплаты и отметки останутся в истории, но без имени. Обычно лучше поставить статус «Ушёл».`)) return;
    remove('students', student.id);
    for (const g of groups) if ((g.studentIds || []).includes(student.id)) upsert('groups', { id: g.id, studentIds: g.studentIds.filter((x) => x !== student.id) });
    for (const sc of alive(st.schedules)) if (sc.studentId === student.id) remove('schedules', sc.id);
    onClose();
    window.location.hash = '/students';
  }

  return (
    <Modal title={student ? 'Редактировать ученика' : 'Новый ученик'} onClose={onClose} wide
      footer={<>
        {student && <button className="btn danger ghost" onClick={del}><Icon name="trash" size={18} />Удалить</button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={save}>Сохранить</button>
      </>}>
      <div className="form-grid">
        <Field label="Имя и фамилия *" full><input value={f.name} onChange={set('name')} autoFocus={!student} placeholder="Например, Анна Петрова" /></Field>
        <Field label="Статус">
          <select value={f.status} onChange={set('status')}>
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Уровень / класс"><input value={f.level} onChange={set('level')} placeholder="A2, 7 класс…" /></Field>
        <Field label="Предмет"><input value={f.subject} onChange={set('subject')} placeholder="Английский" /></Field>
        <Field label={`Цена занятия, ${st.settings.currency}`} hint="Пусто — цена по умолчанию из настроек">
          <input type="number" inputMode="decimal" min="0" value={f.price} onChange={set('price')} placeholder={String(st.settings.defaultPrice)} />
        </Field>
        <Field label="Телефон ученика"><input type="tel" value={f.phone} onChange={set('phone')} placeholder="+7 900 000-00-00" /></Field>
        <Field label="Telegram / другой контакт"><input value={f.contact} onChange={set('contact')} placeholder="@username" /></Field>
        <Field label="День рождения"><input type="date" value={f.birthday} onChange={set('birthday')} /></Field>
        <Field label="Начало занятий"><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <div className="form-sep full">Родитель</div>
        <Field label="Имя родителя"><input value={f.parentName} onChange={set('parentName')} placeholder="Мария Ивановна" /></Field>
        <Field label="Телефон родителя"><input type="tel" value={f.parentPhone} onChange={set('parentPhone')} /></Field>
        <Field label="Telegram родителя" full><input value={f.parentContact} onChange={set('parentContact')} placeholder="@username" /></Field>
        {groups.length > 0 && (
          <Field label="Группы" full>
            <div className="chips">
              {groups.map((g) => (
                <button type="button" key={g.id} className={'chip' + (groupIds.includes(g.id) ? ' on' : '')}
                  onClick={() => setGroupIds(groupIds.includes(g.id) ? groupIds.filter((x) => x !== g.id) : [...groupIds, g.id])}>
                  {g.name}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Заметки" full><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Цели, особенности, что важно помнить" /></Field>
      </div>
    </Modal>
  );
}

// ================= Группа =================
export function GroupForm({ group, onClose }) {
  const st = useStore();
  const students = alive(st.students).filter((s) => s.status !== 'left' || (group?.studentIds || []).includes(s.id)).sort(byName);
  const [f, setF] = useState(() => ({ name: '', subject: '', level: '', price: '', color: PALETTE[0], notes: '', studentIds: [], ...group }));
  const [q, setQ] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (id) => setF({ ...f, studentIds: f.studentIds.includes(id) ? f.studentIds.filter((x) => x !== id) : [...f.studentIds, id] });

  function save() {
    if (!f.name.trim()) return alert('Введите название группы');
    upsert('groups', { ...f, name: f.name.trim(), price: num(f.price) });
    toast('Сохранено');
    onClose();
  }
  function del() {
    if (!confirmDel(`Удалить группу «${group.name}»? Регулярное расписание группы тоже удалится, проведённые занятия останутся.`)) return;
    remove('groups', group.id);
    for (const sc of alive(st.schedules)) if (sc.groupId === group.id) remove('schedules', sc.id);
    onClose();
    window.location.hash = '/groups';
  }
  const shown = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title={group ? 'Редактировать группу' : 'Новая группа'} onClose={onClose} wide
      footer={<>
        {group && <button className="btn danger ghost" onClick={del}><Icon name="trash" size={18} />Удалить</button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={save}>Сохранить</button>
      </>}>
      <div className="form-grid">
        <Field label="Название *" full><input value={f.name} onChange={set('name')} placeholder="Английский, 5 класс" /></Field>
        <Field label="Предмет"><input value={f.subject} onChange={set('subject')} /></Field>
        <Field label="Уровень"><input value={f.level} onChange={set('level')} /></Field>
        <Field label={`Цена занятия с ученика, ${st.settings.currency}`} hint="Пусто — цена из карточки ученика">
          <input type="number" inputMode="decimal" min="0" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="Цвет">
          <div className="colors">
            {PALETTE.map((c) => (
              <button type="button" key={c} className={'color-dot' + (f.color === c ? ' on' : '')} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label={`Ученики (${f.studentIds.length})`} full>
          {students.length > 6 && <input className="mb8" placeholder="Найти ученика" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="check-list">
            {shown.map((s) => (
              <button type="button" key={s.id} className={'check-row' + (f.studentIds.includes(s.id) ? ' on' : '')} onClick={() => toggle(s.id)}>
                <span className="checkbox">{f.studentIds.includes(s.id) && <Icon name="check" size={16} stroke={3} />}</span>
                <Avatar name={s.name} id={s.id} size={30} />
                <span>{s.name}</span>
              </button>
            ))}
            {!students.length && <div className="muted">Сначала добавьте учеников</div>}
          </div>
        </Field>
        <Field label="Заметки" full><textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

// Выбор «кто занимается»: ученик или группа
function WhoPicker({ value, onChange, st }) {
  const students = alive(st.students).filter((s) => s.status !== 'left').sort(byName);
  const groups = alive(st.groups).sort(byName);
  const mode = value.groupId ? 'group' : 'student';
  return (
    <>
      <Field label="Кто занимается" full>
        <Segmented value={mode} onChange={(m) => onChange(m === 'group' ? { groupId: groups[0]?.id || '', studentId: null } : { studentId: students[0]?.id || '', groupId: null })}
          options={[['student', 'Ученик'], ['group', 'Группа']]} />
      </Field>
      <Field label={mode === 'group' ? 'Группа' : 'Ученик'} full>
        {mode === 'group' ? (
          <select value={value.groupId || ''} onChange={(e) => onChange({ groupId: e.target.value, studentId: null })}>
            {!groups.length && <option value="">Нет групп</option>}
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        ) : (
          <select value={value.studentId || ''} onChange={(e) => onChange({ studentId: e.target.value, groupId: null })}>
            {!students.length && <option value="">Нет учеников</option>}
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </Field>
    </>
  );
}

// ================= Регулярное расписание =================
export function ScheduleForm({ schedule, preset, onClose }) {
  const st = useStore();
  const [f, setF] = useState(() => ({
    studentId: alive(st.students)[0]?.id || '', groupId: null, weekdays: [], time: '16:00',
    duration: st.settings.defaultDuration, startDate: today(), endDate: '', price: '', ...preset, ...schedule,
  }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleWd = (d) => setF({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() });

  function save() {
    if (!f.studentId && !f.groupId) return alert('Выберите ученика или группу');
    if (!f.weekdays.length) return alert('Выберите хотя бы один день недели');
    if (!f.time) return alert('Укажите время');
    upsert('schedules', { ...f, duration: Number(f.duration) || 60, price: num(f.price) });
    toast('Расписание сохранено');
    onClose();
  }
  function del() {
    if (!confirmDel('Удалить регулярное расписание? Будущие занятия из него исчезнут, проведённые останутся.')) return;
    remove('schedules', schedule.id);
    onClose();
  }

  return (
    <Modal title={schedule ? 'Регулярное занятие' : 'Новое регулярное занятие'} onClose={onClose}
      footer={<>
        {schedule && <button className="btn danger ghost" onClick={del}><Icon name="trash" size={18} />Удалить</button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={save}>Сохранить</button>
      </>}>
      <div className="form-grid">
        <WhoPicker st={st} value={f} onChange={(v) => setF({ ...f, ...v })} />
        <Field label="Дни недели" full>
          <div className="chips wd">
            {WD_SHORT.map((w, i) => (
              <button type="button" key={w} className={'chip' + (f.weekdays.includes(i + 1) ? ' on' : '')} onClick={() => toggleWd(i + 1)}>{w}</button>
            ))}
          </div>
        </Field>
        <Field label="Время"><input type="time" value={f.time} onChange={set('time')} /></Field>
        <Field label="Длительность, мин"><input type="number" inputMode="numeric" min="5" step="5" value={f.duration} onChange={set('duration')} /></Field>
        <Field label="С какого числа"><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="По какое (необязательно)"><input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label={`Цена, ${st.settings.currency}`} hint="Пусто — цена ученика или группы" full>
          <input type="number" inputMode="decimal" min="0" value={f.price} onChange={set('price')} />
        </Field>
      </div>
    </Modal>
  );
}

// ================= Занятие: посещаемость, ДЗ, оценки =================
export function LessonEditor({ lesson, preset, onClose }) {
  const st = useStore();
  const idx = useMemo(() => ({ students: indexById(st.students), groups: indexById(st.groups) }), [st]);
  const isNew = !lesson;
  const [f, setF] = useState(() => ({
    date: today(), time: '16:00', duration: st.settings.defaultDuration, studentId: alive(st.students)[0]?.id || '',
    groupId: null, topic: '', status: 'planned', price: '', attendance: {}, grades: {}, hwDone: {}, homework: '', notes: '',
    ...preset, ...lesson,
  }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sids = lessonStudentIds(f, idx.groups);

  function setAtt(sid, v) {
    const attendance = { ...f.attendance, [sid]: f.attendance[sid] === v ? undefined : v };
    setF({ ...f, attendance, status: f.status === 'planned' && v ? 'done' : f.status });
  }
  function allPresent() {
    const attendance = { ...f.attendance };
    for (const sid of sids) if (!attendance[sid]) attendance[sid] = 'present';
    setF({ ...f, attendance, status: 'done' });
  }

  function save(extra = {}) {
    if (!f.studentId && !f.groupId) return alert('Выберите ученика или группу');
    const rec = { ...f, ...extra, duration: Number(f.duration) || 60, price: num(f.price) };
    delete rec.virtual;
    if (lesson?.virtual) delete rec.id;
    if (rec.status === 'done') rec.studentIds = sids;
    upsert('lessons', rec);
    toast(rec.status === 'done' ? 'Занятие отмечено' : 'Сохранено');
    onClose();
  }
  function del() {
    if (lesson?.virtual || lesson?.scheduleId) {
      if (!confirmDel('Это занятие из регулярного расписания. Отметить его как отменённое?')) return;
      return save({ status: 'cancelled' });
    }
    if (!confirmDel('Удалить занятие?')) return;
    remove('lessons', lesson.id);
    onClose();
  }

  const title = isNew ? 'Новое занятие' : f.groupId ? idx.groups.get(f.groupId)?.name || 'Занятие' : idx.students.get(f.studentId)?.name || 'Занятие';

  return (
    <Modal title={title} onClose={onClose} wide
      footer={<>
        {!isNew && <button className="btn danger ghost" onClick={del}><Icon name="trash" size={18} /><span className="hide-xs">{lesson?.scheduleId ? 'Отменить' : 'Удалить'}</span></button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
        <button className="btn primary" onClick={() => save()}>Сохранить</button>
      </>}>
      <div className="form-grid">
        {isNew || !lesson?.scheduleId ? <WhoPicker st={st} value={f} onChange={(v) => setF({ ...f, ...v, attendance: {}, grades: {}, hwDone: {} })} /> : (
          <div className="full muted small"><Icon name="repeat" size={16} /> Из регулярного расписания{lesson.origDate !== f.date ? `, перенесено с ${fmtDate(lesson.origDate)}` : ''}</div>
        )}
        <Field label="Дата"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Время"><input type="time" value={f.time} onChange={set('time')} /></Field>
        <Field label="Длительность, мин"><input type="number" inputMode="numeric" min="5" step="5" value={f.duration} onChange={set('duration')} /></Field>
        <Field label={`Цена, ${st.settings.currency}`} hint="Пусто — обычная цена">
          <input type="number" inputMode="decimal" min="0" value={f.price ?? ''} onChange={set('price')} />
        </Field>
        <Field label="Статус" full>
          <Segmented value={f.status} onChange={(v) => setF({ ...f, status: v })} options={Object.entries(LESSON_STATUS)} />
        </Field>
        <Field label="Тема занятия" full><input value={f.topic} onChange={set('topic')} placeholder="Present Perfect, дроби…" /></Field>

        <div className="form-sep full row-between">
          <span>Посещаемость и оценки</span>
          {sids.length > 0 && <button type="button" className="btn small soft" onClick={allPresent}><Icon name="check" size={16} />Все были</button>}
        </div>
        <div className="full att-list">
          {!sids.length && <div className="muted">В группе пока нет учеников</div>}
          {sids.map((sid) => {
            const s = idx.students.get(sid);
            return (
              <div className="att-row" key={sid}>
                <div className="att-name"><Avatar name={s?.name || '?'} id={sid} size={32} /><span>{s?.name || 'Удалён'}</span></div>
                <div className="att-btns">
                  {Object.entries(ATTENDANCE).map(([k, v]) => (
                    <button type="button" key={k} className={`att-btn att-${v.color}` + (f.attendance[sid] === k ? ' on' : '')} onClick={() => setAtt(sid, k)} title={v.label}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="att-extra">
                  <input className="grade" value={f.grades[sid] || ''} onChange={(e) => setF({ ...f, grades: { ...f.grades, [sid]: e.target.value } })} placeholder="Оценка" aria-label="Оценка" />
                  <button type="button" className={'check-row compact' + (f.hwDone[sid] ? ' on' : '')} onClick={() => setF({ ...f, hwDone: { ...f.hwDone, [sid]: !f.hwDone[sid] } })}>
                    <span className="checkbox">{f.hwDone[sid] && <Icon name="check" size={14} stroke={3} />}</span>ДЗ сделано
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Field label="Домашнее задание (на следующий раз)" full><textarea rows={2} value={f.homework} onChange={set('homework')} placeholder="Упр. 5–7 стр. 34" /></Field>
        <Field label="Заметки" full><textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

// ================= Оплата =================
export function PaymentForm({ payment, preset, onClose }) {
  const st = useStore();
  const students = alive(st.students).sort(byName);
  const [f, setF] = useState(() => ({
    studentId: students[0]?.id || '', date: today(), amount: '', method: PAY_METHODS[0], lessonsCount: '', comment: '', ...preset, ...payment,
  }));
  const [pkg, setPkg] = useState(Number(f.lessonsCount) > 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = students.find((x) => x.id === f.studentId);
  const price = s && s.price !== '' && s.price != null ? Number(s.price) : Number(st.settings.defaultPrice);

  function save() {
    if (!f.studentId) return alert('Выберите ученика');
    if (!(Number(f.amount) > 0)) return alert('Введите сумму');
    if (pkg && !(Number(f.lessonsCount) > 0)) return alert('Укажите, сколько занятий в абонементе');
    upsert('payments', { ...f, amount: Number(f.amount), lessonsCount: pkg ? Number(f.lessonsCount) : 0 });
    toast('Оплата записана');
    onClose();
  }
  function del() {
    if (!confirmDel('Удалить эту оплату?')) return;
    remove('payments', payment.id);
    onClose();
  }

  return (
    <Modal title={payment ? 'Оплата' : 'Новая оплата'} onClose={onClose}
      footer={<>
        {payment && <button className="btn danger ghost" onClick={del}><Icon name="trash" size={18} />Удалить</button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={save}>Сохранить</button>
      </>}>
      <div className="form-grid">
        <Field label="Ученик" full>
          <select value={f.studentId} onChange={set('studentId')}>
            {!students.length && <option value="">Нет учеников</option>}
            {students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Тип оплаты" full>
          <Segmented value={pkg ? 'pkg' : 'one'} onChange={(v) => setPkg(v === 'pkg')} options={[['one', 'Разовая / на баланс'], ['pkg', 'Абонемент']]} />
        </Field>
        {pkg && (
          <Field label="Занятий в абонементе" full>
            <div className="row gap8">
              <input type="number" inputMode="numeric" min="1" value={f.lessonsCount} onChange={(e) => setF({ ...f, lessonsCount: e.target.value, amount: f.amount || '' })} />
              {[4, 8, 12].map((n) => (
                <button type="button" key={n} className="chip" onClick={() => setF({ ...f, lessonsCount: n, amount: n * price })}>{n}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label={`Сумма, ${st.settings.currency} *`}>
          <input type="number" inputMode="decimal" min="0" value={f.amount} onChange={set('amount')} autoFocus={!payment} />
        </Field>
        <Field label="Дата"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Способ" full>
          <div className="chips">
            {PAY_METHODS.map((m) => <button type="button" key={m} className={'chip' + (f.method === m ? ' on' : '')} onClick={() => setF({ ...f, method: m })}>{m}</button>)}
          </div>
        </Field>
        <Field label="Комментарий" full><input value={f.comment} onChange={set('comment')} /></Field>
      </div>
    </Modal>
  );
}

// ================= Сообщение родителю / ученику =================
export function MessageDialog({ studentId, templateId = 'lesson', lesson, onClose }) {
  const st = getState();
  const s = st.students.find((x) => x.id === studentId);
  const fin = computeFinance(st).get(studentId);
  const templates = st.settings.templates;
  const [tid, setTid] = useState(templateId);
  const [to, setTo] = useState(s?.parentPhone || s?.parentContact ? 'parent' : 'student');

  const next = useMemo(() => {
    if (lesson) return lesson;
    const idx = indexById(st.groups);
    return occurrences(st, today(), addDays(today(), 30)).find((l) => l.status !== 'cancelled' && lessonStudentIds(l, idx).includes(studentId));
  }, [studentId, lesson]);
  const lastHw = useMemo(() => {
    const idx = indexById(st.groups);
    return alive(st.lessons).filter((l) => l.homework && lessonStudentIds(l, idx).includes(studentId)).sort((a, b) => b.date.localeCompare(a.date))[0]?.homework || '';
  }, [studentId]);

  const tpl = templates.find((t) => t.id === tid) || templates[0];
  const vars = {
    ученик: s?.name.split(' ')[0] || '',
    'ученик полностью': s?.name || '',
    родитель: s?.parentName || '',
    дата: next ? fmtDate(next.date, true) : '',
    время: next?.time || '',
    сумма: fin && fin.balance < 0 ? fmtMoney(-fin.balance, st.settings.currency) : fmtMoney(0, st.settings.currency),
    баланс: fin ? fmtMoney(fin.balance, st.settings.currency) : '',
    дз: lesson?.homework || lastHw || '—',
    преподаватель: st.settings.teacherName || '',
  };
  const [text, setText] = useState(() => fillTemplate(tpl.text, vars));
  const pick = (id) => {
    setTid(id);
    setText(fillTemplate((templates.find((t) => t.id === id) || tpl).text, vars));
  };

  const phone = phoneDigits(to === 'parent' ? s?.parentPhone : s?.phone);
  const tg = (to === 'parent' ? s?.parentContact : s?.contact) || '';
  const tgUser = tg.trim().startsWith('@') ? tg.trim().slice(1) : /t\.me\//.test(tg) ? tg.split('t.me/')[1] : '';
  const enc = encodeURIComponent(text);

  return (
    <Modal title="Сообщение" onClose={onClose}>
      <div className="form-grid">
        <Field label="Кому" full>
          <Segmented value={to} onChange={setTo} options={[['parent', 'Родителю'], ['student', 'Ученику']]} />
        </Field>
        <Field label="Шаблон" full>
          <div className="chips">
            {templates.map((t) => <button type="button" key={t.id} className={'chip' + (tid === t.id ? ' on' : '')} onClick={() => pick(t.id)}>{t.title}</button>)}
          </div>
        </Field>
        <Field label="Текст" full><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="full send-grid">
          <a className={'btn wa' + (phone ? '' : ' disabled')} href={phone ? `https://wa.me/${phone}?text=${enc}` : undefined} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn tg" href={tgUser ? `https://t.me/${tgUser}` : `https://t.me/share/url?url=%20&text=${enc}`} target="_blank" rel="noreferrer"
            onClick={() => tgUser && copyText(text)}>Telegram</a>
          <a className={'btn soft' + (phone ? '' : ' disabled')} href={phone ? `sms:+${phone}?body=${enc}` : undefined}>SMS</a>
          <button className="btn soft" onClick={() => copyText(text)}>Копировать</button>
        </div>
        {!phone && <div className="full muted small">Чтобы открыть WhatsApp или SMS, добавьте телефон в карточку ученика.</div>}
        {tgUser && <div className="full muted small">Кнопка Telegram скопирует текст и откроет чат с @{tgUser} — останется только вставить его.</div>}
      </div>
    </Modal>
  );
}

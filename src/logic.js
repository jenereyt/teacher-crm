// Даты, расписание, расчёт баланса учеников
import { alive } from './store.js';

// ---------- Даты (строки вида 2026-10-30) ----------
const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => toStr(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
// День недели: 1 = понедельник … 7 = воскресенье
export const weekday = (s) => ((parse(s).getDay() + 6) % 7) + 1;
export const weekStart = (s) => addDays(s, 1 - weekday(s));
export const monthStart = (s) => s.slice(0, 8) + '01';
export const monthEnd = (s) => {
  const d = parse(monthStart(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toStr(d);
};
export const addMonths = (s, n) => {
  const d = parse(monthStart(s));
  d.setMonth(d.getMonth() + n);
  return toStr(d);
};

export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const fmtDate = (s, withWd = false) => {
  if (!s) return '';
  const d = parse(s);
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return withWd ? `${WD_SHORT[weekday(s) - 1]}, ${base}${y}` : base + y;
};
export const fmtMonth = (s) => {
  const d = parse(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const relDay = (s) => {
  const t = today();
  if (s === t) return 'Сегодня';
  if (s === addDays(t, 1)) return 'Завтра';
  if (s === addDays(t, -1)) return 'Вчера';
  return fmtDate(s, true);
};
export const endTime = (time, dur) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + Number(dur || 0);
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
};

export function fmtMoney(n, cur = '₽') {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('ru-RU')} ${cur}`;
}

// ---------- Справочники ----------
export const STUDENT_STATUS = {
  active: { label: 'Занимается', color: 'green' },
  trial: { label: 'Пробный', color: 'blue' },
  paused: { label: 'Пауза', color: 'amber' },
  left: { label: 'Ушёл', color: 'gray' },
};
export const ATTENDANCE = {
  present: { label: 'Был', short: '✓', color: 'green' },
  late: { label: 'Опоздал', short: '⏱', color: 'amber' },
  absent: { label: 'Не был', short: '✗', color: 'red' },
  excused: { label: 'Уважит.', short: 'У', color: 'gray' },
};
export const LESSON_STATUS = {
  planned: 'Запланировано',
  done: 'Проведено',
  cancelled: 'Отменено',
};
export const PAY_METHODS = ['Наличные', 'Перевод', 'Карта', 'Другое'];

export function indexById(list) {
  const m = new Map();
  for (const r of list) if (!r.deleted) m.set(r.id, r);
  return m;
}

// Участники занятия: у проведённых — снимок, у остальных — текущий состав группы
export function lessonStudentIds(lesson, groups) {
  if (lesson.studentIds && lesson.studentIds.length) return lesson.studentIds;
  if (lesson.studentId) return [lesson.studentId];
  if (lesson.groupId) {
    const g = groups.get ? groups.get(lesson.groupId) : groups.find((x) => x.id === lesson.groupId);
    return g ? g.studentIds || [] : [];
  }
  return [];
}

export function lessonTitle(lesson, students, groups) {
  if (lesson.groupId) return groups.get(lesson.groupId)?.name || 'Группа удалена';
  if (lesson.studentId) return students.get(lesson.studentId)?.name || 'Ученик удалён';
  return lesson.topic || 'Занятие';
}

// ---------- Расписание: реальные занятия + виртуальные из регулярного расписания ----------
export function occurrences(state, from, to) {
  const lessons = alive(state.lessons).filter((l) => l.date >= from && l.date <= to);
  const taken = new Set(alive(state.lessons).filter((l) => l.scheduleId).map((l) => l.scheduleId + '|' + l.origDate));
  const out = [...lessons];
  for (const sc of alive(state.schedules)) {
    if (!sc.weekdays?.length) continue;
    let d = from < sc.startDate ? sc.startDate : from;
    const end = sc.endDate && sc.endDate < to ? sc.endDate : to;
    for (; d <= end; d = addDays(d, 1)) {
      if (!sc.weekdays.includes(weekday(d))) continue;
      if (taken.has(sc.id + '|' + d)) continue;
      out.push({
        id: `v:${sc.id}:${d}`,
        virtual: true,
        scheduleId: sc.id,
        origDate: d,
        date: d,
        time: sc.time,
        duration: sc.duration,
        studentId: sc.studentId || null,
        groupId: sc.groupId || null,
        price: sc.price ?? null,
        status: 'planned',
        attendance: {},
      });
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

// ---------- Деньги ----------
export function priceFor(lesson, sid, state, idx) {
  if (lesson.price !== null && lesson.price !== undefined && lesson.price !== '') return Number(lesson.price);
  if (lesson.groupId) {
    const g = idx.groups.get(lesson.groupId);
    if (g && g.price !== '' && g.price != null) return Number(g.price);
  }
  const st = idx.students.get(sid);
  if (st && st.price !== '' && st.price != null) return Number(st.price);
  return Number(state.settings.defaultPrice) || 0;
}

export function isCharged(att, settings) {
  return att === 'present' || att === 'late' || (att === 'absent' && settings.chargeAbsent);
}

// Финансы всех учеников разом: баланс, списания, остаток абонемента
export function computeFinance(state) {
  const idx = { students: indexById(state.students), groups: indexById(state.groups) };
  const res = new Map();
  for (const s of idx.students.values()) res.set(s.id, { paid: 0, charged: 0, balance: 0, charges: [], pkgLeft: 0, lessonsDone: 0 });

  const charges = [];
  for (const l of alive(state.lessons)) {
    if (l.status !== 'done') continue;
    for (const sid of lessonStudentIds(l, idx.groups)) {
      if (!res.has(sid)) continue;
      const att = l.attendance?.[sid];
      if (!isCharged(att, state.settings)) continue;
      charges.push({ sid, lessonId: l.id, date: l.date, time: l.time || '', price: priceFor(l, sid, state, idx) });
    }
  }
  charges.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // Абонементы: пакеты занятий, списываются по порядку покупки
  const pkgs = new Map();
  for (const p of alive(state.payments)) {
    const r = res.get(p.studentId);
    if (!r) continue;
    r.paid += Number(p.amount) || 0;
    if (Number(p.lessonsCount) > 0) {
      if (!pkgs.has(p.studentId)) pkgs.set(p.studentId, []);
      pkgs.get(p.studentId).push({ date: p.date, left: Number(p.lessonsCount), unit: (Number(p.amount) || 0) / Number(p.lessonsCount) });
    }
  }
  for (const list of pkgs.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  for (const c of charges) {
    const r = res.get(c.sid);
    const pk = (pkgs.get(c.sid) || []).find((p) => p.left > 0 && p.date <= c.date);
    let cost = c.price;
    if (pk) {
      pk.left -= 1;
      cost = pk.unit;
      c.fromPackage = true;
    }
    c.cost = cost;
    r.charged += cost;
    r.lessonsDone += 1;
    r.charges.push(c);
  }
  for (const [sid, list] of pkgs) res.get(sid).pkgLeft = list.reduce((s, p) => s + p.left, 0);
  for (const r of res.values()) r.balance = r.paid - r.charged;
  return res;
}

// Только цифры в международном формате: «8 900…» (Россия) → «7900…»
export function phoneDigits(p) {
  const d = (p || '').replace(/[^\d]/g, '');
  return d.length === 11 && d[0] === '8' ? '7' + d.slice(1) : d;
}

export function fillTemplate(text, vars) {
  return text.replace(/\{([^}]+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)).replace(/\s+([!.,])/g, '$1').trim();
}

// Склонение: 1 занятие, 2 занятия, 5 занятий
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

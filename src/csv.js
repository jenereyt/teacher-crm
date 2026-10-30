// CSV для Excel: разделитель «;» и BOM, чтобы кириллица открывалась правильно
import { alive, getState, upsert } from './store.js';
import { ATTENDANCE, LESSON_STATUS, STUDENT_STATUS, computeFinance, indexById, lessonStudentIds } from './logic.js';

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');

const STUDENT_COLS = [
  ['name', 'Имя'], ['status', 'Статус'], ['level', 'Уровень'], ['subject', 'Предмет'], ['phone', 'Телефон'], ['contact', 'Telegram'],
  ['parentName', 'Родитель'], ['parentPhone', 'Телефон родителя'], ['parentContact', 'Telegram родителя'], ['birthday', 'День рождения'],
  ['startDate', 'Начало занятий'], ['price', 'Цена'], ['notes', 'Заметки'],
];

export function studentsCsv() {
  const st = getState();
  const fin = computeFinance(st);
  const rows = [[...STUDENT_COLS.map((c) => c[1]), 'Баланс', 'Группы']];
  const groups = alive(st.groups);
  for (const s of alive(st.students)) {
    rows.push([
      ...STUDENT_COLS.map(([k]) => (k === 'status' ? STUDENT_STATUS[s.status]?.label || s.status : s[k])),
      Math.round(fin.get(s.id)?.balance || 0),
      groups.filter((g) => (g.studentIds || []).includes(s.id)).map((g) => g.name).join(', '),
    ]);
  }
  return toCsv(rows);
}

export function paymentsCsv() {
  const st = getState();
  const students = indexById(st.students);
  const rows = [['Дата', 'Ученик', 'Сумма', 'Способ', 'Занятий в абонементе', 'Комментарий']];
  for (const p of alive(st.payments).sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([p.date, students.get(p.studentId)?.name || '', p.amount, p.method, p.lessonsCount || '', p.comment]);
  return toCsv(rows);
}

export function lessonsCsv() {
  const st = getState();
  const students = indexById(st.students);
  const groups = indexById(st.groups);
  const rows = [['Дата', 'Время', 'Минут', 'Группа', 'Ученик', 'Статус', 'Посещение', 'Оценка', 'ДЗ сделано', 'Тема', 'Домашнее задание']];
  for (const l of alive(st.lessons).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    for (const sid of lessonStudentIds(l, groups)) {
      rows.push([
        l.date, l.time, l.duration, l.groupId ? groups.get(l.groupId)?.name || '' : '', students.get(sid)?.name || '',
        LESSON_STATUS[l.status], ATTENDANCE[l.attendance?.[sid]]?.label || '', l.grades?.[sid] || '', l.hwDone?.[sid] ? 'да' : '', l.topic, l.homework,
      ]);
    }
  }
  return toCsv(rows);
}

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Импорт учеников из таблицы: первая строка — заголовки (как в экспорте)
export function importStudentsCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('В файле нет строк с учениками');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [k, label] of STUDENT_COLS) {
    const i = head.indexOf(label.toLowerCase());
    if (i >= 0) col[k] = i;
  }
  if (col.name === undefined) {
    const i = head.findIndex((h) => /имя|фио|name/.test(h));
    if (i < 0) throw new Error('Не найдена колонка «Имя»');
    col.name = i;
  }
  const statusByLabel = Object.fromEntries(Object.entries(STUDENT_STATUS).map(([k, v]) => [v.label.toLowerCase(), k]));
  const existing = new Set(alive(getState().students).map((s) => s.name.trim().toLowerCase()));
  let added = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const rec = {};
    for (const [k, i] of Object.entries(col)) rec[k] = (r[i] || '').trim();
    if (!rec.name) continue;
    if (existing.has(rec.name.toLowerCase())) { skipped++; continue; }
    rec.status = statusByLabel[(rec.status || '').toLowerCase()] || 'active';
    rec.price = rec.price ? Number(rec.price.replace(/\s/g, '').replace(',', '.')) || '' : '';
    upsert('students', rec);
    existing.add(rec.name.toLowerCase());
    added++;
  }
  return { added, skipped };
}

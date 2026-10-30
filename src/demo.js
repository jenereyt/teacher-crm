// Пример данных, чтобы посмотреть, как всё работает
import { mergeIn, uid } from './store.js';
import { addDays, today, weekStart, occurrences } from './logic.js';

export function loadDemo() {
  const now = Date.now();
  const t = today();
  const rec = (o) => ({ id: uid(), createdAt: now, updatedAt: now, ...o });
  const S = [
    rec({ name: 'Анна Петрова', status: 'active', level: 'B1', subject: 'Английский', phone: '+7 900 111-22-33', parentName: 'Ольга Петровна', parentPhone: '+7 900 111-00-00', parentContact: '@olga_p', price: 1500, birthday: addDays(t, 3).replace(/^\d{4}/, '2012'), startDate: addDays(t, -90), notes: 'Готовится к ОГЭ, любит грамматику' }),
    rec({ name: 'Максим Иванов', status: 'active', level: 'A2', subject: 'Английский', phone: '+7 901 222-33-44', parentName: 'Ирина', parentPhone: '+7 901 222-00-00', price: 1200, startDate: addDays(t, -60), notes: '' }),
    rec({ name: 'София Смирнова', status: 'active', level: '5 класс', subject: 'Английский', parentName: 'Елена', parentPhone: '+7 902 333-00-00', price: '', startDate: addDays(t, -45) }),
    rec({ name: 'Тимур Каримов', status: 'active', level: '5 класс', subject: 'Английский', parentName: 'Рустам', parentPhone: '+7 903 444-00-00', price: '', startDate: addDays(t, -45) }),
    rec({ name: 'Ева Кузнецова', status: 'trial', level: 'A1', subject: 'Английский', parentName: 'Наталья', parentPhone: '+7 904 555-00-00', price: 1000, startDate: addDays(t, -7) }),
    rec({ name: 'Даниил Орлов', status: 'paused', level: 'B2', subject: 'Английский', phone: '+7 905 666-77-88', price: 1800, startDate: addDays(t, -200), notes: 'Пауза до конца сессии' }),
  ];
  const G = [rec({ name: 'Английский, 5 класс', subject: 'Английский', level: '5 класс', price: 800, color: '#10b981', studentIds: [S[2].id, S[3].id, S[1].id] })];
  const ws = weekStart(t);
  const SC = [
    rec({ studentId: S[0].id, groupId: null, weekdays: [1, 4], time: '16:00', duration: 60, startDate: addDays(t, -21), endDate: '', price: '' }),
    rec({ studentId: null, groupId: G[0].id, weekdays: [2, 5], time: '17:30', duration: 90, startDate: addDays(t, -21), endDate: '', price: '' }),
    rec({ studentId: S[4].id, groupId: null, weekdays: [3], time: '15:00', duration: 45, startDate: addDays(ws, -7), endDate: '', price: '' }),
  ];
  // Проводим прошедшие занятия последних трёх недель
  const L = [];
  const topics = ['Present Simple', 'Past Simple', 'Неправильные глаголы', 'Чтение текста', 'Словарный диктант', 'Future forms'];
  const occ = occurrences({ lessons: [], schedules: SC, students: S, groups: G }, addDays(t, -21), addDays(t, -1));
  occ.forEach((o, i) => {
    const sids = o.groupId ? G[0].studentIds : [o.studentId];
    const attendance = {}, grades = {}, hwDone = {};
    sids.forEach((sid, j) => {
      attendance[sid] = (i + j) % 7 === 3 ? 'absent' : (i + j) % 9 === 4 ? 'late' : 'present';
      if ((i + j) % 2 === 0) grades[sid] = String(3 + ((i + j) % 3));
      hwDone[sid] = (i + j) % 4 !== 1;
    });
    const isLastUnmarked = o.date === addDays(t, -1) || (i === occ.length - 1);
    L.push(rec({
      scheduleId: o.scheduleId, origDate: o.date, date: o.date, time: o.time, duration: o.duration, studentId: o.studentId, groupId: o.groupId,
      price: null, status: isLastUnmarked ? 'planned' : 'done', studentIds: sids, attendance: isLastUnmarked ? {} : attendance,
      grades: isLastUnmarked ? {} : grades, hwDone: isLastUnmarked ? {} : hwDone, topic: topics[i % topics.length], homework: isLastUnmarked ? '' : `Упр. ${i + 3}–${i + 5}, стр. ${20 + i}`, notes: '',
    }));
  });
  L.push(rec({ date: t, time: '19:00', duration: 60, studentId: S[5].id, groupId: null, price: '', status: 'planned', attendance: {}, grades: {}, hwDone: {}, topic: 'Разговорная практика', homework: '', notes: 'Разовое занятие' }));
  const P = [
    rec({ studentId: S[0].id, date: addDays(t, -20), amount: 12000, method: 'Перевод', lessonsCount: 8, comment: 'Абонемент' }),
    rec({ studentId: S[1].id, date: addDays(t, -14), amount: 2400, method: 'Наличные', lessonsCount: 0, comment: '' }),
    rec({ studentId: S[2].id, date: addDays(t, -10), amount: 4000, method: 'Перевод', lessonsCount: 0, comment: '' }),
    rec({ studentId: S[3].id, date: addDays(t, -3), amount: 1600, method: 'Карта', lessonsCount: 0, comment: '' }),
  ];
  mergeIn({ students: S, groups: G, schedules: SC, lessons: L, payments: P });
}

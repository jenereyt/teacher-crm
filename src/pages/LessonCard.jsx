import { ATTENDANCE, endTime, lessonStudentIds, lessonTitle, relDay } from '../logic.js';
import { LessonEditor } from '../forms.jsx';
import { Badge, Icon, openModal } from '../ui.jsx';

export function LessonCard({ lesson: l, idx, showDate, compact }) {
  const sids = lessonStudentIds(l, idx.groups);
  const color = l.groupId ? idx.groups.get(l.groupId)?.color : null;
  const att = Object.values(l.attendance || {}).filter(Boolean);
  const present = att.filter((a) => a === 'present' || a === 'late').length;
  const title = lessonTitle(l, idx.students, idx.groups);
  return (
    <button className={`lesson-card st-${l.status}` + (compact ? ' compact' : '')} style={color ? { '--accent': color } : undefined}
      onClick={() => openModal(<LessonEditor lesson={l} />)}>
      <div className="lc-time">
        <b>{l.time || '—'}</b>
        {!compact && <span>{endTime(l.time, l.duration)}</span>}
      </div>
      <div className="lc-main">
        <div className="lc-title">
          {l.groupId && <Icon name="group" size={16} />} {title}
        </div>
        <div className="lc-sub">
          {showDate && <span>{relDay(l.date)}</span>}
          {l.topic && <span>{l.topic}</span>}
          {l.groupId && <span>{sids.length} уч.</span>}
          {l.scheduleId && <Icon name="repeat" size={13} />}
        </div>
      </div>
      <div className="lc-status">
        {l.status === 'done' && (
          sids.length === 1 && l.attendance?.[sids[0]]
            ? <Badge color={ATTENDANCE[l.attendance[sids[0]]].color}>{ATTENDANCE[l.attendance[sids[0]]].label}</Badge>
            : <Badge color="green">{present}/{sids.length}</Badge>
        )}
        {l.status === 'cancelled' && <Badge color="gray">Отменено</Badge>}
        {l.status === 'planned' && <span className="lc-mark">Отметить</span>}
      </div>
    </button>
  );
}

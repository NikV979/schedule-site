// ========== ЭКРАНИРОВАНИЕ HTML ==========
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rememberPage(page) {
  try { localStorage.setItem('r144s-page', page); } catch (_) {}
}

// ========== КОНСТАНТЫ ДАТ ==========
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAY_NAMES_FULL = ['ВОСКРЕСЕНЬЕ','ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА'];
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ========== ФУНКЦИИ ДАТ ==========
function getMonday(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}
function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}
function getRangeString(monday) {
  const sat = addDays(monday, 5);
  return `${formatDate(monday)} – ${formatDate(sat)}`;
}
function isSunday() { return new Date().getDay() === 0; }
function getTodayDate() { const t = new Date(); t.setHours(0,0,0,0); return t; }
function isMobileLayout() { return window.matchMedia('(max-width: 900px)').matches; }

// ========== НЕДЕЛИ ==========
const BASE_MONDAY = new Date(2026, 8, 14);
const BASE_IS_ODD = true;
const MIN_MONDAY = new Date(2026, 7, 31);
const MAX_MONDAY = new Date(2026, 11, 28);

function isOddWeek(date) {
  const monday = getMonday(date);
  const ms = monday - BASE_MONDAY;
  const weeks = Math.round(ms / (7 * 24 * 60 * 60 * 1000));
  return (weeks % 2 === 0) ? BASE_IS_ODD : !BASE_IS_ODD;
}
function getReferenceDate() {
  const today = new Date();
  if (today.getDay() === 0) return addDays(today, 1);
  return today;
}
function getBaseMonday() { return getMonday(getReferenceDate()); }
function getCurrentMonday() { return addDays(getBaseMonday(), state.weekOffset * 7); }
function getCurrentType() { return isOddWeek(getCurrentMonday()) ? 'odd' : 'even'; }
function canNavigateTo(offset) {
  const monday = addDays(getBaseMonday(), offset * 7);
  const t = monday.getTime();
  return t >= MIN_MONDAY.getTime() && t <= MAX_MONDAY.getTime();
}
function saveWeekOffset() { localStorage.setItem('schedule-week-offset', String(state.weekOffset)); }

// ========== ЗВОНКИ ==========
const PAIRS = [
  { num: 1, start: '09:00', end: '10:30', break: 20 },
  { num: 2, start: '10:50', end: '12:20', break: 20 },
  { num: 3, start: '12:40', end: '14:10', break: 45 },
  { num: 4, start: '14:55', end: '16:25', break: 20 },
  { num: 5, start: '16:45', end: '18:15', break: 15 },
  { num: 6, start: '18:30', end: '20:00', break: 0 },
];
const BELL_TIMES = PAIRS.map(p => p.start);
function getPairNumber(time) {
  const idx = BELL_TIMES.indexOf(time);
  return idx >= 0 ? idx + 1 : null;
}
function isPairNow(p) {
  const now = new Date();
  const [sh, sm] = p.start.split(':').map(Number);
  const [eh, em] = p.end.split(':').map(Number);
  const start = sh * 60 + sm, end = eh * 60 + em;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= start && cur < end;
}

// ========== TOAST ==========
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('active');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('active'), 2400);
}
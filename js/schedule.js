const tabs = document.querySelectorAll('.tab[data-view]');
const wraps = document.querySelectorAll('.diary-wrap');
tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.view)));

const ROWS_PER_DAY = 4;
const DAYS_LEFT  = [['ПОНЕДЕЛЬНИК','monday'],['ВТОРНИК','tuesday'],['СРЕДА','wednesday']];
const DAYS_RIGHT = [['ЧЕТВЕРГ','thursday'],['ПЯТНИЦА','friday'],['СУББОТА','saturday']];

function renderDay(label, lessons, date) {
  const dateNum = date.getDate();
  const todayClass = isToday(date) ? ' today' : '';
  let rows = '';
  for (let i = 0; i < ROWS_PER_DAY; i++) {
    const l = lessons[i];
    if (l) {
      const pairNum = getPairNumber(l.time);
      rows += `
        <tr>
          <td class="num"><div class="pair-num">${pairNum ? pairNum + ' пара' : ''}</div><div class="pair-time">${l.time}</div></td>
          <td><div class="subj-name">${l.subject} (${l.type})</div>${l.teacher ? `<div class="subj-meta">${l.teacher}</div>` : ''}</td>
          <td class="room-cell"><div class="room-name">${l.room || '—'}</div></td>
        </tr>`;
    } else {
      rows += `<tr class="empty-row"><td></td><td></td><td></td></tr>`;
    }
  }
  return `
    <div class="day${todayClass}">
      <div class="day-label">${label}<span class="day-date">${dateNum}</span></div>
      <table>
        <colgroup><col style="width:14%"><col style="width:64%"><col style="width:22%"></colgroup>
        <thead><tr><th>№ / Время</th><th>ПРЕДМЕТ</th><th>КАБИНЕТ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderPage(weekKey, monday, days, monthDate) {
  let daysHtml = '';
  days.forEach(([label, key], i) => {
    const offset = days === DAYS_RIGHT ? i + 3 : i;
    const lessons = (state.schedule[weekKey][key] || []);
    daysHtml += renderDay(label, lessons, addDays(monday, offset));
  });
  const monthLabel = MONTHS_NOM[monthDate.getMonth()];
  return `
    <div class="page week-${weekKey}">
      <div class="month-bar">Месяц <span class="month-value">${monthLabel}</span></div>
      <div class="days">${daysHtml}</div>
    </div>`;
}

function renderActiveDiary() {
  if (state.currentView === 'bell' || state.currentView === 'mobile' || state.currentView === 'homework' || state.currentView === 'files') return;
  const monday = getCurrentMonday();
  const thursday = addDays(monday, 3);
  const type = getCurrentType();
  if (type === 'even') {
    document.getElementById('diary-even').innerHTML =
      renderPage('even', monday, DAYS_LEFT, monday) + renderPage('even', monday, DAYS_RIGHT, thursday);
  } else {
    document.getElementById('diary-odd').innerHTML =
      renderPage('odd', monday, DAYS_LEFT, monday) + renderPage('odd', monday, DAYS_RIGHT, thursday);
  }
}

function updateNavInfo() {
  const nav = document.getElementById('weekNav');
  const info = document.getElementById('navInfo');
  const prevBtn = document.getElementById('navPrev');
  const nextBtn = document.getElementById('navNext');

  if (state.currentView === 'bell' || state.currentView === 'mobile' || state.currentView === 'homework' || state.currentView === 'files') {
    nav.classList.add('hidden'); return;
  }
  nav.classList.remove('hidden');
  nav.classList.toggle('odd', state.currentView === 'odd');
  info.textContent = getRangeString(getCurrentMonday());
  prevBtn.disabled = !canNavigateTo(state.weekOffset - 1);
  nextBtn.disabled = !canNavigateTo(state.weekOffset + 1);
}

function updateBanner() {
  const banner = document.getElementById('banner');
  const bannerText = document.getElementById('bannerText');
  const bannerBtn = document.getElementById('bannerBtn');
  if (state.currentView === 'bell' || state.currentView === 'mobile' || state.currentView === 'homework' || state.currentView === 'files') {
    banner.classList.remove('active'); return;
  }
  const isOdd = state.currentView === 'odd';
  banner.classList.toggle('odd', isOdd);
  bannerBtn.classList.toggle('odd', isOdd);

  let text = '', showBtn = true, show = true;
  if (state.weekOffset > 0) text = 'Вы просматриваете следующую неделю';
  else if (state.weekOffset < 0) text = 'Вы просматриваете прошлую неделю';
  else if (isSunday()) { text = 'Сегодня выходной · показана следующая учебная неделя'; showBtn = false; }
  else show = false;

  bannerText.textContent = text;
  bannerBtn.style.display = showBtn ? 'inline-flex' : 'none';
  banner.classList.toggle('active', show);
  fitAll();
}

function setViewUI(view) {
  let uiView = view;
  if (isMobileLayout() && (view === 'even' || view === 'odd')) uiView = 'mobile';
  if (!isMobileLayout() && view === 'mobile') uiView = getCurrentType();

  tabs.forEach(t => {
    t.classList.remove('active-even', 'active-odd', 'active-bell', 'active-mobile');
    if (t.dataset.view === uiView) {
      if (uiView === 'even') t.classList.add('active-even');
      else if (uiView === 'odd') t.classList.add('active-odd');
      else if (uiView === 'bell') t.classList.add('active-bell');
      else if (uiView === 'mobile') t.classList.add('active-mobile');
    }
  });
  wraps.forEach(w => w.classList.toggle('active', w.dataset.view === uiView));
}

async function applyView(type) {
  document.body.classList.remove('view-homework', 'view-files');

  if (type === 'homework') {
    state.currentView = 'homework';
    document.body.classList.add('view-homework');
    await loadHwItemsFromCloud();
    renderHomework();
    setViewUI('homework');
    updateNavInfo();
    updateBanner();
    updateSidebarActive('homework');
    updateHwAddBtnState();
    rememberPage('homework');
    return;
  }

  if (type === 'files') {
    state.currentView = 'files';
    document.body.classList.add('view-files');
    await loadFilesFromCloud();
    renderFiles();
    setViewUI('files');
    updateNavInfo();
    updateBanner();
    updateSidebarActive('files');
    rememberPage('files');
    return;
  }

  state.previousScheduleView = type;
  updateSidebarActive('schedule');

  if (isMobileLayout()) {
    if (type === 'bell') {
      state.currentView = 'bell';
      renderBellPage();
      setViewUI('bell');
    } else {
      state.currentView = 'mobile';
      renderMobileDay();
      setViewUI('mobile');
    }
    updateNavInfo();
    updateBanner();
    rememberPage('schedule');
    return;
  }

  if (type === 'mobile') type = getCurrentType();
  state.currentView = type;
  if (type === 'bell') renderBellPage();
  else renderActiveDiary();
  setViewUI(type);
  updateNavInfo();
  updateBanner();
  fitAll();
  rememberPage(type === 'bell' ? 'bell' : 'schedule');
}

function switchTab(view) {
  if (view === 'bell' || view === 'mobile') { applyView(view); return; }
  if (view !== getCurrentType()) {
    if (!canNavigateTo(state.weekOffset + 1)) { showToast('Эта неделя вне расписания'); return; }
    state.weekOffset++;
    saveWeekOffset();
  }
  applyView(view);
}

function navigateWeek(delta) {
  if (!canNavigateTo(state.weekOffset + delta)) return;
  state.weekOffset += delta;
  saveWeekOffset();
  applyView(getCurrentType());
}

function goToday() {
  if (state.weekOffset === 0) return;
  state.weekOffset = 0;
  saveWeekOffset();
  applyView(getCurrentType());
}

document.getElementById('navPrev').addEventListener('click', () => navigateWeek(-1));
document.getElementById('navNext').addEventListener('click', () => navigateWeek(1));
document.getElementById('bannerBtn').addEventListener('click', goToday);

function fitAll() {
  if (isMobileLayout()) {
    document.querySelectorAll('.diary-wrap.active .diary, .diary-wrap.active .bell-page')
      .forEach(el => { el.style.transform = ''; });
    return;
  }
  requestAnimationFrame(() => {
    document.querySelectorAll('.diary-wrap.active').forEach(wrap => {
      const target = wrap.querySelector('.diary, .bell-page');
      if (!target) return;
      target.style.transform = 'scale(1)';
      const scale = Math.min(wrap.clientWidth / target.offsetWidth, wrap.clientHeight / target.offsetHeight);
      target.style.transform = `scale(${scale})`;
    });
  });
}

// Боковое меню
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarItems = document.querySelectorAll('.sidebar-item');

function openSidebar() { sidebar.classList.add('open'); sidebarBackdrop.classList.add('open'); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarBackdrop.classList.remove('open'); }
function updateSidebarActive(page) {
  sidebarItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
}

document.getElementById('menuBtn').addEventListener('click', openSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
});

sidebarItems.forEach(item => {
  item.addEventListener('click', () => {
    closeSidebar();
    const page = item.dataset.page;
    if (page === 'homework') applyView('homework');
    else if (page === 'files') applyView('files');
    else {
      if (state.previousScheduleView && state.previousScheduleView !== 'homework' && state.previousScheduleView !== 'files') {
        applyView(state.previousScheduleView);
      } else {
        applyView(isMobileLayout() ? 'mobile' : getCurrentType());
      }
    }
  });
});
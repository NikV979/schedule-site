function initMobileDate() { state.mobileDate = getTodayDate(); }
function nextDay(date) { return addDays(date, 1); }
function prevDay(date) { return addDays(date, -1); }

function canGoPrevDay() {
  if (!state.mobileDate) return false;
  return getMonday(prevDay(state.mobileDate)).getTime() >= MIN_MONDAY.getTime();
}
function canGoNextDay() {
  if (!state.mobileDate) return false;
  return getMonday(nextDay(state.mobileDate)).getTime() <= MAX_MONDAY.getTime();
}
function syncWeekOffsetFromMobileDate() {
  if (!state.mobileDate) return;
  const monday = getMonday(state.mobileDate);
  const baseMonday = getBaseMonday();
  const weeks = Math.round((monday - baseMonday) / (7 * 24 * 60 * 60 * 1000));
  state.weekOffset = weeks;
  saveWeekOffset();
}
function updateTabTodayState() {
  const btn = document.getElementById('tabToday');
  if (!btn) return;
  if (!state.mobileDate) { btn.disabled = false; return; }
  btn.disabled = state.mobileDate.getTime() === getTodayDate().getTime();
}

function renderMobileDay() {
  if (!state.mobileDate) initMobileDate();
  const date = state.mobileDate;
  const dow = date.getDay();
  const dayKey = DAY_KEYS[dow];
  const type = isOddWeek(date) ? 'odd' : 'even';
  const lessons = state.schedule[type][dayKey] || [];

  const title = document.getElementById('mobDayTitle');
  if (title) {
    title.innerHTML =
      `<span class="mob-title-day">${DAY_NAMES_FULL[dow]}</span>` +
      `<span class="mob-title-date">${date.getDate()} ${MONTHS_GEN[date.getMonth()]} · ${type === 'odd' ? 'нечётная' : 'чётная'}</span>`;
  }

  const body = document.getElementById('mobileDayBody');
  if (body) {
    let html = '';
    if (lessons.length === 0) {
      html = '<div class="mob-empty">— в этот день пар нет —</div>';
    } else {
      for (const l of lessons) {
        const pairNum = getPairNumber(l.time);
        const p = PAIRS.find(x => x.start === l.time);
        const timeRange = p ? `${p.start} – ${p.end}` : l.time;
        html += `
          <div class="mob-pair">
            <div class="mob-pair-head">
              <span class="mob-pair-num">${pairNum ? pairNum + ' пара' : ''}</span>
              <span class="mob-pair-time">${timeRange}</span>
              <span class="mob-pair-room">${l.room || '—'}</span>
            </div>
            <div class="mob-pair-subj">${l.subject} <span class="mob-pair-type">(${l.type})</span></div>
            ${l.teacher ? `<div class="mob-pair-teacher">${l.teacher}</div>` : ''}
          </div>`;
      }
    }
    body.innerHTML = html;
    body.scrollTop = 0;
  }
  const page = document.getElementById('mobileDayPage');
  if (page) page.classList.toggle('is-odd', type === 'odd');
  const prevBtn = document.getElementById('mobPrev');
  const nextBtn = document.getElementById('mobNext');
  if (prevBtn) prevBtn.disabled = !canGoPrevDay();
  if (nextBtn) nextBtn.disabled = !canGoNextDay();
  updateTabTodayState();
}

function navigateMobileDay(delta) {
  if (delta < 0 && !canGoPrevDay()) return;
  if (delta > 0 && !canGoNextDay()) return;
  state.mobileDate = delta > 0 ? nextDay(state.mobileDate) : prevDay(state.mobileDate);
  syncWeekOffsetFromMobileDate();
  renderMobileDay();
}

function goToTodayMobile() {
  initMobileDate();
  syncWeekOffsetFromMobileDate();
  if (isMobileLayout()) {
    state.currentView = 'mobile';
    renderMobileDay();
    setViewUI('mobile');
    rememberPage('schedule');
  } else {
    state.currentView = getCurrentType();
    renderActiveDiary();
    setViewUI(state.currentView);
    rememberPage('schedule');
  }
  updateNavInfo();
  updateBanner();
}

function ensureTodayButton() {
  const existing = document.getElementById('tabToday');
  const shouldShow = isMobileLayout();
  if (shouldShow && !existing) {
    const tabsCenter = document.querySelector('.tabs-center');
    const btn = document.createElement('button');
    btn.className = 'tab tab-today';
    btn.id = 'tabToday';
    btn.type = 'button';
    btn.textContent = 'Сегодня';
    tabsCenter.appendChild(btn);
    btn.addEventListener('click', () => goToTodayMobile());
    updateTabTodayState();
  } else if (!shouldShow && existing) existing.remove();
}

document.getElementById('mobPrev').addEventListener('click', () => navigateMobileDay(-1));
document.getElementById('mobNext').addEventListener('click', () => navigateMobileDay(1));

(function setupSwipe() {
  const body = document.getElementById('mobileDayBody');
  if (!body) return;
  let startX = 0, startY = 0, active = false;
  body.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; active = true;
  }, { passive: true });
  body.addEventListener('touchend', e => {
    if (!active) return; active = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navigateMobileDay(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
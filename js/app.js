// ========== ПЕРЕРИСОВКА ПО ВРЕМЕНИ ==========
let lastKnownDay = new Date().getDate();
let lastKnownMinute = -1;

setInterval(() => {
  const now = new Date();
  const d = now.getDate();
  if (d !== lastKnownDay) {
    lastKnownDay = d;
    if (!isMobileLayout()) renderActiveDiary();
    if (state.currentView === 'bell') renderBellPage();
    if (state.currentView === 'mobile') renderMobileDay();
    updateNavInfo();
    updateBanner();
    lastKnownMinute = -1;
  }
  if (state.currentView === 'bell') {
    const m = now.getMinutes();
    if (m !== lastKnownMinute) { lastKnownMinute = m; renderBellPage(); }
  }
}, 30000);

// ========== СМЕНА РАЗМЕРА ЭКРАНА ==========
let lastMobileState = isMobileLayout();
window.addEventListener('resize', () => {
  const nowMobile = isMobileLayout();
  if (nowMobile !== lastMobileState) {
    lastMobileState = nowMobile;
    ensureTodayButton();
    if (state.currentView === 'homework' || state.currentView === 'files') {}
    else if (nowMobile) { if (!state.mobileDate) initMobileDate(); applyView('mobile'); }
    else applyView(getCurrentType());
  }
  fitAll();
});

// ========== СТАРТ ==========
window.addEventListener('load', async () => {
  const savedTheme = localStorage.getItem('schedule-theme');
  if (savedTheme) applyTheme(savedTheme);
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  state.weekOffset = 0;
  const savedOffsetRaw = localStorage.getItem('schedule-week-offset');
  if (savedOffsetRaw !== null) {
    const parsed = parseInt(savedOffsetRaw, 10);
    if (!isNaN(parsed) && canNavigateTo(parsed)) state.weekOffset = parsed;
  }
  if (!canNavigateTo(state.weekOffset)) {
    for (let i = 1; i <= 300; i++) {
      if (canNavigateTo(state.weekOffset + i)) { state.weekOffset += i; break; }
      if (canNavigateTo(state.weekOffset - i)) { state.weekOffset -= i; break; }
    }
  }

  // Загружаем расписание из Supabase
  await loadScheduleFromCloud();

  initMobileDate();
  renderBellPage();
  updateFsIcon();
  ensureTodayButton();

  await refreshUser();

  const savedPage = localStorage.getItem('r144s-page');
if (savedPage === 'homework') applyView('homework');
else if (savedPage === 'files') applyView('files');
else if (savedPage === 'bell') applyView('bell');
else {
  if (isMobileLayout()) applyView('mobile');
  else applyView(getCurrentType());
}

  fitAll();
  setTimeout(fitAll, 100);
  setTimeout(fitAll, 400);
});
// ===== СКРЫТИЕ ЗАГРУЗОЧНОГО ЭКРАНА =====
function hideAppLoader() {
  const loader = document.getElementById('appLoader');
  if (!loader) return;
  loader.classList.add('hidden');
  // Удаляем из DOM через 600ms, чтобы не мешал кликам
  setTimeout(() => {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }, 600);
}

// Скрываем после полной загрузки страницы + небольшой задержки,
// чтобы пользователь успел увидеть красивую анимацию
window.addEventListener('load', () => {
  setTimeout(hideAppLoader, 700);
});

// Подстраховка: если через 4 секунды ничего не произошло — тоже прячем
setTimeout(hideAppLoader, 4000);
// ===== КНОПКА ОБНОВЛЕНИЯ =====
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    setTimeout(() => {
      location.reload();
    }, 400);
  });
}

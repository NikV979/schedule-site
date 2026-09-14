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

const SUBJECT_FIXED_COLORS = {
  'УПР. ЧЕЛ. РЕС.':     { bg: '#C75B5B', text: '#FFFFFF' },
  'ЭК ПО ФК И СПОРТУ':  { bg: '#C8B68A', text: '#2A2418' },
  'ОСН. МЕНЕДЖМЕНТ':    { bg: '#B87BA0', text: '#FFFFFF' },
  'ПСИХОДИАГНОСТИКА':   { bg: '#3E3E5C', text: '#FFFFFF' },
  'КОНЦ. СОВР. ЕСТ-ЗН': { bg: '#7B8FA1', text: '#FFFFFF' },
  'ЭКОНОМИЧ. ТЕОРИЯ':   { bg: '#6B8E7F', text: '#FFFFFF' },
  'ПСИХ. ЭКСТРЕМ И ЧС': { bg: '#A56A6A', text: '#FFFFFF' },
  'ПЕД. ПСИХОЛОГИЯ':    { bg: '#7E7BA8', text: '#FFFFFF' },
  'ПСИХ. ЛИЧНОСТИ':     { bg: '#5B7A99', text: '#FFFFFF' },
};

const SUBJECT_PALETTE = [
  '#7E7BA8', '#A56A6A', '#6B8E7F', '#5B7A99', '#B87BA0',
  '#C7A05B', '#5B9A8E', '#8E7B5B', '#8F6BA5', '#7B8FA1',
];

function getAllSubjects() {
  const set = new Set();
  ['even','odd'].forEach(w => {
    DAY_KEYS.forEach(d => {
      (state.schedule[w][d] || []).forEach(l => set.add(l.subject));
    });
  });
  return [...set].sort();
}

function getContrastText(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#2A2418' : '#FFFFFF';
}
function isLightColor(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
}
function getSubjectStyle(subj) {
  if (SUBJECT_FIXED_COLORS[subj]) return SUBJECT_FIXED_COLORS[subj];
  let hash = 0;
  for (let i = 0; i < subj.length; i++) hash = ((hash << 5) - hash) + subj.charCodeAt(i);
  const bg = SUBJECT_PALETTE[Math.abs(hash) % SUBJECT_PALETTE.length];
  return { bg, text: getContrastText(bg) };
}

function formatDeadline(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const now = new Date(); now.setHours(0,0,0,0);
  const dl = new Date(y, m - 1, d);
  const diffDays = Math.round((dl - now) / (24 * 60 * 60 * 1000));
  const dateStr = `${d} ${MONTHS_GEN[m - 1]}`;
  if (diffDays < 0) return `просрочено (${dateStr})`;
  if (diffDays === 0) return `сегодня`;
  if (diffDays === 1) return `завтра`;
  return `до ${dateStr}`;
}
function isDeadlineSoon(iso) {
  if (!iso) return false;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  const now = new Date(); now.setHours(0,0,0,0);
  const dl = new Date(y, m - 1, d);
  const diff = Math.round((dl - now) / (24 * 60 * 60 * 1000));
  return diff <= 2;
}

function getUrgencyGroup(item) {
  if (!item.deadline) return 'nodate';
  const [y, m, d] = String(item.deadline).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 'nodate';
  const now = new Date(); now.setHours(0,0,0,0);
  const dl = new Date(y, m - 1, d);
  const diff = Math.round((dl - now) / (24 * 60 * 60 * 1000));
  if (diff < 0) return 'overdue';
  if (diff <= 1) return 'soon';
  if (diff <= 7) return 'week';
  return 'later';
}

const URGENCY_META = {
  overdue: { title: 'Просрочено',  emoji: '🔴', order: 0 },
  soon:    { title: 'Срочно',       emoji: '🟡', order: 1 },
  week:    { title: 'На неделе',    emoji: '📅', order: 2 },
  later:   { title: 'Позже',        emoji: '🕐', order: 3 },
  nodate:  { title: 'Без даты',     emoji: '📝', order: 4 },
};

function isHwDone(id) { return localStorage.getItem('hw-done-' + id) === '1'; }

function updateHwAddBtnState() {
  const btn = document.getElementById('hwAddBtn');
  const clearBtn = document.getElementById('hwClearBtn');
  if (btn) {
    if (state.currentUser) { btn.disabled = false; btn.title = 'Добавить задание'; }
    else { btn.disabled = false; btn.title = 'Войдите, чтобы добавлять задания'; }
  }
  if (clearBtn) {
    if (state.currentUser && state.hw.items.length > 0) { clearBtn.disabled = false; clearBtn.title = 'Удалить все задания'; }
    else { clearBtn.disabled = true; clearBtn.title = 'Нет заданий для удаления'; }
  }
}

async function loadHwItemsFromCloud() {
  state.hw.loading = true;
  const { data, error } = await supabaseClient
    .from('homework')
    .select('id, user_id, user_login, subject, task, deadline, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Ошибка загрузки ДЗ:', error);
    showToast('Не удалось загрузить задания');
    state.hw.items = [];
  } else {
    state.hw.items = data || [];
  }
  state.hw.loading = false;
  updateHwAddBtnState();
}

// ===== Счётчик в шапке =====
function updateTabBadge() {
  const badge = document.getElementById('hwTabBadge');
  if (!badge) return;
  const n = state.hw.items.length;
  badge.textContent = n;
  badge.style.display = 'inline-flex';
}

function renderHomework() {
  const grid = document.getElementById('hwGrid');
  const empty = document.getElementById('hwEmpty');
  if (!grid || !empty) return;

  if (state.hw.loading) { grid.innerHTML = ''; empty.classList.remove('active'); return; }

  // Обновляем счётчик в шапке
  updateTabBadge();

  if (state.hw.items.length === 0) {
    grid.innerHTML = '';
    empty.classList.add('active');
    updateHwAddBtnState();
    return;
  }
  empty.classList.remove('active');

  const byUrgency = { overdue: [], soon: [], week: [], later: [], nodate: [] };
  for (const item of state.hw.items) {
    byUrgency[getUrgencyGroup(item)].push(item);
  }

  let html = '';
  const groups = ['overdue', 'soon', 'week', 'later', 'nodate'];

  for (const groupKey of groups) {
    const groupItems = byUrgency[groupKey];
    if (groupItems.length === 0) continue;

    const meta = URGENCY_META[groupKey];

    const bySubject = {};
    for (const item of groupItems) {
      if (!bySubject[item.subject]) bySubject[item.subject] = [];
      bySubject[item.subject].push(item);
    }
    const subjects = Object.keys(bySubject).sort((a, b) => a.localeCompare(b, 'ru'));

    html += `<div class="hw-group">
      <div class="hw-group-head">
        <span class="hw-group-emoji">${meta.emoji}</span>
        <span class="hw-group-title">${meta.title}</span>
        <span class="hw-group-count">${groupItems.length}</span>
      </div>
      <div class="hw-group-body">`;

    for (const subj of subjects) {
      const items = bySubject[subj];
      items.sort((a, b) => {
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return (new Date(b.created_at || 0)) - (new Date(a.created_at || 0));
      });

      const style = getSubjectStyle(subj);
      const light = isLightColor(style.bg);
      const expandedClass = state.hw.expandedSubjects.has(subj) ? ' expanded' : '';
      const lightClass = light ? ' light' : '';

      let itemsHtml = '';
      for (const item of items) {
        const dlText = formatDeadline(item.deadline);
        const dlClass = isDeadlineSoon(item.deadline) ? ' soon' : '';
        const canDelete = state.currentUser && item.user_login === state.currentUser;
        const isDone = isHwDone(item.id);
        const doneClass = isDone ? ' done' : '';
        const checkDoneClass = isDone ? ' done' : '';

        itemsHtml += `
          <div class="hw-item${doneClass}" data-id="${item.id}" style="border-left-color: ${style.bg};">
            <div class="hw-check${checkDoneClass}" data-check-id="${item.id}"></div>
            <div class="hw-item-main">
              <div class="hw-item-task">${escapeHtml(item.task)}</div>
              <div class="hw-item-meta">${dlText ? `<span class="hw-item-deadline${dlClass}">⏰ ${escapeHtml(dlText)}</span>` : ''}</div>
            </div>
            ${canDelete ? `<button class="hw-item-del" data-id="${item.id}" type="button">✕</button>` : ''}
          </div>`;
      }

      html += `
        <div class="hw-card${expandedClass}" data-subject="${escapeHtml(subj)}" style="--hw-accent: ${style.bg}; --hw-text: ${style.text};">
          <div class="hw-card-head${lightClass}">
            <div class="hw-card-head-left">
              <span class="hw-card-arrow">▸</span>
              <span class="hw-card-subject">${escapeHtml(subj)}</span>
            </div>
            <span class="hw-card-count">${items.length}</span>
          </div>
          <div class="hw-card-list">${itemsHtml}</div>
        </div>`;
    }

    html += `</div></div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.hw-card-head').forEach(head => {
    head.addEventListener('click', () => {
      const card = head.closest('.hw-card');
      if (!card) return;
      const subj = card.dataset.subject;
      const isExp = card.classList.toggle('expanded');
      if (isExp) state.hw.expandedSubjects.add(subj);
      else state.hw.expandedSubjects.delete(subj);
    });
  });

  grid.querySelectorAll('.hw-check').forEach(check => {
    check.addEventListener('click', e => {
      e.stopPropagation();
      const id = check.dataset.checkId;
      const item = check.closest('.hw-item');
      if (!item) return;
      const wasDone = item.classList.contains('done');
      if (wasDone) {
        localStorage.removeItem('hw-done-' + id);
        item.classList.remove('done');
        check.classList.remove('done');
      } else {
        localStorage.setItem('hw-done-' + id, '1');
        item.classList.add('done');
        check.classList.add('done');
      }
    });
  });

  grid.querySelectorAll('.hw-item-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!state.currentUser) {
        showToast('Войдите, чтобы удалять задания');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
      }
      const id = btn.dataset.id;
      const item = state.hw.items.find(x => String(x.id) === String(id));
      if (!item) return;
      if (!confirm(`Удалить задание?\n\n«${item.task.slice(0, 80)}»`)) return;
      const { error } = await supabaseClient.from('homework').delete().eq('id', id);
      if (error) { console.error(error); showToast('Ошибка удаления'); return; }
      localStorage.removeItem('hw-done-' + id);
      state.hw.items = state.hw.items.filter(x => String(x.id) !== String(id));
      renderHomework();
      showToast('Задание удалено');
    });
  });

  updateHwAddBtnState();
}

// ===== МОДАЛКА ДЗ =====
const hwModal = document.getElementById('hwModal');
const hwSubjectEl = document.getElementById('hwSubject');
const hwTaskEl = document.getElementById('hwTask');
const hwDeadlineEl = document.getElementById('hwDeadline');

function fillSubjectSelect() {
  const subjects = getAllSubjects();
  hwSubjectEl.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function openHwModal() {
  if (!hwModal) { console.error('Модалка #hwModal не найдена'); return; }
  if (!state.currentUser) {
    showToast('Войдите, чтобы добавлять задания');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  try { fillSubjectSelect(); } catch (_) {}
  hwTaskEl.value = '';
  hwDeadlineEl.value = '';
  hwModal.classList.add('active');
  setTimeout(() => hwTaskEl.focus(), 60);
}
function closeHwModal() { hwModal.classList.remove('active'); }

async function saveHwItem() {
  if (!state.currentUser) {
    showToast('Войдите, чтобы добавлять задания');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  const subject = hwSubjectEl.value.trim();
  const task = hwTaskEl.value.trim();
  const deadline = hwDeadlineEl.value || null;
  if (!subject) { showToast('Выберите предмет'); return; }
  if (!task) { showToast('Введите текст'); hwTaskEl.focus(); return; }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) {
    showToast('Сессия истекла, войдите заново');
    closeHwModal();
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }

  const saveBtn = document.getElementById('hwSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Сохраняю…';

  const { error } = await supabaseClient.from('homework').insert({
    user_id: session.user.id, user_login: state.currentUser, subject, task, deadline,
  });

  saveBtn.disabled = false; saveBtn.textContent = 'Добавить';
  if (error) { console.error(error); showToast('Ошибка сохранения'); return; }

  closeHwModal();
  state.hw.expandedSubjects.add(subject);
  await loadHwItemsFromCloud();
  renderHomework();
  showToast('Задание добавлено');
}

async function clearAllHw() {
  if (!state.currentUser) {
    showToast('Войдите, чтобы очистить задания');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  if (state.hw.items.length === 0) { showToast('Нет заданий'); return; }
  if (!confirm(`Удалить ВСЕ задания (${state.hw.items.length})?\n\nНельзя отменить.`)) return;

  const btn = document.getElementById('hwClearBtn');
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'Удаляю…';

  const { error } = await supabaseClient.from('homework').delete().eq('user_id', state.currentUserId);
  btn.textContent = old;

  if (error) { console.error(error); showToast('Ошибка удаления'); updateHwAddBtnState(); return; }

  state.hw.items.forEach(item => localStorage.removeItem('hw-done-' + item.id));
  state.hw.items = [];
  state.hw.expandedSubjects.clear();
  renderHomework();
  showToast('Все задания удалены');
}

// ===== ОБРАБОТЧИКИ КНОПОК =====
const hwAddBtn = document.getElementById('hwAddBtn');
if (hwAddBtn) {
  hwAddBtn.addEventListener('click', () => {
    if (!state.currentUser) {
      showToast('Войдите, чтобы добавлять задания');
      if (typeof openAuthModal === 'function') openAuthModal();
      return;
    }
    openHwModal();
  });
}

const hwClearBtnEl = document.getElementById('hwClearBtn');
if (hwClearBtnEl) hwClearBtnEl.addEventListener('click', clearAllHw);

const hwModalCloseEl = document.getElementById('hwModalClose');
if (hwModalCloseEl) hwModalCloseEl.addEventListener('click', closeHwModal);

const hwCancelEl = document.getElementById('hwCancel');
if (hwCancelEl) hwCancelEl.addEventListener('click', closeHwModal);

const hwSaveEl = document.getElementById('hwSave');
if (hwSaveEl) hwSaveEl.addEventListener('click', saveHwItem);

if (hwModal) {
  hwModal.addEventListener('click', e => { if (e.target === hwModal) closeHwModal(); });
}

document.addEventListener('keydown', e => {
  if (!hwModal || !hwModal.classList.contains('active')) return;
  if (e.key === 'Escape') closeHwModal();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveHwItem();
});

// ===== REALTIME =====
function subscribeHwRealtime() {
  if (state.hwRealtimeChannel) return;
  if (!state.currentUserId) return;

  state.hwRealtimeChannel = supabaseClient
    .channel('homework-user-' + state.currentUserId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'homework',
      filter: `user_id=eq.${state.currentUserId}`
    }, async () => {
      await loadHwItemsFromCloud();
      if (state.currentView === 'homework') renderHomework();
    })
    .subscribe();
}

function unsubscribeHwRealtime() {
  if (!state.hwRealtimeChannel) return;
  supabaseClient.removeChannel(state.hwRealtimeChannel);
  state.hwRealtimeChannel = null;
}

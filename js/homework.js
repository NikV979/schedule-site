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

function isHwDone(id) { return localStorage.getItem('hw-done-' + id) === '1'; }

// ===== Порядок заданий внутри предмета (localStorage) =====
function getHwOrderKey(subject) {
  return 'hw-order-' + encodeURIComponent(subject);
}
function getHwOrder(subject) {
  try {
    return JSON.parse(localStorage.getItem(getHwOrderKey(subject)) || '[]');
  } catch (_) { return []; }
}
function setHwOrder(subject, ids) {
  try {
    localStorage.setItem(getHwOrderKey(subject), JSON.stringify(ids));
  } catch (_) {}
}

// ===== Загрузка =====
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
}

function updateTabBadge() {
  const badge = document.getElementById('hwTabBadge');
  if (!badge) return;
  badge.textContent = state.hw.items.length;
  badge.style.display = 'inline-flex';
}

// ===== Сортировка: по сохранённому порядку, потом по дате =====
function sortHwItems(subject, items) {
  const savedOrder = getHwOrder(subject);
  if (savedOrder.length > 0) {
    const orderMap = new Map();
    savedOrder.forEach((id, idx) => orderMap.set(String(id), idx));
    items.sort((a, b) => {
      const ai = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 9999;
      const bi = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 9999;
      if (ai !== bi) return ai - bi;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return (new Date(b.created_at || 0)) - (new Date(a.created_at || 0));
    });
  } else {
    items.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return (new Date(b.created_at || 0)) - (new Date(a.created_at || 0));
    });
  }
}

// ===== Рендер =====
function renderHomework() {
  const grid = document.getElementById('hwGrid');
  const empty = document.getElementById('hwEmpty');
  if (!grid || !empty) return;

  if (state.hw.loading) { grid.innerHTML = ''; empty.classList.remove('active'); return; }

  updateTabBadge();

  const allSubjects = getAllSubjects();
  if (allSubjects.length === 0) {
    grid.innerHTML = '';
    empty.classList.add('active');
    return;
  }

  const bySubject = {};
  for (const subj of allSubjects) bySubject[subj] = [];
  for (const item of state.hw.items) {
    if (!bySubject[item.subject]) bySubject[item.subject] = [];
    bySubject[item.subject].push(item);
  }

  for (const subj of Object.keys(bySubject)) {
    sortHwItems(subj, bySubject[subj]);
  }

  const subjectsSorted = [...allSubjects].sort((a, b) => a.localeCompare(b, 'ru'));

  let html = '';
  for (const subj of subjectsSorted) {
    const items = bySubject[subj] || [];
    const hasItems = items.length > 0;
    const style = getSubjectStyle(subj);
    const light = isLightColor(style.bg);
    const lightClass = light ? ' light' : '';
    const emptyClass = hasItems ? '' : ' hw-card-empty';

    let itemsHtml = '';
    if (hasItems) {
      for (const item of items) {
        const dlText = formatDeadline(item.deadline);
        const isDone = isHwDone(item.id);
        const doneClass = isDone ? ' done' : '';

        itemsHtml += `
          <div class="hw-item${doneClass}" data-id="${item.id}" draggable="true">
            <span class="hw-item-grip" title="Перетащить">⋮⋮</span>
            <div class="hw-item-main">
              <div class="hw-item-task">${escapeHtml(item.task)}</div>
              ${dlText ? `<div class="hw-item-deadline">${escapeHtml(dlText)}</div>` : ''}
            </div>
          </div>`;
      }
    } else {
      itemsHtml = `<div class="hw-card-noitems">Нет заданий</div>`;
    }

    html += `
      <div class="hw-card${emptyClass}" data-subject="${escapeHtml(subj)}"
           style="--hw-accent: ${style.bg}; --hw-text: ${style.text};">
        <div class="hw-card-head${lightClass}">
          <div class="hw-card-head-left">
            <span class="hw-card-subject">${escapeHtml(subj)}</span>
          </div>
          <span class="hw-card-count">${items.length}</span>
        </div>
        <div class="hw-card-body" data-subject="${escapeHtml(subj)}">${itemsHtml}</div>
      </div>`;
  }

  grid.innerHTML = html;
  empty.classList.remove('active');

  // Клик по карточке — открыть модалку
  grid.querySelectorAll('.hw-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.hw-item')) return;
      const subj = card.dataset.subject;
      openHwModalForSubject(subj);
    });
  });

  // ПКМ — контекстное меню
  grid.querySelectorAll('.hw-item').forEach(itemEl => {
    itemEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      const id = itemEl.dataset.id;
      openHwContextMenu(e.clientX, e.clientY, id);
    });
  });

  // Drag & drop внутри каждого .hw-card-body
  grid.querySelectorAll('.hw-card-body').forEach(bodyEl => {
    setupHwDragAndDrop(bodyEl);
  });
}

// ===== Drag & drop =====
function setupHwDragAndDrop(bodyEl) {
  const subject = bodyEl.dataset.subject;
  let draggedEl = null;

  bodyEl.querySelectorAll('.hw-item').forEach(itemEl => {
    itemEl.addEventListener('dragstart', e => {
      draggedEl = itemEl;
      itemEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', itemEl.dataset.id); } catch (_) {}
    });

    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
      // Снять выделение с остальных
      bodyEl.querySelectorAll('.hw-item').forEach(el => el.classList.remove('drag-over'));
      // Сохранить порядок
      const ids = [...bodyEl.querySelectorAll('.hw-item')].map(el => el.dataset.id);
      setHwOrder(subject, ids);
      draggedEl = null;
    });

    itemEl.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedEl || draggedEl === itemEl) return;
      const rect = itemEl.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > (rect.height / 2);
      bodyEl.querySelectorAll('.hw-item').forEach(el => el.classList.remove('drag-over'));
      itemEl.classList.add('drag-over');
      if (isAfter) {
        itemEl.parentNode.insertBefore(draggedEl, itemEl.nextSibling);
      } else {
        itemEl.parentNode.insertBefore(draggedEl, itemEl);
      }
    });
  });

  bodyEl.addEventListener('dragover', e => {
    e.preventDefault();
    if (!draggedEl) return;
    // Если перетаскиваем на пустое место — в конец
    if (e.target === bodyEl) {
      bodyEl.appendChild(draggedEl);
    }
  });
}

// ===== Открытие модалки с предзаполненным предметом =====
function openHwModalForSubject(subject) {
  if (!state.currentUser) {
    showToast('Войдите, чтобы добавлять задания');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  if (!hwModal) return;

  try { fillSubjectSelect(); } catch (_) {}
  if (hwSubjectEl) hwSubjectEl.value = subject;

  hwTaskEl.value = '';
  hwDeadlineEl.value = '';
  resetHwModalTitle();
  hwModal.classList.add('active');
  setTimeout(() => hwTaskEl.focus(), 60);
}

// ===== Контекстное меню =====
let hwCtxMenu = null;

function openHwContextMenu(x, y, id) {
  closeHwContextMenu();

  const item = state.hw.items.find(v => String(v.id) === String(id));
  if (!item) return;

  const isDone = isHwDone(id);
  const canEdit = state.currentUser && item.user_login === state.currentUser;

  const menu = document.createElement('div');
  menu.className = 'hw-ctx-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const items = [];

  items.push({
    label: isDone ? 'Вернуть в работу' : 'Сделано',
    action: () => toggleHwDone(id)
  });

  if (canEdit) {
    items.push({ label: 'Редактировать', action: () => editHwItem(id) });
    items.push({ label: 'Удалить', action: () => deleteHwItem(id), danger: true });
  }

  menu.innerHTML = items.map((it, i) =>
    `<button type="button" class="hw-ctx-btn${it.danger ? ' danger' : ''}" data-i="${i}">${it.label}</button>`
  ).join('');

  document.body.appendChild(menu);

  menu.querySelectorAll('.hw-ctx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i, 10);
      closeHwContextMenu();
      items[i].action();
    });
  });

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

  hwCtxMenu = menu;

  setTimeout(() => {
    document.addEventListener('click', closeHwContextMenu, { once: true });
    document.addEventListener('contextmenu', closeHwContextMenu, { once: true });
    window.addEventListener('scroll', closeHwContextMenu, { once: true });
  }, 0);
}

function closeHwContextMenu() {
  if (hwCtxMenu && hwCtxMenu.parentNode) {
    hwCtxMenu.parentNode.removeChild(hwCtxMenu);
  }
  hwCtxMenu = null;
}

function toggleHwDone(id) {
  const isDone = isHwDone(id);
  if (isDone) localStorage.removeItem('hw-done-' + id);
  else localStorage.setItem('hw-done-' + id, '1');
  renderHomework();
}

async function deleteHwItem(id) {
  if (!state.currentUser) { showToast('Войдите'); return; }
  const item = state.hw.items.find(x => String(x.id) === String(id));
  if (!item) return;

  const { error } = await supabaseClient.from('homework').delete().eq('id', id);
  if (error) { console.error(error); showToast('Ошибка удаления'); return; }

  localStorage.removeItem('hw-done-' + id);
  state.hw.items = state.hw.items.filter(x => String(x.id) !== String(id));
  renderHomework();
  showToast('Задание удалено');
}

function editHwItem(id) {
  const item = state.hw.items.find(x => String(x.id) === String(id));
  if (!item) return;
  if (!hwModal) return;
  try { fillSubjectSelect(); } catch (_) {}

  hwSubjectEl.value = item.subject;
  hwTaskEl.value = item.task;
  hwDeadlineEl.value = item.deadline || '';

  const modalTitle = hwModal.querySelector('.hw-modal-head h2');
  const saveBtn = document.getElementById('hwSave');
  if (modalTitle) modalTitle.textContent = 'Редактировать задание';
  if (saveBtn) {
    saveBtn.textContent = 'Сохранить';
    saveBtn.dataset.editId = id;
  }

  hwModal.classList.add('active');
  setTimeout(() => hwTaskEl.focus(), 60);
}

function resetHwModalTitle() {
  const modalTitle = hwModal && hwModal.querySelector('.hw-modal-head h2');
  if (modalTitle) modalTitle.textContent = 'Новое задание';
  const saveBtn = document.getElementById('hwSave');
  if (saveBtn) {
    saveBtn.textContent = 'Добавить';
    delete saveBtn.dataset.editId;
  }
}

// ===== МОДАЛКА =====
const hwModal = document.getElementById('hwModal');
const hwSubjectEl = document.getElementById('hwSubject');
const hwTaskEl = document.getElementById('hwTask');
const hwDeadlineEl = document.getElementById('hwDeadline');

function fillSubjectSelect() {
  const subjects = getAllSubjects();
  hwSubjectEl.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function closeHwModal() {
  hwModal.classList.remove('active');
  resetHwModalTitle();
}

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
  const editId = saveBtn.dataset.editId;
  const isEdit = !!editId;

  saveBtn.disabled = true;
  saveBtn.textContent = isEdit ? 'Сохраняю…' : 'Добавляю…';

  let error;
  if (isEdit) {
    ({ error } = await supabaseClient
      .from('homework')
      .update({ subject, task, deadline })
      .eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('homework').insert({
      user_id: session.user.id, user_login: state.currentUser, subject, task, deadline,
    }));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = isEdit ? 'Сохранить' : 'Добавить';

  if (error) { console.error(error); showToast('Ошибка сохранения'); return; }

  delete saveBtn.dataset.editId;
  resetHwModalTitle();
  closeHwModal();
  await loadHwItemsFromCloud();
  renderHomework();
  showToast(isEdit ? 'Задание обновлено' : 'Задание добавлено');
}

// ===== ОБРАБОТЧИКИ =====
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

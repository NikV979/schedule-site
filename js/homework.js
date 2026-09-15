// ================== ДОМАШКА ==================
const HW_BUCKET = 'homework';

// ===== СПИСОК ПРЕДМЕТОВ =====
function getAllSubjects() {
  return [
    'КОНЦ. СОВР. ЕСТ-ЗН',
    'ОСН. МЕНЕДЖМЕНТ',
    'ПЕД. ПСИХОЛОГИЯ',
    'ПСИХ. ЛИЧНОСТИ',
    'ПСИХ. ЭКСТРЕМ И ЧС',
    'ПСИХОДИАГНОСТИКА',
    'УПР. ЧЕЛ. РЕС.',
    'ЭК ПО ФК И СПОРТУ',
    'ЭКОНОМИЧ. ТЕОРИЯ'
  ];
}

// ===== ЦВЕТА ПО ПРЕДМЕТУ =====
const SUBJECT_PALETTE = [
  { bg: '#5B4BD6', text: '#FFFFFF' },
  { bg: '#4A7AB8', text: '#FFFFFF' },
  { bg: '#6E9E7C', text: '#FFFFFF' },
  { bg: '#C77E5B', text: '#FFFFFF' },
  { bg: '#9B5B9B', text: '#FFFFFF' },
  { bg: '#4A6FA5', text: '#FFFFFF' },
  { bg: '#C75B5B', text: '#FFFFFF' },
  { bg: '#7B8FA1', text: '#FFFFFF' },
  { bg: '#5B8A6E', text: '#FFFFFF' },
];

function getSubjectStyle(subject) {
  const all = getAllSubjects();
  const idx = all.indexOf(subject);
  if (idx >= 0) return SUBJECT_PALETTE[idx % SUBJECT_PALETTE.length];
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) | 0;
  return SUBJECT_PALETTE[Math.abs(h) % SUBJECT_PALETTE.length];
}

function isLightColor(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
}

// ===== ЗАГРУЗКА ИЗ SUPABASE =====
async function loadHwItemsFromCloud() {
  const { data, error } = await supabaseClient
    .from('homework')
    .select('id, user_login, subject, task, deadline, done, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки домашки:', error);
    showToast('Не удалось загрузить домашку');
    state.hw.items = [];
    return;
  }
  state.hw.items = data || [];
}

// ===== ВАЖНОЕ =====
function isImportant(hw) {
  if (!hw.deadline) return false;
  if (hw.done) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(hw.deadline); d.setHours(0,0,0,0);
  const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 1;
}

// ===== РЕНДЕР =====
function renderHomework() {
  const grid = document.getElementById('hwGrid');
  const empty = document.getElementById('hwEmpty');
  if (!grid || !empty) return;

  // Защита state
  if (!state.hw.expandedSubjects) state.hw.expandedSubjects = new Set();
  if (typeof state.hw.onlyImportant !== 'boolean') state.hw.onlyImportant = false;

  const subjects = getAllSubjects();
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  let html = '';
  let totalItems = 0;

  for (const subject of subjects) {
    const items = state.hw.items.filter(it => it.subject === subject);
    const filteredItems = state.hw.onlyImportant
      ? items.filter(isImportant)
      : items;

    if (state.hw.onlyImportant && filteredItems.length === 0) continue;

    totalItems += items.length;

    const style = getSubjectStyle(subject);
    const light = isLightColor(style.bg);
    const lightClass = light ? ' light' : '';
    const isEmpty = items.length === 0;

    const isExpanded = state.hw.expandedSubjects.has(subject);

    html += `
      <div class="hw-card${isEmpty ? ' hw-card-empty' : ''}${isExpanded ? ' expanded' : ''}"
           data-subject="${escapeHtml(subject)}"
           style="--hw-accent: ${style.bg}; --hw-text: ${style.text};">
        <div class="hw-card-head${lightClass}">
          <div class="hw-card-head-left">
            <span class="hw-card-subject">${escapeHtml(subject)}</span>
          </div>
          <span class="hw-card-count">${items.length}</span>
        </div>
        <div class="hw-card-body">
          ${filteredItems.length
            ? filteredItems.map(renderHwItem).join('')
            : `<div class="hw-card-noitems">Нет заданий</div>`}
          <div class="hw-add-item-btn" data-add-subject="${escapeHtml(subject)}">
            <span>Добавить задание</span>
          </div>
        </div>
      </div>`;
  }

  grid.innerHTML = html;

  // ===== Обработчики =====

  // Клик по шапке карточки
  grid.querySelectorAll('.hw-card-head').forEach(head => {
    head.addEventListener('click', () => {
      const card = head.closest('.hw-card');
      const subj = card.dataset.subject;

      if (isMobile) {
        // Мобилка: клик по шапке = раскрыть/свернуть (как в файлах)
        const expanded = card.classList.toggle('expanded');
        if (expanded) state.hw.expandedSubjects.add(subj);
        else state.hw.expandedSubjects.delete(subj);
        return;
      }

      // ПК: клик по шапке = модалка добавления
      openHwModal(subj);
    });
  });

  // Клик по кнопке «+ Добавить задание» (внутри раскрытой карточки)
  grid.querySelectorAll('.hw-add-item-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openHwModal(btn.dataset.addSubject);
    });
  });

  // Клик по заданию — контекстное меню
  grid.querySelectorAll('.hw-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      openHwContextMenu(item.dataset.id, e.clientX, e.clientY);
    });
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openHwContextMenu(item.dataset.id, e.clientX, e.clientY);
    });
  });

  // Бейдж
  const badge = document.getElementById('hwTabBadge');
  if (badge) badge.textContent = totalItems;

  // Пусто?
  if (totalItems === 0 && state.hw.onlyImportant === false) {
    // показываем все карточки (пустые) — пользователь может добавлять
  }
}

function renderHwItem(it) {
  const imp = isImportant(it);
  const classes = ['hw-item'];
  if (it.done) classes.push('done');
  if (imp && !it.done) classes.push('important');
  return `
    <div class="${classes.join(' ')}" data-id="${it.id}">
      <span class="hw-item-grip">⋮⋮</span>
      <div class="hw-item-main">
        <div class="hw-item-task">${escapeHtml(it.task)}</div>
        ${it.deadline ? `<div class="hw-item-deadline">до ${formatHwDate(it.deadline)}</div>` : ''}
      </div>
    </div>`;
}

function formatHwDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mm}`;
}

// ===== КОНТЕКСТНОЕ МЕНЮ =====
let hwCtxMenuEl = null;

function closeHwContextMenu() {
  if (hwCtxMenuEl && hwCtxMenuEl.parentNode) {
    hwCtxMenuEl.parentNode.removeChild(hwCtxMenuEl);
  }
  hwCtxMenuEl = null;
}

function openHwContextMenu(hwId, x, y) {
  closeHwContextMenu();

  const item = state.hw.items.find(h => String(h.id) === String(hwId));
  if (!item) return;

  const canEdit = state.currentUser && item.user_login === state.currentUser;

  const menu = document.createElement('div');
  menu.className = 'hw-ctx-menu';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'hw-ctx-btn';
  doneBtn.textContent = item.done ? '↺ Не сделано' : '✓ Сделано';
  doneBtn.addEventListener('click', async () => {
    closeHwContextMenu();
    await toggleHwDone(hwId, !item.done);
  });
  menu.appendChild(doneBtn);

  if (canEdit) {
    const delBtn = document.createElement('button');
    delBtn.className = 'hw-ctx-btn danger';
    delBtn.textContent = '✕ Удалить';
    delBtn.addEventListener('click', async () => {
      closeHwContextMenu();
      await deleteHwById(hwId);
    });
    menu.appendChild(delBtn);
  }

  menu.style.left = '0px';
  menu.style.top = '0px';
  document.body.appendChild(menu);
  hwCtxMenuEl = menu;

  const rect = menu.getBoundingClientRect();
  let left = x, top = y;
  if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
  if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

document.addEventListener('click', () => closeHwContextMenu());
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('.hw-item')) closeHwContextMenu();
});
window.addEventListener('scroll', () => closeHwContextMenu(), true);

// ===== ДОБАВЛЕНИЕ / УДАЛЕНИЕ / TOGGLE =====
async function addHwItem(subject, task, deadline) {
  if (!state.currentUser || !state.currentUserId) {
    showToast('Войдите, чтобы добавлять задания');
    openAuthModal();
    return false;
  }
  try {
    const { error } = await supabaseClient.from('homework').insert({
      user_id: state.currentUserId,
      user_login: state.currentUser,
      subject,
      task,
      deadline: deadline || null,
      done: false
    });
    if (error) throw error;

    await loadHwItemsFromCloud();
    renderHomework();
    return true;
  } catch (err) {
    console.error(err);
    showToast('Ошибка: ' + (err.message || 'неизвестная'));
    return false;
  }
}

async function toggleHwDone(id, done) {
  const item = state.hw.items.find(h => String(h.id) === String(id));
  if (!item) return;
  try {
    const { error } = await supabaseClient.from('homework').update({ done }).eq('id', id);
    if (error) throw error;
    item.done = done;
    renderHomework();
    showToast(done ? 'Отмечено как сделано' : 'Снова активно');
  } catch (err) {
    console.error(err);
    showToast('Ошибка: ' + (err.message || 'неизвестная'));
  }
}

async function deleteHwById(id) {
  if (!state.currentUser) { showToast('Войдите, чтобы удалять'); openAuthModal(); return; }
  const item = state.hw.items.find(h => String(h.id) === String(id));
  if (!item) return;
  if (!confirm(`Удалить задание?\n\n«${item.task}»`)) return;
  try {
    const { error } = await supabaseClient.from('homework').delete().eq('id', id);
    if (error) throw error;
    state.hw.items = state.hw.items.filter(h => String(h.id) !== String(id));
    renderHomework();
    showToast('Задание удалено');
  } catch (err) {
    console.error(err);
    showToast('Ошибка удаления: ' + (err.message || 'неизвестная'));
  }
}

// ===== МОДАЛКА «НОВОЕ ЗАДАНИЕ» =====
const hwModal = document.getElementById('hwModal');
const hwSubject = document.getElementById('hwSubject');
const hwTask = document.getElementById('hwTask');
const hwDeadline = document.getElementById('hwDeadline');

function fillHwSubjectSelect() {
  if (!hwSubject) return;
  const subjects = getAllSubjects();
  hwSubject.innerHTML = subjects
    .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join('');
}

function openHwModal(preselect) {
  if (!state.currentUser) { showToast('Войдите, чтобы добавлять'); openAuthModal(); return; }
  fillHwSubjectSelect();
  if (preselect) hwSubject.value = preselect;
  hwTask.value = '';
  hwDeadline.value = '';
  hwModal.classList.add('active');
  setTimeout(() => hwTask.focus(), 80);
}

function closeHwModal() {
  hwModal.classList.remove('active');
}

document.getElementById('hwModalClose').addEventListener('click', closeHwModal);
document.getElementById('hwCancel').addEventListener('click', closeHwModal);
hwModal.addEventListener('click', e => { if (e.target === hwModal) closeHwModal(); });

document.getElementById('hwSave').addEventListener('click', async () => {
  const subj = hwSubject.value;
  const task = hwTask.value.trim();
  const deadline = hwDeadline.value || null;

  if (!task) { showToast('Введите задание'); hwTask.focus(); return; }

  const btn = document.getElementById('hwSave');
  btn.disabled = true; btn.textContent = 'Добавляю…';

  const ok = await addHwItem(subj, task, deadline);

  btn.disabled = false; btn.textContent = 'Добавить';

  if (ok) {
    closeHwModal();
    showToast('Задание добавлено');
    // Раскрываем карточку, в которую добавили
    state.hw.expandedSubjects.add(subj);
    renderHomework();
  }
});

// ===== КНОПКИ В ШАПКЕ =====
document.getElementById('hwClearAllBtn').addEventListener('click', async () => {
  if (!state.currentUser) { showToast('Войдите, чтобы очистить'); openAuthModal(); return; }
  const own = state.hw.items.filter(h => h.user_login === state.currentUser);
  if (own.length === 0) { showToast('Нет ваших заданий'); return; }
  if (!confirm(`Удалить ВСЕ ваши задания (${own.length})?`)) return;

  try {
    const { error } = await supabaseClient
      .from('homework')
      .delete()
      .eq('user_login', state.currentUser);
    if (error) throw error;
    state.hw.items = state.hw.items.filter(h => h.user_login !== state.currentUser);
    renderHomework();
    showToast('Все ваши задания удалены');
  } catch (err) {
    console.error(err);
    showToast('Ошибка: ' + (err.message || 'неизвестная'));
  }
});

document.getElementById('hwImportantBtn').addEventListener('click', () => {
  state.hw.onlyImportant = !state.hw.onlyImportant;
  document.getElementById('hwImportantBtn').classList.toggle('active', state.hw.onlyImportant);
  renderHomework();
});

// ===== REALTIME =====
let hwChannel = null;

function subscribeHwRealtime() {
  if (hwChannel) return;
  if (!supabaseClient) return;
  try {
    hwChannel = supabaseClient
      .channel('homework-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework' }, async () => {
        await loadHwItemsFromCloud();
        if (state.currentView === 'homework') renderHomework();
      })
      .subscribe();
  } catch (e) { console.warn('Realtime не подключился:', e); }
}

function unsubscribeHwRealtime() {
  if (hwChannel && supabaseClient) {
    try { supabaseClient.removeChannel(hwChannel); } catch (_) {}
  }
  hwChannel = null;
}

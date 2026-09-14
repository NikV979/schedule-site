// ================== ФАЙЛЫ ==================
const FILES_BUCKET = 'files';
const FILE_MAX_SIZE = 25 * 1024 * 1024;
const FILE_ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'text/plain'
];

// ===== ИКОНКИ И РАЗМЕРЫ =====
function getFileIconClass(mime) {
  if (!mime) return 'other';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'img';
  if (mime.includes('word')) return 'doc';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'ppt';
  if (mime.startsWith('text/')) return 'txt';
  return 'other';
}

function getFileIconText(mime, name) {
  if (!mime && name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['doc','docx'].includes(ext)) return 'DOC';
    if (['ppt','pptx'].includes(ext)) return 'PPT';
    if (['jpg','jpeg','png'].includes(ext)) return 'IMG';
    if (ext === 'txt') return 'TXT';
  }
  const cls = getFileIconClass(mime);
  if (cls === 'pdf') return 'PDF';
  if (cls === 'doc') return 'DOC';
  if (cls === 'ppt') return 'PPT';
  if (cls === 'img') return 'IMG';
  if (cls === 'txt') return 'TXT';
  return 'FILE';
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function formatFileDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.getDate();
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${hh}:${mm}`;
}

// ===== ЗАГРУЗКА ИЗ SUPABASE =====
async function loadFilesFromCloud() {
  state.files.loading = true;
  showFilesLoading();

  const { data, error } = await supabaseClient
    .from('files')
    .select('id, user_id, user_login, name, size, mime_type, storage_path, subject, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки файлов:', error);
    showToast('Не удалось загрузить файлы');
    state.files.items = [];
  } else {
    state.files.items = data || [];
  }
  state.files.loading = false;
}

function showFilesLoading() {
  const grid = document.getElementById('filesGrid');
  const empty = document.getElementById('filesEmpty');
  if (!grid) return;
  if (empty) empty.classList.remove('active');
  grid.innerHTML = `
    <div class="files-loading" style="grid-column:1/-1;">
      <div class="files-loading-spinner"></div>
      <div>Загружаю файлы…</div>
    </div>`;
}

// ===== ГРУППА ПО ТИПУ ФАЙЛА =====
function getFileTypeGroup(item) {
  const mime = item.mime_type || '';
  const name = item.name || '';
  const ext = name.split('.').pop().toLowerCase();

  if (mime === 'application/pdf' || ext === 'pdf')
    return { key: 'pdf', title: 'PDF', short: 'PDF' };
  if (mime.includes('word') || ['doc','docx'].includes(ext))
    return { key: 'doc', title: 'Документы', short: 'DOC' };
  if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt','pptx'].includes(ext))
    return { key: 'ppt', title: 'Презентации', short: 'PPT' };
  if (mime.startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext))
    return { key: 'img', title: 'Изображения', short: 'IMG' };
  if (mime.startsWith('text/') || ext === 'txt')
    return { key: 'txt', title: 'Тексты', short: 'TXT' };

  return { key: 'other', title: 'Другое', short: 'FILE' };
}

// ===== ПЛИТКА ФАЙЛА =====
function renderFileCard(item) {
  const cls = getFileIconClass(item.mime_type);
  const iconText = getFileIconText(item.mime_type, item.name);
  const canDelete = state.currentUser && item.user_login === state.currentUser;
  const safeName = escapeHtml(item.name);
  return `
    <div class="file-tile" data-id="${item.id}">
      <div class="file-tile-icon ${cls}" data-open-id="${item.id}" title="Открыть">${iconText}</div>
      <div class="file-tile-info">
        <div class="file-tile-name" data-open-id="${item.id}" title="Открыть">${safeName}</div>
        <div class="file-tile-meta">${formatSize(item.size)}</div>
      </div>
      <div class="file-tile-actions">
        <button class="file-tile-btn" data-download-id="${item.id}" title="Скачать">⬇</button>
        ${canDelete ? `<button class="file-tile-btn file-tile-btn-del" data-delete-id="${item.id}" title="Удалить">✕</button>` : ''}
      </div>
    </div>`;
}

function bindFileCardEvents(root) {
  root.querySelectorAll('[data-open-id]').forEach(el => {
    el.addEventListener('click', async e => {
      e.stopPropagation();
      await openFileViewer(el.dataset.openId);
    });
  });
  root.querySelectorAll('[data-download-id]').forEach(el => {
    el.addEventListener('click', async e => {
      e.stopPropagation();
      await downloadFileById(el.dataset.downloadId);
    });
  });
  root.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteFileById(btn.dataset.deleteId);
    });
  });
}

function getFileSubject(item) {
  const s = (item.subject || '').trim();
  return s || 'Без предмета';
}

// ===== БЕЙДЖ В ШАПКЕ: «3 · 9.2 МБ» =====
function updateFilesTabBadge() {
  const badge = document.getElementById('filesTabBadge');
  if (!badge) return;
  const n = state.files.items.length;
  const totalSize = state.files.items.reduce((s, f) => s + (f.size || 0), 0);
  if (n === 0) {
    badge.textContent = '0';
  } else {
    badge.textContent = `${n} · ${formatSize(totalSize)}`;
  }
}

function updateFilesClearBtnState() {
  const btn = document.getElementById('filesClearAllBtn');
  if (!btn) return;
  const hasOwn = state.currentUser && state.files.items.some(f => f.user_login === state.currentUser);
  btn.disabled = !hasOwn;
}

// ===== СПИСОК ВСЕХ ПРЕДМЕТОВ (для сетки как в домашке) =====
function getAllSubjectsForFiles() {
  let subjects = [];
  try {
    if (typeof getAllSubjects === 'function') subjects = getAllSubjects();
  } catch (_) {}
  if (!subjects || subjects.length === 0) {
    subjects = [
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
  return subjects;
}

// ===== КОРОТКАЯ МЕТКА ПО ПРЕДМЕТУ (без обводки, просто текст) =====
function getFileEmojiBySubject(subj) {
  if (!subj || subj === 'Без предмета') return 'FILE';
  const s = subj.toUpperCase();
  if (s.includes('ПСИХ')) return 'ПСИХ';
  if (s.includes('МЕНЕДЖ')) return 'МЕН';
  if (s.includes('ЭКОН')) return 'ЭКОН';
  if (s.includes('ПЕД')) return 'ПЕД';
  if (s.includes('ЕСТ')) return 'ЕСТ';
  if (s.includes('СПОРТ') || s.includes('ФК')) return 'СПОРТ';
  if (s.includes('УПР')) return 'УПР';
  return s.slice(0, 4).replace(/[^А-ЯA-Z0-9]/g, '') || 'FILE';
}

// ===== ОСНОВНОЙ РЕНДЕР =====
function renderFiles() {
  const grid = document.getElementById('filesGrid');
  const empty = document.getElementById('filesEmpty');
  if (!grid || !empty) return;

  if (state.files.loading) {
    updateFilesClearBtnState();
    updateFilesTabBadge();
    return;
  }

  updateFilesTabBadge();

  const q = state.files.searchQuery.trim().toLowerCase();

  // Если ничего нет — показываем empty
  if (state.files.items.length === 0 && !q) {
    grid.innerHTML = '';
    empty.classList.add('active');
    updateFilesClearBtnState();
    return;
  }
  empty.classList.remove('active');

  const filtered = q
    ? state.files.items.filter(f => (f.name || '').toLowerCase().includes(q))
    : state.files.items;

  if (filtered.length === 0 && q) {
    grid.innerHTML = `<div class="files-empty active" style="padding:40px 20px;grid-column:1/-1;">
      <div class="files-empty-text">Ничего не найдено</div>
      <div class="files-empty-hint">Попробуйте изменить запрос.</div>
    </div>`;
    updateFilesClearBtnState();
    return;
  }

  // ===== РЕЖИМ "БЕЗ ГРУППИРОВКИ" — маленькие панельки =====
  if (state.files.groupMode === 'none') {
    grid.innerHTML = filtered.length
      ? `<div class="files-flat-grid">
           ${filtered.map(item => `<div class="files-flat-tile">${renderFileCard(item)}</div>`).join('')}
         </div>`
      : `<div class="files-empty active" style="padding:40px 20px;grid-column:1/-1;">
           <div class="files-empty-text">Файлов нет</div>
         </div>`;
    bindFileCardEvents(grid);
    updateFilesClearBtnState();
    return;
  }

  // ===== ГРУППИРОВКА =====
  const groups = new Map();

  if (state.files.groupMode === 'subject') {
    // Показываем ВСЕ предметы (даже пустые) — как в домашке
    const allSubjects = getAllSubjectsForFiles();
    for (const subj of allSubjects) {
      const style = getSubjectStyle(subj);
      groups.set(subj, { title: subj, style, items: [], emoji: getFileEmojiBySubject(subj) });
    }
    // Файлы без предмета или с предметом вне списка — отдельные группы
    for (const item of filtered) {
      const subj = getFileSubject(item);
      if (!groups.has(subj)) {
        const style = getSubjectStyle(subj);
        groups.set(subj, { title: subj, style, items: [], emoji: getFileEmojiBySubject(subj) });
      }
      groups.get(subj).items.push(item);
    }
  } else if (state.files.groupMode === 'type') {
    const allTypes = [
      { key: 'pdf',  title: 'PDF',          short: 'PDF',  color: { bg: '#C75B5B', text: '#FFFFFF' } },
      { key: 'doc',  title: 'Документы',    short: 'DOC',  color: { bg: '#4A6FA5', text: '#FFFFFF' } },
      { key: 'ppt',  title: 'Презентации',  short: 'PPT',  color: { bg: '#C77E5B', text: '#FFFFFF' } },
      { key: 'img',  title: 'Изображения',  short: 'IMG',  color: { bg: '#6E9E7C', text: '#FFFFFF' } },
      { key: 'txt',  title: 'Тексты',       short: 'TXT',  color: { bg: '#7B8FA1', text: '#FFFFFF' } },
      { key: 'other',title: 'Другое',       short: 'FILE', color: { bg: '#5B4BD6', text: '#FFFFFF' } }
    ];
    for (const t of allTypes) {
      groups.set(t.key, { title: t.title, style: t.color, items: [], emoji: t.short });
    }
    for (const item of filtered) {
      const t = getFileTypeGroup(item);
      if (!groups.has(t.key)) {
        groups.set(t.key, { title: t.title, style: { bg: '#5B4BD6', text: '#FFF' }, items: [], emoji: t.short });
      }
      groups.get(t.key).items.push(item);
    }
  }

  const sortedKeys = [...groups.keys()];

  let html = '';
  for (const key of sortedKeys) {
    const group = groups.get(key);
    if (!group) continue;

    const isExpanded = state.files.expandedSubjects.has(key) || q.length > 0;
    const isEmpty = group.items.length === 0;
    const light = isLightColor(group.style.bg);
    const lightClass = light ? ' light' : '';

    const emojiShort = group.emoji || group.title.slice(0, 3).toUpperCase();

    html += `
      <div class="files-card${isExpanded ? ' expanded' : ''}${isEmpty ? ' files-card-empty' : ''}"
           data-subject="${escapeHtml(key)}"
           style="--fs-accent: ${group.style.bg}; --fs-text: ${group.style.text};">
        <div class="files-card-head${lightClass}">
          <span class="files-card-emoji">${escapeHtml(emojiShort)}</span>
          <span class="files-card-name">${escapeHtml(group.title)}</span>
          <span class="files-card-count">${group.items.length}</span>
        </div>
        <div class="files-card-body">
          ${isEmpty
            ? `<div class="files-card-noitems" style="grid-column:1/-1;text-align:center;padding:14px 0;color:var(--text-secondary);font-style:italic;font-size:12px;opacity:0.7;">Нет файлов</div>`
            : group.items.map(renderFileCard).join('')}
        </div>
      </div>`;
  }
  grid.innerHTML = html;

  // Клики по шапкам — раскрыть/свернуть (у пустых не реагируем)
  grid.querySelectorAll('.files-card-head').forEach(head => {
    head.addEventListener('click', () => {
      const grp = head.closest('.files-card');
      if (grp.classList.contains('files-card-empty')) return;
      const subj = grp.dataset.subject;
      const expanded = grp.classList.toggle('expanded');
      if (expanded) state.files.expandedSubjects.add(subj);
      else state.files.expandedSubjects.delete(subj);
      localStorage.setItem('files-expanded-subjects', JSON.stringify([...state.files.expandedSubjects]));
    });
  });

  bindFileCardEvents(grid);
  updateFilesClearBtnState();
}

// ===== СКАЧИВАНИЕ / УДАЛЕНИЕ =====
async function downloadFileById(id) {
  const item = state.files.items.find(x => String(x.id) === String(id));
  if (!item) return;
  try {
    const { data, error } = await supabaseClient.storage
      .from(FILES_BUCKET)
      .createSignedUrl(item.storage_path, 300);
    if (error || !data) throw new Error(error ? error.message : 'Нет ссылки');

    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error(err);
    showToast('Ошибка скачивания: ' + err.message);
  }
}

async function deleteFileById(id) {
  if (!state.currentUser) {
    showToast('Войдите, чтобы удалять файлы');
    openAuthModal();
    return;
  }
  const item = state.files.items.find(x => String(x.id) === String(id));
  if (!item) return;
  if (!confirm(`Удалить файл?\n\n«${item.name}»`)) return;

  try {
    const { error: storageErr } = await supabaseClient.storage
      .from(FILES_BUCKET)
      .remove([item.storage_path]);
    if (storageErr) console.warn('Storage delete error:', storageErr);

    const { error } = await supabaseClient.from('files').delete().eq('id', id);
    if (error) throw error;

    state.files.items = state.files.items.filter(x => String(x.id) !== String(id));
    renderFiles();
    showToast('Файл удалён');
  } catch (err) {
    console.error(err);
    showToast('Ошибка удаления: ' + err.message);
  }
}

async function clearAllFiles() {
  if (!state.currentUser) {
    showToast('Войдите, чтобы очистить файлы');
    openAuthModal();
    return;
  }
  const ownFiles = state.files.items.filter(f => f.user_login === state.currentUser);
  if (ownFiles.length === 0) { showToast('Нет файлов для удаления'); return; }
  if (!confirm(`Удалить ВСЕ ваши файлы (${ownFiles.length})?\n\nЭто действие нельзя отменить.`)) return;

  const btn = document.getElementById('filesClearAllBtn');
  const oldText = btn ? btn.textContent : 'Очистить всё';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Удаляю…';
  }

  try {
    const paths = ownFiles.map(f => f.storage_path);

    if (paths.length > 0) {
      const { error: storageErr } = await supabaseClient.storage
        .from(FILES_BUCKET)
        .remove(paths);
      if (storageErr) console.warn('Storage cleanup warning:', storageErr);
    }

    const { error } = await supabaseClient
      .from('files')
      .delete()
      .eq('user_login', state.currentUser);

    if (error) throw error;

    state.files.items = state.files.items.filter(f => f.user_login !== state.currentUser);
    renderFiles();
    showToast('Все ваши файлы удалены');
  } catch (err) {
    console.error(err);
    showToast('Ошибка удаления: ' + (err.message || 'неизвестная'));
  } finally {
    if (btn) btn.textContent = oldText;
    updateFilesClearBtnState();
  }
}

// ================== ПРОСМОТРЩИК ФАЙЛОВ ==================
const fileViewerOverlay = document.getElementById('fileViewerOverlay');
const fileViewerBody = document.getElementById('fileViewerBody');
const fileViewerTitle = document.getElementById('fileViewerTitle');
let currentViewerItem = null;

const VIEWER_GOOGLE = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

async function openFileViewer(id) {
  const item = state.files.items.find(x => String(x.id) === String(id));
  if (!item) return;

  currentViewerItem = item;
  fileViewerTitle.textContent = item.name;
  fileViewerBody.innerHTML = `
    <div class="file-viewer-loading">
      <div class="file-viewer-spinner"></div>
      <div>Открываю файл…</div>
    </div>
  `;
  fileViewerOverlay.classList.add('active');

  try {
    const { data, error } = await supabaseClient.storage
      .from(FILES_BUCKET)
      .createSignedUrl(item.storage_path, 3600);
    if (error || !data) throw new Error(error ? error.message : 'Нет ссылки');

    const url = data.signedUrl;
    const mime = item.mime_type || '';

    if (mime === 'application/pdf') {
      fileViewerBody.innerHTML = `<iframe src="${url}#toolbar=1" type="application/pdf"></iframe>`;
      return;
    }

    if (mime === 'image/jpeg' || mime === 'image/png') {
      fileViewerBody.innerHTML = `<img src="${url}" alt="">`;
      return;
    }

    if (mime === 'text/plain') {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Не удалось прочитать файл (' + resp.status + ')');

      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (ct && !ct.startsWith('text/') && !ct.includes('plain') && !ct.includes('octet-stream')) {
        throw new Error('Сервер вернул не текстовый файл: ' + ct);
      }

      const text = await resp.text();

      if (/^\s*<!DOCTYPE\s+html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
        throw new Error('Файл повреждён или недоступен');
      }

      const pre = document.createElement('pre');
      pre.textContent = text;
      fileViewerBody.innerHTML = '';
      fileViewerBody.appendChild(pre);
      return;
    }

    if (VIEWER_GOOGLE.includes(mime)) {
      const googleUrl = 'https://docs.google.com/viewer?url=' + encodeURIComponent(url) + '&embedded=true';
      fileViewerBody.innerHTML = `<iframe src="${googleUrl}" allowfullscreen></iframe>`;
      return;
    }

    showViewerFallback();
  } catch (err) {
    console.error(err);
    fileViewerBody.innerHTML = `
      <div class="file-viewer-error">
        <div class="file-viewer-error-icon">⚠️</div>
        <div class="file-viewer-error-text">Не удалось открыть файл</div>
        <div class="file-viewer-error-hint">${escapeHtml(err.message || 'Неизвестная ошибка')}. Попробуйте скачать файл.</div>
      </div>
    `;
  }
}

function showViewerFallback() {
  fileViewerBody.innerHTML = `
    <div class="file-viewer-error">
      <div class="file-viewer-error-icon">📄</div>
      <div class="file-viewer-error-text">Формат не поддерживается для просмотра</div>
      <div class="file-viewer-error-hint">Нажмите «Скачать», чтобы открыть файл на устройстве.</div>
    </div>
  `;
}

function closeFileViewer() {
  fileViewerOverlay.classList.remove('active');
  fileViewerBody.innerHTML = '';
  currentViewerItem = null;
}

document.getElementById('fileViewerCloseBtn').addEventListener('click', closeFileViewer);

document.getElementById('fileViewerDownloadBtn').addEventListener('click', async () => {
  if (!currentViewerItem) return;
  await downloadFileById(currentViewerItem.id);
});

fileViewerOverlay.addEventListener('click', e => {
  if (e.target === fileViewerOverlay) closeFileViewer();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && fileViewerOverlay.classList.contains('active')) {
    closeFileViewer();
  }
});

// ================== МОДАЛКА ЗАГРУЗКИ ФАЙЛА ==================
const fileModal = document.getElementById('fileModal');
const fileInput = document.getElementById('fileInput');
const filePickArea = document.getElementById('filePickArea');
const filePickText = document.getElementById('filePickText');
const fileDisplayName = document.getElementById('fileDisplayName');
let pickedFile = null;

function fillFileSubjectSelect() {
  const sel = document.getElementById('fileSubject');
  if (!sel) return;
  let subjects = [];
  try { subjects = getAllSubjects(); } catch (_) { subjects = []; }
  sel.innerHTML =
    `<option value="">— Без предмета —</option>` +
    subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function openFileModal() {
  if (!state.currentUser) {
    showToast('Войдите, чтобы загружать файлы');
    openAuthModal();
    return;
  }
  pickedFile = null;
  fileInput.value = '';
  fileDisplayName.value = '';
  filePickText.textContent = 'Нажмите, чтобы выбрать файл';
  filePickArea.classList.remove('has-file', 'error');
  fillFileSubjectSelect();
  const subjSel = document.getElementById('fileSubject');
  if (subjSel) subjSel.value = '';
  fileModal.classList.add('active');
}

function closeFileModal() {
  fileModal.classList.remove('active');
  pickedFile = null;
  fileInput.value = '';
}

filePickArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;

  if (!FILE_ALLOWED_MIME.includes(f.type)) {
    filePickArea.classList.add('error');
    filePickArea.classList.remove('has-file');
    filePickText.textContent = 'Формат не разрешён';
    showToast('Можно загружать только PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, TXT');
    pickedFile = null;
    return;
  }
  if (f.size > FILE_MAX_SIZE) {
    filePickArea.classList.add('error');
    filePickArea.classList.remove('has-file');
    filePickText.textContent = 'Файл слишком большой';
    showToast('Максимум 25 МБ на файл');
    pickedFile = null;
    return;
  }

  pickedFile = f;
  filePickArea.classList.add('has-file');
  filePickArea.classList.remove('error');
  filePickText.textContent = f.name + ' (' + formatSize(f.size) + ')';

  if (!fileDisplayName.value) {
    const baseName = f.name.replace(/\.[^.]+$/, '');
    fileDisplayName.value = baseName;
  }
});

async function uploadPickedFile() {
  if (!state.currentUser || !state.currentUserId) {
    showToast('Войдите в аккаунт, чтобы загружать файлы');
    openAuthModal();
    return;
  }
  if (!pickedFile) { showToast('Сначала выберите файл'); return; }

  const saveBtn = document.getElementById('fileSave');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Загружаю…';

  try {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const cleanName = pickedFile.name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(-80);
    const storagePath = `${state.currentUserId}/${unique}_${cleanName}`;

    const { error: uploadErr } = await supabaseClient.storage
      .from(FILES_BUCKET)
      .upload(storagePath, pickedFile, {
        contentType: pickedFile.type,
        upsert: false
      });
    if (uploadErr) throw uploadErr;

    const displayName = (fileDisplayName.value.trim() || pickedFile.name).slice(0, 120);
    const subjectValue = (document.getElementById('fileSubject').value || '').trim() || null;

    const { error: dbErr } = await supabaseClient.from('files').insert({
      user_id: state.currentUserId,
      user_login: state.currentUser,
      name: displayName,
      size: pickedFile.size,
      mime_type: pickedFile.type,
      storage_path: storagePath,
      subject: subjectValue
    });

    if (dbErr) {
      await supabaseClient.storage.from(FILES_BUCKET).remove([storagePath]);
      throw dbErr;
    }

    showToast('Файл загружен');
    closeFileModal();
    await loadFilesFromCloud();
    renderFiles();
  } catch (err) {
    console.error(err);
    showToast('Ошибка загрузки: ' + (err.message || 'неизвестная'));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Загрузить';
  }
}

// ===== ОБРАБОТЧИКИ =====
const filesUploadTopBtn = document.getElementById('filesUploadTopBtn');
if (filesUploadTopBtn) filesUploadTopBtn.addEventListener('click', openFileModal);

const filesClearAllBtn = document.getElementById('filesClearAllBtn');
if (filesClearAllBtn) filesClearAllBtn.addEventListener('click', clearAllFiles);

document.getElementById('fileModalClose').addEventListener('click', closeFileModal);
document.getElementById('fileCancel').addEventListener('click', closeFileModal);
document.getElementById('fileSave').addEventListener('click', uploadPickedFile);
fileModal.addEventListener('click', e => { if (e.target === fileModal) closeFileModal(); });

// Поиск по файлам (в шапке)
const filesSearchInput = document.getElementById('filesSearchInput');
if (filesSearchInput) {
  filesSearchInput.addEventListener('input', e => {
    state.files.searchQuery = e.target.value;
    renderFiles();
  });
}

// Группировка (в шапке)
const filesGroupModeEl = document.getElementById('filesGroupMode');
if (filesGroupModeEl) {
  filesGroupModeEl.value = state.files.groupMode || 'subject';

  filesGroupModeEl.addEventListener('change', e => {
    state.files.groupMode = e.target.value;
    localStorage.setItem('files-group-mode', state.files.groupMode);
    state.files.expandedSubjects.clear();
    localStorage.removeItem('files-expanded-subjects');
    renderFiles();
  });
}

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
    <div class="files-loading">
      <div class="files-loading-spinner"></div>
      <div>Загружаю файлы…</div>
    </div>`;
}

// ===== ПЛИТКА ФАЙЛА (карточка-плитка для сетки) =====
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

function updateFilesClearBtnState() {
  const btn = document.getElementById('filesClearBtn');
  if (!btn) return;
  const hasOwn = state.currentUser && state.files.items.some(f => f.user_login === state.currentUser);
  btn.disabled = !hasOwn;
}

function renderFiles() {
  const grid = document.getElementById('filesGrid');
  const empty = document.getElementById('filesEmpty');
  const countEl = document.getElementById('filesTotalCount');
  const sizeEl = document.getElementById('filesTotalSize');
  if (!grid || !empty) return;

  if (state.files.loading) { updateFilesClearBtnState(); return; }

  const totalSize = state.files.items.reduce((s, f) => s + (f.size || 0), 0);
  if (countEl) {
    const n = state.files.items.length;
    let word = 'файлов';
    if (n % 10 === 1 && n % 100 !== 11) word = 'файл';
    else if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) word = 'файла';
    countEl.textContent = `${n} ${word}`;
  }
  if (sizeEl) sizeEl.textContent = formatSize(totalSize);

  if (state.files.items.length === 0) {
    grid.innerHTML = '';
    empty.classList.add('active');
    updateFilesClearBtnState();
    return;
  }
  empty.classList.remove('active');

  const q = state.files.searchQuery.trim().toLowerCase();
  const filtered = q
    ? state.files.items.filter(f => (f.name || '').toLowerCase().includes(q))
    : state.files.items;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="files-empty active" style="padding:40px 20px;">
      <div class="files-empty-text">Ничего не найдено</div>
      <div class="files-empty-hint">Попробуйте изменить запрос.</div>
    </div>`;
    updateFilesClearBtnState();
    return;
  }

  // Без группировки — просто сетка плиток
  if (!state.files.groupEnabled) {
    grid.innerHTML = `<div class="files-tiles-grid">${filtered.map(renderFileCard).join('')}</div>`;
    bindFileCardEvents(grid);
    updateFilesClearBtnState();
    return;
  }

  // С группировкой по предметам
  const groups = new Map();
  for (const item of filtered) {
    const subj = getFileSubject(item);
    if (!groups.has(subj)) groups.set(subj, []);
    groups.get(subj).push(item);
  }

  const subjects = [...groups.keys()].sort((a, b) => {
    if (a === 'Без предмета') return 1;
    if (b === 'Без предмета') return -1;
    return a.localeCompare(b, 'ru');
  });

  let html = '';
  for (const subj of subjects) {
    const items = groups.get(subj);
    const isExpanded = state.files.expandedSubjects.has(subj) || q.length > 0;

    const style = getSubjectStyle(subj);
    const light = isLightColor(style.bg);
    const lightClass = light ? ' light' : '';

    html += `
      <div class="files-subject-group${isExpanded ? ' expanded' : ''}" data-subject="${escapeHtml(subj)}"
           style="--fs-accent: ${style.bg}; --fs-text: ${style.text};">
        <div class="files-subject-head${lightClass}">
          <span class="files-subject-arrow">▸</span>
          <span class="files-subject-name">${escapeHtml(subj)}</span>
          <span class="files-subject-count">${items.length}</span>
        </div>
        <div class="files-subject-list">
          <div class="files-tiles-grid">${items.map(renderFileCard).join('')}</div>
        </div>
      </div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.files-subject-head').forEach(head => {
    head.addEventListener('click', () => {
      const group = head.closest('.files-subject-group');
      const subj = group.dataset.subject;
      const expanded = group.classList.toggle('expanded');
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

  const btn = document.getElementById('filesClearBtn');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Удаляю…';

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
    btn.textContent = oldText;
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

document.getElementById('filesUploadBtn').addEventListener('click', openFileModal);
document.getElementById('filesClearBtn').addEventListener('click', clearAllFiles);
document.getElementById('fileModalClose').addEventListener('click', closeFileModal);
document.getElementById('fileCancel').addEventListener('click', closeFileModal);
document.getElementById('fileSave').addEventListener('click', uploadPickedFile);
fileModal.addEventListener('click', e => { if (e.target === fileModal) closeFileModal(); });

// Поиск по файлам
const filesSearchInput = document.getElementById('filesSearchInput');
if (filesSearchInput) {
  filesSearchInput.addEventListener('input', e => {
    state.files.searchQuery = e.target.value;
    renderFiles();
  });
}

// Переключатель группировки
const filesGroupToggle = document.getElementById('filesGroupToggle');
if (filesGroupToggle) {
  filesGroupToggle.checked = state.files.groupEnabled;
  filesGroupToggle.addEventListener('change', e => {
    state.files.groupEnabled = e.target.checked;
    localStorage.setItem('files-group-enabled', state.files.groupEnabled ? '1' : '0');
    renderFiles();
  });
}

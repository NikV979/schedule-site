// ========== АВАТАРЫ ==========
const AVATAR_BUCKET = 'avatars';

function avatarPath(userId) { return `${userId}/avatar.jpg`; }

async function getAvatarSignedUrl(userId, expiresIn = 3600) {
  if (!userId) return null;
  const { data, error } = await supabaseClient.storage
    .from(AVATAR_BUCKET).createSignedUrl(avatarPath(userId), expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

async function avatarExists(userId) {
  if (!userId) return false;
  try {
    const { data, error } = await supabaseClient.storage
      .from(AVATAR_BUCKET).list(userId, { limit: 10 });
    if (error) return false;
    return (data || []).some(f => f.name && f.name.startsWith('avatar.'));
  } catch (_) { return false; }
}

async function refreshAvatarUI() {
  const btnIcon = document.getElementById('authBtnIcon');
  const btnPhoto = document.getElementById('authBtnPhoto');
  const sideFallback = document.querySelector('#sidebarAvatar .sidebar-logo-fallback');
  const sideImg = document.getElementById('sidebarAvatarImg');

  if (state.avatar.timer) { clearTimeout(state.avatar.timer); state.avatar.timer = null; }

  const reset = () => {
    state.avatar.currentAvatarUrl = null;
    if (btnIcon) btnIcon.style.display = '';
    if (btnPhoto) { btnPhoto.style.display = 'none'; btnPhoto.src = ''; }
    if (sideFallback) sideFallback.style.display = '';
    if (sideImg) { sideImg.style.display = 'none'; sideImg.src = ''; }
  };

  if (!state.currentUserId) return reset();
  if (!(await avatarExists(state.currentUserId))) return reset();

  const url = await getAvatarSignedUrl(state.currentUserId, 3600);
  if (!url) return reset();

  state.avatar.currentAvatarUrl = url;
  if (btnIcon) btnIcon.style.display = 'none';
  if (btnPhoto) { btnPhoto.src = url; btnPhoto.style.display = 'block'; }
  if (sideFallback) sideFallback.style.display = 'none';
  if (sideImg) { sideImg.src = url; sideImg.style.display = 'block'; }

  state.avatar.timer = setTimeout(() => {
    if (!document.hidden) refreshAvatarUI();
  }, (3600 - 300) * 1000);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!state.currentUserId) return;
  refreshAvatarUI();
});

// ========== ИМЯ ПОЛЬЗОВАТЕЛЯ (хранится в Supabase metadata) ==========
function displayName(login) {
  if (!login) return '';
  return login;
}

async function getUserName() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return '';
    return (user.user_metadata && user.user_metadata.name) || '';
  } catch (_) { return ''; }
}

async function setUserName(name) {
  const clean = String(name).trim().slice(0, 60);
  if (!clean) return { ok: false, msg: 'Введите имя' };
  const { error } = await supabaseClient.auth.updateUser({
    data: { name: clean }
  });
  if (error) return { ok: false, msg: 'Ошибка: ' + error.message };
  return { ok: true, name: clean };
}

// ========== ЛОГИН / ЛОГАУТ ==========
function loginFromEmail(email) {
  if (!email) return null;
  const m = email.match(/^([^@]+)@/);
  return m ? m[1] : null;
}

async function refreshUser() {
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session && data.session.user) {
    state.currentUser = loginFromEmail(data.session.user.email);
    state.currentUserId = data.session.user.id;
  } else {
    state.currentUser = null;
    state.currentUserId = null;
  }
  await updateAuthUI();

  if (state.currentUserId) {
    subscribeHwRealtime();
    const name = await getUserName();
    if (!name) openNameModal();
  } else {
    unsubscribeHwRealtime();
  }
  await refreshAvatarUI();
}

async function updateAuthUI() {
  const btn = document.getElementById('authBtn');
  const sideUser = document.getElementById('sidebarUser');
  if (!btn) return;

  if (state.currentUser) {
    btn.classList.add('logged-in');

    let name = await getUserName();
    if (!name) name = state.currentUser;

    btn.title = 'Вы вошли как ' + name;
    if (sideUser) {
      sideUser.textContent = name;
      sideUser.classList.add('visible');
    }
  } else {
    btn.classList.remove('logged-in');
    btn.title = 'Войти';
    if (sideUser) { sideUser.textContent = ''; sideUser.classList.remove('visible'); }
  }
  updateHwAddBtnState();
  if (typeof updateFilesClearBtnState === 'function') updateFilesClearBtnState();
}

async function tryLogin(login, password) {
  const clean = String(login).trim();
  if (!clean) return { ok: false, msg: 'Введите логин.' };
  const email = `${clean}@dnevnik.local`;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid/i.test(error.message)) return { ok: false, msg: 'Неверный логин или пароль.' };
    return { ok: false, msg: 'Ошибка: ' + error.message };
  }
  state.currentUser = clean;
  state.currentUserId = data.session.user.id;
  subscribeHwRealtime();
  await refreshAvatarUI();
  return { ok: true, login: clean };
}

async function logout() {
  unsubscribeHwRealtime();
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  state.currentUserId = null;
  state.hw.expandedSubjects.clear();
  state.files.expandedSubjects.clear();
  state.hw.items = [];
  state.files.items = [];
  state.files.searchQuery = '';

  await refreshAvatarUI();
  await updateAuthUI();

  if (state.currentView === 'homework') renderHomework();
  if (state.currentView === 'files') {
    const inp = document.getElementById('filesSearchInput');
    if (inp) inp.value = '';
    renderFiles();
  }
  showToast('Вы вышли из аккаунта');
}

// ========== UI МОДАЛОК АВТОРИЗАЦИИ ==========
const authOverlay = document.getElementById('authOverlay');
const authLoginInput = document.getElementById('authLogin');
const authPasswordInput = document.getElementById('authPassword');
const authError = document.getElementById('authError');

function openAuthModal() {
  authError.textContent = '';
  authPasswordInput.value = '';
  authOverlay.classList.add('active');
  setTimeout(() => authLoginInput.focus(), 60);
}
function closeAuthModal() { authOverlay.classList.remove('active'); }

async function submitAuth() {
  const login = authLoginInput.value.trim();
  const pass = authPasswordInput.value;
  const consent = document.getElementById('authConsent');

  if (!login) { authError.textContent = 'Введите логин.'; return; }
  if (!pass) { authError.textContent = 'Введите пароль.'; return; }
  if (consent && !consent.checked) {
    authError.textContent = 'Отметьте согласие на обработку данных.';
    return;
  }

  const submitBtn = document.getElementById('authSubmit');
  const skipBtn = document.getElementById('authSkip');
  submitBtn.disabled = true; skipBtn.disabled = true;
  submitBtn.textContent = 'Вход…';

  const res = await tryLogin(login, pass);

  submitBtn.disabled = false; skipBtn.disabled = false;
  submitBtn.textContent = 'Войти';

  if (res.ok) {
    closeAuthModal();
    await updateAuthUI();
    if (state.currentView === 'homework') { await loadHwItemsFromCloud(); renderHomework(); }
    if (state.currentView === 'files') { await loadFilesFromCloud(); renderFiles(); }

    const name = await getUserName();
    if (!name) {
      openNameModal();
    } else {
      showToast('Добро пожаловать, ' + name + '!');
    }
  } else {
    authError.textContent = res.msg;
    authPasswordInput.value = '';
    authPasswordInput.focus();
  }
}

document.getElementById('authBtn').addEventListener('click', () => {
  if (state.currentUser) openAvatarModal();
  else openAuthModal();
});
document.getElementById('authClose').addEventListener('click', closeAuthModal);
document.getElementById('authSkip').addEventListener('click', closeAuthModal);
document.getElementById('authSubmit').addEventListener('click', submitAuth);
authOverlay.addEventListener('click', e => { if (e.target === authOverlay) closeAuthModal(); });
authPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
authLoginInput.addEventListener('keydown', e => { if (e.key === 'Enter') authPasswordInput.focus(); });

// ========== МОДАЛКА ПРОФИЛЯ ==========
const avatarModal = document.getElementById('avatarModal');
const avatarFileInput = document.getElementById('avatarFileInput');
const avatarPreview = document.getElementById('avatarPreview');
const avatarPreviewPlaceholder = document.getElementById('avatarPreviewPlaceholder');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');

async function openAvatarModal() {
  if (!state.currentUser) { showToast('Сначала войдите'); openAuthModal(); return; }
  updateAvatarPreview();

  // Загружаем текущее имя в поле
  const nameInput = document.getElementById('profileNameInput');
  if (nameInput) {
    const currentName = await getUserName();
    nameInput.value = currentName || '';
  }

  // Скрываем кнопку «Сохранить» до первого изменения
  const saveBtn = document.getElementById('avatarSaveBtn');
  if (saveBtn) saveBtn.style.display = 'none';

  avatarModal.classList.add('active');
}

function closeAvatarModal() {
  avatarModal.classList.remove('active');
  if (state.avatar.objectUrl) {
    URL.revokeObjectURL(state.avatar.objectUrl);
    state.avatar.objectUrl = null;
  }
  avatarFileInput.value = '';
  const saveBtn = document.getElementById('avatarSaveBtn');
  if (saveBtn) saveBtn.style.display = 'none';
}

function updateAvatarPreview() {
  const oldImg = avatarPreview.querySelector('img');
  if (oldImg) oldImg.remove();

  if (state.avatar.objectUrl) {
    const img = document.createElement('img');
    img.src = state.avatar.objectUrl;
    avatarPreview.appendChild(img);
    if (avatarPreviewPlaceholder) avatarPreviewPlaceholder.style.display = 'none';
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = '';
    return;
  }
  if (state.avatar.currentAvatarUrl) {
    const img = document.createElement('img');
    img.src = state.avatar.currentAvatarUrl;
    avatarPreview.appendChild(img);
    if (avatarPreviewPlaceholder) avatarPreviewPlaceholder.style.display = 'none';
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = '';
  } else {
    if (avatarPreviewPlaceholder) avatarPreviewPlaceholder.style.display = '';
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = 'none';
  }
}

avatarPreview.addEventListener('click', () => { if (state.currentUser) avatarFileInput.click(); });
avatarUploadBtn.addEventListener('click', () => { if (state.currentUser) avatarFileInput.click(); });

avatarFileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { showToast('Только JPG, PNG или WebP'); avatarFileInput.value = ''; return; }
  if (f.size > 2 * 1024 * 1024) { showToast('Файл больше 2 МБ'); avatarFileInput.value = ''; return; }

  if (state.avatar.objectUrl) URL.revokeObjectURL(state.avatar.objectUrl);
  state.avatar.objectUrl = URL.createObjectURL(f);
  updateAvatarPreview();
  const saveBtn = document.getElementById('avatarSaveBtn');
  if (saveBtn) saveBtn.style.display = '';
});

// При изменении имени показываем кнопку «Сохранить»
const profileNameInput = document.getElementById('profileNameInput');
if (profileNameInput) {
  profileNameInput.addEventListener('input', () => {
    const saveBtn = document.getElementById('avatarSaveBtn');
    if (saveBtn) saveBtn.style.display = '';
  });
  profileNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('avatarSaveBtn').click();
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Не удалось сжать'));
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Не удалось прочитать файл'));
    img.src = URL.createObjectURL(file);
  });
}

// Кнопка «Сохранить» — сохраняет и фото, и имя
document.getElementById('avatarSaveBtn').addEventListener('click', async () => {
  if (!state.currentUser || !state.currentUserId) return;

  const f = avatarFileInput.files && avatarFileInput.files[0];
  const nameInput = document.getElementById('profileNameInput');
  const newName = nameInput ? nameInput.value.trim() : '';

  // Смотрим, изменилось ли имя
  const currentName = await getUserName();
  const nameChanged = newName && newName !== currentName;

  if (!f && !nameChanged) {
    showToast('Ничего не изменилось');
    return;
  }

  const saveBtn = document.getElementById('avatarSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Сохраняю…';

  try {
    // 1. Сохраняем фото, если выбрано
    if (f) {
      const blob = await compressImage(f);
      const { error } = await supabaseClient.storage
        .from(AVATAR_BUCKET)
        .upload(avatarPath(state.currentUserId), blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    }

    // 2. Сохраняем имя, если изменилось
    if (nameChanged) {
      const res = await setUserName(newName);
      if (!res.ok) throw new Error(res.msg);
    }

    showToast('Профиль обновлён');
    closeAvatarModal();
    await refreshAvatarUI();
    await updateAuthUI();
  } catch (err) {
    console.error(err);
    showToast('Ошибка сохранения: ' + (err.message || 'неизвестная'));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Сохранить';
  }
});

avatarRemoveBtn.addEventListener('click', async () => {
  if (!state.currentUser || !state.currentUserId) return;
  if (!confirm('Удалить фото профиля?')) return;
  avatarRemoveBtn.disabled = true; avatarRemoveBtn.textContent = 'Удаляю…';
  try {
    const { error } = await supabaseClient.storage
      .from(AVATAR_BUCKET).remove([avatarPath(state.currentUserId)]);
    if (error) throw error;
    showToast('Фото удалено');
    closeAvatarModal();
    await refreshAvatarUI();
  } catch (err) {
    console.error(err);
    showToast('Ошибка удаления: ' + (err.message || 'неизвестная'));
  } finally {
    avatarRemoveBtn.disabled = false; avatarRemoveBtn.textContent = 'Удалить фото';
  }
});

document.getElementById('avatarModalClose').addEventListener('click', closeAvatarModal);
avatarModal.addEventListener('click', e => { if (e.target === avatarModal) closeAvatarModal(); });
document.getElementById('avatarLogoutBtn').addEventListener('click', async () => {
  if (confirm('Выйти из аккаунта?')) { closeAvatarModal(); await logout(); }
});

// ========== ПОДСТРОЙКА ПОД КЛАВИАТУРУ (мобильные) ==========
if (window.visualViewport) {
  const updateVVH = () => {
    document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
  };
  window.visualViewport.addEventListener('resize', updateVVH);
  window.visualViewport.addEventListener('scroll', updateVVH);
  updateVVH();
}

// ========== АВТОСКРОЛЛ К ПОЛЮ ПРИ ФОКУСЕ ==========
function attachFocusScroll(input) {
  if (!input) return;
  input.addEventListener('focus', () => {
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  });
}
attachFocusScroll(authLoginInput);
attachFocusScroll(authPasswordInput);
attachFocusScroll(document.getElementById('hwTask'));
attachFocusScroll(document.getElementById('hwDeadline'));
attachFocusScroll(document.getElementById('fileDisplayName'));
attachFocusScroll(document.getElementById('profileNameInput'));

// ========== МОДАЛКА ВВОДА ИМЕНИ ==========
const nameModal = document.getElementById('nameModal');
const userNameInput = document.getElementById('userNameInput');

function openNameModal() {
  if (!nameModal) return;
  userNameInput.value = '';
  nameModal.classList.add('active');
  setTimeout(() => userNameInput.focus(), 80);
}
function closeNameModal() {
  if (!nameModal) return;
  nameModal.classList.remove('active');
}

async function saveUserName() {
  const name = userNameInput.value.trim();
  if (!name) { showToast('Введите имя'); userNameInput.focus(); return; }

  const btn = document.getElementById('userNameSave');
  btn.disabled = true; btn.textContent = 'Сохраняю…';

  const res = await setUserName(name);

  btn.disabled = false; btn.textContent = 'Сохранить';

  if (!res.ok) { showToast(res.msg); return; }

  closeNameModal();
  await updateAuthUI();
  showToast('Приятно познакомиться, ' + res.name + '!');
}

if (nameModal) {
  document.getElementById('userNameSave').addEventListener('click', saveUserName);
  userNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveUserName();
  });
  nameModal.addEventListener('click', e => {
    if (e.target === nameModal) closeNameModal();
  });
}

// ========== СОГЛАСИЕ И ПОЛИТИКА ПДН ==========
const privacyModal = document.getElementById('privacyModal');

let privacyCameFromAuth = false;

function openPrivacyModal() {
  if (!privacyModal) return;
  privacyModal.classList.add('active');
}

function closePrivacyModal() {
  if (!privacyModal) return;
  privacyModal.classList.remove('active');
  if (privacyCameFromAuth) {
    privacyCameFromAuth = false;
    setTimeout(() => openAuthModal(), 160);
  }
}

const privacyLink = document.getElementById('privacyLink');
if (privacyLink) {
  privacyLink.addEventListener('click', e => {
    e.preventDefault();
    privacyCameFromAuth = authOverlay.classList.contains('active');
    if (privacyCameFromAuth) closeAuthModal();
    openPrivacyModal();
  });
}
const privacyModalClose = document.getElementById('privacyModalClose');
if (privacyModalClose) {
  privacyModalClose.addEventListener('click', closePrivacyModal);
}
const privacyOkBtn = document.getElementById('privacyOkBtn');
if (privacyOkBtn) {
  privacyOkBtn.addEventListener('click', closePrivacyModal);
}
if (privacyModal) {
  privacyModal.addEventListener('click', e => {
    if (e.target === privacyModal) closePrivacyModal();
  });
}

// ========== FULLSCREEN ==========
const fsBtn = document.getElementById('fsBtn');

function updateFsIcon() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  fsBtn.textContent = fs ? '⤢' : '⛶';
  fsBtn.title = fs ? 'Выйти из полноэкранного' : 'Во весь экран';
}

async function toggleFullscreen() {
  const el = document.documentElement;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (!isFs) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch (e) { showToast('Полный экран недоступен'); }
  updateFsIcon();
}

fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFsIcon);
document.addEventListener('webkitfullscreenchange', updateFsIcon);

// ========== ТЕМА ==========
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('schedule-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0D18' : '#FFFFFF');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '🌙';
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
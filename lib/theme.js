const STORAGE_KEY = 'wif:theme';
const root = document.documentElement;

function current() {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
  root.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  syncToggleLabel();
}

function syncToggleLabel() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const next = current() === 'dark' ? 'light' : 'dark';
  btn.setAttribute('aria-label', `Switch to ${next} theme`);
}

export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark'));
  syncToggleLabel();
}

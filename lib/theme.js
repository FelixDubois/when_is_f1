import { t, onLangChange } from './i18n.js';

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
  btn.setAttribute('aria-label', t(current() === 'dark' ? 'theme.toLight' : 'theme.toDark'));
}

let wired = false;
export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (btn && !wired) {
    btn.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark'));
    onLangChange(syncToggleLabel);
    wired = true;
  }
  syncToggleLabel();
}

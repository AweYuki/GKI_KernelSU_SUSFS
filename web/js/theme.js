/**
 * Theme switcher module (dark / light).
 * Priority: localStorage > OS prefers-color-scheme > dark.
 * Shared across the dashboard and guide pages via the same storage key.
 */

import { getStored, setStored } from './utils.js';

var STORAGE_KEY = 'theme';

// Resolve initial theme preference
export function resolveInitialTheme() {
  var saved = getStored(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

// Apply theme attribute and meta theme-color to the root element
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#111214' : '#f7f6f2');
}

/**
 * Initialize theme toggle button.
 * @param {object} opts  { button: HTMLElement, labels: { light, dark }, onChange }
 */
export function initTheme(opts) {
  var theme = resolveInitialTheme();
  applyTheme(theme);

  var button = opts && opts.button;
  if (!button) return;

  function syncButton() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    var label = opts.labels ? (next === 'light' ? opts.labels.light : opts.labels.dark) : next;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.dataset.theme = current;
  }

  syncButton();

  button.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    setStored(STORAGE_KEY, next);
    applyTheme(next);
    syncButton();
    if (opts.onChange) opts.onChange(next);
  });
}

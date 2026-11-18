/**
 * Shared utility helpers.
 */

import { RUNTIME_CACHE_KEY } from './config.js';

// Escape arbitrary text into safe HTML entities
export function esc(str) {
  var el = document.createElement('span');
  el.textContent = str == null ? '' : String(str);
  return el.innerHTML;
}

// Copy text to clipboard (with fallback for older browsers)
export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* Silently ignore if unsupported */ }
  document.body.removeChild(ta);
  return Promise.resolve();
}

// Append runtime cache-busting query parameter to a URL
export function withCacheKey(url) {
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(RUNTIME_CACHE_KEY);
}

// Fetch JSON bypassing browser cache
export async function fetchJsonFresh(url) {
  var r = await fetch(withCacheKey(url), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Safe localStorage wrappers (localStorage throws in private browsing or when cookies/storage are disabled)
export function getStored(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function setStored(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* Silently ignore when storage is unavailable */ }
}

// Check whether the user prefers reduced motion
export function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Simple placeholder interpolation: fmt('{a} / {b}', { a: 1, b: 2 })
export function fmt(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, function (_, key) {
    return vars && vars[key] != null ? vars[key] : '';
  });
}

/**
 * Toast notification module.
 */

var toastEl = null;
var toastTimer = null;

export function showToast(msg) {
  if (!toastEl) toastEl = document.getElementById('toast');
  if (!toastEl) return;
  // Native <dialog> renders in the top layer, masking elements in <body>; attach toast inside any open dialog so it stays on top
  var host = document.querySelector('dialog[open]') || document.body;
  if (toastEl.parentNode !== host) host.appendChild(toastEl);
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(function () {
    toastEl.classList.remove('show');
  }, 1800);
}

/**
 * Guide page entry point: shares theme & i18n modules, provides TOC scroll-spy and screenshot lightbox.
 */

import '../scss/guide.scss';

import { t, lang, initI18n } from './i18n.js';
import { initTheme } from './theme.js';
import { initBackToTop } from './back-to-top.js';

// initI18n overwrites document.title with the dashboard title; preserve the guide's own default title
var pageTitle = document.title;
initI18n();
document.title = pageTitle;
initTheme({
  button: document.getElementById('themeToggle'),
  labels: { light: t.light, dark: t.dark },
});
initBackToTop();

// ---- Guide body localization: English is in static HTML; Vietnamese & Chinese come from data-vi / data-zh ----
if (lang === 'vi' || lang === 'zh') {
  var textAttr = 'data-' + lang;
  document.querySelectorAll('[' + textAttr + ']').forEach(function (el) {
    el.innerHTML = el.getAttribute(textAttr);
  });
  var altAttr = 'data-alt-' + lang;
  document.querySelectorAll('[' + altAttr + ']').forEach(function (el) {
    el.setAttribute('alt', el.getAttribute(altAttr));
  });
  var localizedTitle = document.documentElement.getAttribute('data-title-' + lang);
  if (localizedTitle) document.title = localizedTitle;
}

// ---- Lightbox ----
var lightbox = document.getElementById('lightbox');
var lightboxImg = document.getElementById('lightboxImg');

document.addEventListener('click', function (e) {
  var shot = e.target.closest('.shot');
  if (!shot || !lightbox) return;
  var img = shot.querySelector('img');
  if (!img) return;
  lightboxImg.src = img.currentSrc || img.src;
  lightboxImg.alt = img.alt || '';
  if (typeof lightbox.showModal === 'function') lightbox.showModal();
  else lightbox.setAttribute('open', '');
});

if (lightbox) {
  lightbox.addEventListener('click', function () {
    if (typeof lightbox.close === 'function') lightbox.close();
    else lightbox.removeAttribute('open');
  });
}

// ---- Table of contents scroll-spy: highlight active step while scrolling ----
var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
var steps = tocLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);

if ('IntersectionObserver' in window && steps.length) {
  var current = null;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) current = entry.target.id;
    });
    tocLinks.forEach(function (a) {
      var active = a.getAttribute('href') === '#' + current;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
  steps.forEach(function (s) { observer.observe(s); });
}

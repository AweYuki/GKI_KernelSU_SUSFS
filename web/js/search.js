/**
 * Search module: filter release rows in the active branch; `/` focuses input, `Escape` clears it.
 */

import { t } from './i18n.js';
import { esc, fmt } from './utils.js';
import { applyCollapse, readCollapsePref, refreshIndicator } from './render.js';

var searchWrap = document.getElementById('search');
var nav = document.getElementById('branchNav');
var input = document.getElementById('searchInput');
var clearBtn = document.getElementById('searchClear');
var countEl = document.getElementById('searchCount');
var toggleBtn = document.getElementById('searchToggle');

export function getQuery() {
  return input.value.trim().toLowerCase();
}

// Clear search query and restore full list (used when jumping from the month ruler to a filtered-out row)
export function clearSearch() {
  if (!input.value) return;
  input.value = '';
  filterActive();
}

export function initSearch() {
  input.addEventListener('input', function () { filterActive(); });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    filterActive();
    input.focus();
  });

  // "Clear" button inside the ledger empty-results state
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.ledger__clear')) return;
    input.value = '';
    filterActive();
    input.focus();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (input.value) { input.value = ''; filterActive(); }
      else input.blur();
      e.stopPropagation();
    }
  });

  // `/` keyboard shortcut to focus search
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var active = document.activeElement;
    var tag = (active && active.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (active && active.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (window.matchMedia('(max-width: 767px)').matches) {
      nav.classList.add('search-open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    input.focus();
    input.select();
  });

  // Mobile: magnifying-glass button expands / collapses the search input row
  toggleBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('search-open');
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      input.focus();
    } else {
      input.value = '';
      filterActive();
    }
    refreshIndicator();
  });
}

// Filter rows in the active branch panel; also invoked after switching branches
export function filterActive() {
  var query = getQuery();
  searchWrap.classList.toggle('has-query', !!query);

  var panel = document.querySelector('.branch-panel.is-active');
  var ledger = panel ? panel.querySelector('.ledger') : null;
  if (!ledger) { countEl.textContent = ''; return; }

  var rows = ledger.querySelectorAll('.row');
  var total = rows.length;
  var shown = 0;

  rows.forEach(function (row) {
    if (!query) { row.hidden = false; shown++; return; }
    var hay = (row.dataset.date + ' ' + row.dataset.kernel + ' ' + (row.dataset.tags || '')).toLowerCase();
    var match = hay.indexOf(query) !== -1;
    row.hidden = !match;
    if (match) shown++;
  });

  ledger.classList.toggle('is-filtered', !!query);

  // Deprecated collapse preference is suspended while filtering; also resets year-group visibility
  applyCollapse(ledger, readCollapsePref(), !!query);

  // Hide year groups that have no visible matching rows while filtering
  if (query) {
    ledger.querySelectorAll('.year').forEach(function (g) {
      g.hidden = g.querySelectorAll('.row:not([hidden])').length === 0;
    });
  }

  var empty = !!query && shown === 0;
  ledger.classList.toggle('is-empty', empty);
  if (empty) {
    ledger.querySelector('.ledger__empty-text').innerHTML =
      fmt(esc(t.noResults), { q: '<span class="q">' + esc(input.value.trim()) + '</span>' });
  }

  countEl.textContent = query ? fmt(t.searchCount, { n: shown, total: total }) : '';
  // Showing or hiding the match count shifts nav layout, so realign the active tab indicator
  refreshIndicator();
}

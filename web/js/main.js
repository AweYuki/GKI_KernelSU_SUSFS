/**
 * Dashboard entry point: initialize all submodules, fetch and render kernel release data.
 */

import '../scss/main.scss';

import { t, initI18n } from './i18n.js';
import { initTheme } from './theme.js';
import { initModal } from './modal.js';
import { initAnnouncement } from './announcement.js';
import { initSearch, filterActive, getQuery, clearSearch } from './search.js';
import { initTimeConverter } from './time-converter.js';
import { initBackToTop } from './back-to-top.js';
import { showToast } from './toast.js';
import { copyText, fetchJsonFresh, fmt, getStored } from './utils.js';
import { DATA_FILES, PROBE_DIR } from './config.js';
import { buildBranchModel, buildSummary } from './model.js';
import {
  renderTabs, renderPanels, activateBranch, renderReadout,
  initCollapse, initRulerJump, initLegendSync, applyCollapse, readCollapsePref, getModel,
} from './render.js';

initI18n();
initTheme({
  button: document.getElementById('themeToggle'),
  labels: { light: t.light, dark: t.dark },
});
initModal();
initSearch();
var timeConverter = initTimeConverter();
initBackToTop();
initCollapse(getQuery);
initRulerJump(clearSearch);
initLegendSync();

// Global event delegation for copy buttons (shared by parameter sheet and time converter)
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy-btn');
  if (!btn) return;
  var text = btn.dataset.copy;
  if (!text) return;
  copyText(text).then(function () {
    // Clear any previous reset timer on rapid clicks so the button doesn't get stuck on "Copied"
    if (btn._copyTimer) clearTimeout(btn._copyTimer);
    btn.textContent = t.copied;
    btn.classList.add('copied');
    showToast(btn.dataset.copyWhat ? fmt(t.copyToast, { what: btn.dataset.copyWhat }) : t.copyToastGeneric);
    btn._copyTimer = setTimeout(function () {
      btn.textContent = t.copy;
      btn.classList.remove('copied');
      btn._copyTimer = null;
    }, 1200);
  }).catch(function () {});
});

// Resolve initial branch key from URL hash (e.g. #android15-6.6)
function keyFromHash() {
  var h = (location.hash || '').replace(/^#/, '');
  return getModel(h) ? h : null;
}

async function loadData() {
  // Fetch version data and SUSFS probe data in parallel; probe files are optional (falls back to threshold if absent)
  var settled = await Promise.allSettled(
    DATA_FILES.map(function (f) {
      return fetchJsonFresh('data/' + f.android + '/' + f.kernel + '.json');
    }).concat(DATA_FILES.map(function (f) {
      return fetchJsonFresh(PROBE_DIR + '/' + f.android + '-' + f.kernel + '.json');
    }))
  );
  var results = settled.slice(0, DATA_FILES.length);
  var probes = settled.slice(DATA_FILES.length);

  var models = [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      var probe = probes[i].status === 'fulfilled' ? probes[i].value : null;
      models.push(buildBranchModel(results[i].value, DATA_FILES[i], probe));
    }
  }

  if (models.length === 0) {
    document.getElementById('content').innerHTML =
      '<div class="error"><p>' + t.errorTitle + '</p><p>' + t.errorHint + '</p></div>';
    return;
  }

  renderReadout(buildSummary(models));
  renderTabs(models, function () { filterActive(); });
  renderPanels(models);

  // Apply persisted deprecated-section collapse preference
  models.forEach(function (m) {
    var ledger = document.getElementById('ledger-' + m.key);
    if (ledger) applyCollapse(ledger, readCollapsePref(), false);
  });

  // Branch selection priority: URL hash > last visited branch > newest branch (last entry)
  var remembered = getStored('last_branch');
  var initial = keyFromHash() || (getModel(remembered) ? remembered : null) || models[models.length - 1].key;
  activateBranch(initial, false);
  timeConverter.seed();

  window.addEventListener('hashchange', function () {
    var k = keyFromHash();
    if (k) activateBranch(k, false);
  });
}

initAnnouncement();
loadData();

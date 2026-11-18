/**
 * View-model module: transform raw JSON data into render-ready structures
 * (version runs, sublevel deltas, deprecated spans, SUSFS compatibility, month ruler, latest entry).
 *
 * SUSFS compatibility comes from two sources:
 *   1. data/susfs_probe/<android>-<kernel>.json: per-release verdicts from full raw susfs4ksu patch builds
 *      (clean = 0 .rej and built; built_with_rej = built with .rej conflicts; failed = build failed)
 *   2. Fallback to SUSFS_COMPAT_MIN thresholds in config.js when probe data is absent
 * Only `clean` counts as directly compatible.
 */

import { SUSFS_COMPAT_MIN } from './config.js';

// Extract numeric sublevel from a kernel version string, e.g. "6.6.50" -> 50
export function sublevelOf(kernel) {
  var parts = String(kernel || '').split('.');
  var n = parseInt(parts[2], 10);
  return isNaN(n) ? null : n;
}

// Check whether a kernel version meets the fallback SUSFS compatibility threshold (used when probe data is absent)
export function isSusfsCompat(kernel, majorMinor) {
  var min = SUSFS_COMPAT_MIN[majorMinor];
  if (min == null) return false;
  var sub = sublevelOf(kernel);
  return sub != null && sub >= min;
}

// Classify upstream ref type: head (active branch) / deprecated (moved) / tag (branch deleted, tag remains) / unknown
export function refKindOf(ref) {
  if (!ref) return 'unknown';
  if (ref.indexOf('refs/heads/deprecated/') === 0) return 'deprecated';
  if (ref.indexOf('refs/heads/') === 0) return 'head';
  if (ref.indexOf('refs/tags/') === 0) return 'tag';
  return 'unknown';
}

// Offset a YYYY-MM month string: addMonths('2024-10', 1) -> '2024-11'
export function addMonths(ym, n) {
  var y = parseInt(ym.slice(0, 4), 10);
  var m = parseInt(ym.slice(5, 7), 10) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return y + '-' + String(m + 1).padStart(2, '0');
}

// Signed month difference between two YYYY-MM strings
export function monthDiff(a, b) {
  var ya = parseInt(a.slice(0, 4), 10), ma = parseInt(a.slice(5, 7), 10);
  var yb = parseInt(b.slice(0, 4), 10), mb = parseInt(b.slice(5, 7), 10);
  return (yb - ya) * 12 + (mb - ma);
}

// Sanitize probe JSON: retain only well-formed entries, returning null if missing or invalid
function normalizeProbe(probe) {
  if (!probe || typeof probe !== 'object' || !probe.results || typeof probe.results !== 'object') return null;
  var results = {};
  var count = 0;
  Object.keys(probe.results).forEach(function (key) {
    var r = probe.results[key];
    if (!r || typeof r !== 'object') return;
    var verdict = r.verdict === 'clean' || r.verdict === 'built_with_rej' || r.verdict === 'failed' ? r.verdict : '';
    if (!verdict) return;
    results[key] = {
      kernel: typeof r.kernel === 'string' ? r.kernel : '',
      rej: typeof r.rej === 'number' ? r.rej : parseInt(r.rej, 10) || 0,
      compile: typeof r.compile === 'string' ? r.compile : '',
      verdict: verdict,
    };
    count++;
  });
  if (!count) return null;
  return {
    variant: typeof probe.ksu_variant === 'string' ? probe.ksu_variant : '',
    repo: typeof probe.susfs_repo === 'string' ? probe.susfs_repo : '',
    branch: typeof probe.susfs_branch === 'string' ? probe.susfs_branch : '',
    commit: typeof probe.susfs_commit === 'string' ? probe.susfs_commit : '',
    commitShort: typeof probe.susfs_commit === 'string' ? probe.susfs_commit.slice(0, 7) : '',
    probedAt: typeof probe.probed_at === 'string' ? probe.probed_at : '',
    runUrl: typeof probe.run_url === 'string' ? probe.run_url : '',
    results: results,
  };
}

/**
 * Build the view model for a single kernel branch.
 * @param {object} data   Raw JSON ({ entries, lts, deprecated_cutoff })
 * @param {object} meta   Branch metadata from DATA_FILES ({ android, kernel, label })
 * @param {object} probe  Optional contents of data/susfs_probe/<android>-<kernel>.json
 */
export function buildBranchModel(data, meta, probe) {
  var entries = Array.isArray(data.entries) ? data.entries.slice() : [];
  var cutoff = typeof data.deprecated_cutoff === 'string' ? data.deprecated_cutoff : '';
  var lts = typeof data.lts === 'string' ? data.lts : '';
  var susfsMin = SUSFS_COMPAT_MIN[meta.kernel];
  var key = meta.android + '-' + meta.kernel;
  var probeInfo = normalizeProbe(probe);

  // Per-entry SUSFS verdict: when probe data exists, trust only probed results (missing months are marked unknown
  // rather than guessed from threshold); fall back to threshold only when probe file is absent.
  // Since LTS advances over time, treat LTS as unprobed if the probed kernel version differs from current `lts`.
  function susfsOf(date, kernel) {
    if (probeInfo) {
      var r = probeInfo.results[date];
      if (r && (!r.kernel || r.kernel === kernel)) {
        return { susfs: r.verdict === 'clean', rej: r.verdict === 'built_with_rej', failed: r.verdict === 'failed', probed: true, unknown: false, rejCount: r.rej };
      }
      return { susfs: false, rej: false, failed: false, probed: false, unknown: true, rejCount: 0 };
    }
    return { susfs: isSusfsCompat(kernel, meta.kernel), rej: false, failed: false, probed: false, unknown: false, rejCount: 0 };
  }

  // ---- Base row fields (chronological order) ----
  var rows = [];
  var prevSub = null;
  var deprecatedCount = 0;
  var monotonic = true;

  entries.forEach(function (entry, i) {
    var sub = sublevelOf(entry.kernel);
    var delta = (prevSub == null || sub == null) ? null : sub - prevSub;
    if (delta != null && delta < 0) monotonic = false;
    var deprecated = !!cutoff && entry.date <= cutoff;
    // Actual upstream ref written by update_data.py: refs/heads/... / refs/heads/deprecated/... / refs/tags/..._rN
    var ref = typeof entry.ref === 'string' ? entry.ref : '';
    var s = susfsOf(entry.date, entry.kernel);
    if (deprecated) deprecatedCount++;
    rows.push({
      index: i,
      key: key,
      date: entry.date,
      year: entry.date.slice(0, 4),
      month: entry.date.slice(5, 7),
      kernel: entry.kernel,
      sublevel: sub,
      delta: delta,
      deprecated: deprecated,
      ref: ref,
      refKind: refKindOf(ref),
      susfs: s.susfs,
      susfsRej: s.rej,
      susfsFailed: s.failed,
      susfsProbed: s.probed,
      susfsUnknown: s.unknown,
      susfsRejCount: s.rejCount,
      latest: i === entries.length - 1,
      isLts: false,
      // Version-run fields populated below
      runHead: true,
      runCont: false,
      runLen: 1,
      runPos: 0,
      runDelta: null,
    });
    if (sub != null) prevSub = sub;
  });

  // ---- SUSFS compatibility line: draw a continuous rule only if every row from `susfsFirstIndex` onward is clean ----
  var susfsFirstIndex = -1;
  var susfsContiguous = false;
  for (var s0 = rows.length - 1; s0 >= 0; s0--) {
    if (rows[s0].susfs) susfsFirstIndex = s0; else break;
  }
  var anySusfs = rows.some(function (r) { return r.susfs; });
  if (susfsFirstIndex !== -1) {
    susfsContiguous = rows.slice(0, susfsFirstIndex).every(function (r) { return !r.susfs; });
  }
  if (!susfsContiguous) susfsFirstIndex = -1;

  // ---- Version runs: group consecutive identical kernel versions; split runs across the deprecation cutoff ----
  var runStart = 0;
  var prevRunSub = null;
  function closeRun(start, end) {
    var len = end - start;
    var headSub = rows[start].sublevel;
    var runDelta = (prevRunSub == null || headSub == null) ? null : headSub - prevRunSub;
    for (var j = start; j < end; j++) {
      rows[j].runLen = len;
      rows[j].runPos = j - start;
      rows[j].runHead = j === end - 1;   // Displayed in reverse chronological order, so the latest month heads the run
      rows[j].runCont = j !== end - 1;
      rows[j].runDelta = runDelta;
    }
    if (headSub != null) prevRunSub = headSub;
  }
  for (var i = 1; i <= rows.length; i++) {
    var sameRun = i < rows.length &&
      rows[i].kernel === rows[i - 1].kernel &&
      rows[i].deprecated === rows[i - 1].deprecated;
    if (!sameRun) {
      closeRun(runStart, i);
      runStart = i;
    }
  }

  // Place the LTS badge on the head row of the matching version run
  if (lts) {
    for (var k = rows.length - 1; k >= 0; k--) {
      if (rows[k].kernel === lts && rows[k].runHead) { rows[k].isLts = true; break; }
    }
  }

  var first = rows.length ? rows[0] : null;
  var last = rows.length ? rows[rows.length - 1] : null;
  var ltsState = lts ? susfsOf('lts', lts) : { susfs: false, rej: false, failed: false, probed: false, unknown: false, rejCount: 0 };

  // SUSFS threshold kernel string: take first contiguous clean row when available, else fallback threshold
  var susfsMinKernel = '';
  if (susfsFirstIndex !== -1) susfsMinKernel = rows[susfsFirstIndex].kernel;
  else if (!probeInfo && susfsMin != null) susfsMinKernel = meta.kernel + '.' + susfsMin;

  // ---- Month ruler: every calendar month from first to last; months without a release inherit the previous SUSFS state ----
  var months = [];
  if (first && last) {
    var byDate = {};
    rows.forEach(function (r) { byDate[r.date] = r; });
    var total = monthDiff(first.date, last.date) + 1;
    var cutoffIdx = -1;
    var carrySusfs = false;
    for (var m = 0; m < total; m++) {
      var ym = addMonths(first.date, m);
      var row = byDate[ym] || null;
      if (row) carrySusfs = row.susfs;
      var dep = !!cutoff && ym <= cutoff;
      if (dep) cutoffIdx = m;
      months.push({
        index: m,
        date: ym,
        year: ym.slice(0, 4),
        isJan: ym.slice(5, 7) === '01',
        row: row,
        deprecated: dep,
        susfs: carrySusfs,
        threshold: !!row && row.index === susfsFirstIndex && susfsFirstIndex > 0,
        latest: !!row && row.latest,
        lts: !!row && row.isLts,
        cutoff: false,
      });
    }
    if (cutoffIdx >= 0) months[cutoffIdx].cutoff = true;
  }

  return {
    key: key,
    meta: meta,
    rows: rows,
    count: rows.length,
    first: first,
    last: last,
    lts: lts,
    ltsSublevel: lts ? sublevelOf(lts) : null,
    ltsInList: rows.some(function (r) { return r.isLts; }),
    ltsSusfs: ltsState.susfs,
    ltsSusfsState: ltsState,
    cutoff: cutoff,
    deprecatedCount: deprecatedCount,
    // Branch is fully deprecated when every release entry falls at or before the cutoff
    fullyDeprecated: rows.length > 0 && deprecatedCount === rows.length,
    monotonic: monotonic,
    probe: probeInfo,
    susfsMin: susfsMin == null ? null : susfsMin,
    susfsMinKernel: susfsMinKernel,
    susfsFirstIndex: susfsFirstIndex,
    susfsFirstDate: susfsFirstIndex !== -1 ? rows[susfsFirstIndex].date : '',
    susfsContiguous: susfsContiguous,
    hasSusfs: anySusfs,
    allSusfs: rows.length > 0 && susfsFirstIndex === 0,
    hasSusfsRej: rows.some(function (r) { return r.susfsRej; }),
    susfsUnknownCount: rows.filter(function (r) { return r.susfsUnknown; }).length,
    months: months,
  };
}

// Aggregate masthead readout summary across all branches: latest patch month, branch count, total releases
export function buildSummary(models) {
  var latest = '';
  var total = 0;
  models.forEach(function (m) {
    total += m.count;
    if (m.last && m.last.date > latest) latest = m.last.date;
  });
  return { latest: latest, branches: models.length, total: total };
}

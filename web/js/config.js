/**
 * Global configuration constants.
 */

// Probe data directory (per-release verdicts from full raw-patch builds on the `susfs-probe` branch)
export var PROBE_DIR = 'data/susfs_probe';

// Kernel branch data files (array order defines the branch navigation tab order)
export const DATA_FILES = [
  { android: 'android12', kernel: '5.10', label: 'android12 / 5.10' },
  { android: 'android13', kernel: '5.15', label: 'android13 / 5.15' },
  { android: 'android14', kernel: '6.1',  label: 'android14 / 6.1'  },
  { android: 'android15', kernel: '6.6',  label: 'android15 / 6.6'  },
  { android: 'android16', kernel: '6.12', label: 'android16 / 6.12' },
];

// Per-load cache-busting token generated on page load
export var RUNTIME_CACHE_KEY = Date.now().toString(36);

// Fallback SUSFS compatibility sublevel thresholds: sublevel >= threshold means susfs4ksu patches apply directly.
// Only used when data/susfs_probe/<android>-<kernel>.json is missing; probe verdicts take precedence when present.
export var SUSFS_COMPAT_MIN = {
  '5.10': 218,
  '5.15': 148,
  '6.1': 145,
  '6.6': 98,
  '6.12': 0,
};

// External links
export var LINKS = {
  repo: 'https://github.com/AweYuki/GKI_KernelSU_SUSFS',
  susfs: 'https://gitlab.com/simonpunk/susfs4ksu',
  aospCommon: 'https://android.googlesource.com/kernel/common',
  aospManifest: 'https://android.googlesource.com/kernel/manifest',
};

// `repo` tool revision passed to `repo init`
export var REPO_REV = 'v2.74';

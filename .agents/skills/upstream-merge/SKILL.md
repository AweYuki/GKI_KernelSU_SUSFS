---
name: upstream-merge
description: >-
  Safely merge or cherry-pick new upstream commits from zzh20188/GKI_KernelSU_SUSFS
  and WildKernels/GKI_KernelSU_SUSFS into AweYuki/GKI_KernelSU_SUSFS (dev) while
  preserving all fork-specific customizations, composite actions, AweYukiSU-only
  support, MY_GH_TOKEN, i18n parity, and workflow limits.
---

# Upstream Merge Runbook (`AweYuki/GKI_KernelSU_SUSFS`)

Use this skill when syncing, merging, or cherry-picking new commits from upstream into `AweYuki/GKI_KernelSU_SUSFS` (`dev`).

## 1. Remotes & Upstream Lineage

- `origin`: `https://github.com/AweYuki/GKI_KernelSU_SUSFS.git` (target branch: `dev`)
- `upstream` (parent fork): `https://github.com/zzh20188/GKI_KernelSU_SUSFS.git` (branch: `dev`)
- `wildkernels` (root upstream): `https://github.com/WildKernels/GKI_KernelSU_SUSFS.git` (branch: `main`)

### Preflight
```bash
git status -sb
git remote -v
# Add missing remotes if needed:
git remote add upstream https://github.com/zzh20188/GKI_KernelSU_SUSFS.git 2>/dev/null || true
git remote add wildkernels https://github.com/WildKernels/GKI_KernelSU_SUSFS.git 2>/dev/null || true
git fetch origin dev
git fetch upstream dev
```

Inspect incoming commits before merging:
```bash
git log --oneline HEAD..upstream/dev
git diff --stat HEAD...upstream/dev
```

## 2. Merge Strategy

1. Ensure working tree is clean (`git status -sb`).
2. Prefer `git merge --no-ff --no-commit upstream/dev` (or `git cherry-pick <sha>` for targeted WildKernels commits) so you can inspect and resolve every conflict against the fork invariants below before committing.
3. **Deleted upstream files**: `upstream/dev` may still modify `README-EN.md`, `docs/advanced-features-en.md`, `config/SukiSU*.config`, or `.github/workflows/kernel-a12-5-10.yml`..`kernel-a16-6-12.yml`.
   - Keep them **deleted** (`git rm` if conflict asks `deleted by us`).
   - Port any useful matrix/sublevel updates from `kernel-a1*.yml` into `data/android*/*.json` (`main.yml` generates matrices dynamically via `prepare-matrices`).
   - Port any useful build/patch changes from `build.yml` conflicts into the corresponding composite action under `.github/actions/<name>/action.yml`.

## 3. Mandatory Fork Invariants (NEVER Regress)

When resolving merge conflicts, always preserve these fork rules:

1. **AweYukiSU Exclusive**:
   - Support ONLY `AweYukiSU` (`https://github.com/AweYuki/AweYukiSU.git`, fork of `BakaSU`, version `30700 + main commit count`).
   - Never reintroduce `Official`, `KernelSU-Next`, `SukiSU`, `SukiSU(40726)`, `SukiSU(40548)`, or `BakaSU` choices/tabs/configs.
   - Preserve `sed 's|Baka-SU/BakaSU|AweYuki/AweYukiSU|g'` when piping `AweYukiSU`'s `kernel/setup.sh` in `.github/workflows/build.yml`.
2. **GitHub Token & Repo Guards**:
   - Keep `secrets.MY_GH_TOKEN` (never revert to `secrets.GITHUB_TOKEN`) in `.github/workflows/main.yml`, `emergency-cleanup.yml`, `Auto_Trigger.yml`, and `get-manager.yml`.
   - Keep owner/repo guards pointing to `AweYuki` / `AweYuki/GKI_KernelSU_SUSFS`.
3. **Workflow Architecture & Limits**:
   - Keep `kernel-custom.yml` as the single-kernel manual workflow (`kernel-a1x` files stay deleted).
   - Keep patch steps modularized under `.github/actions/*/action.yml`.
   - Keep `-AweYuki-Project-${GHASH}` default kernel localversion in `.github/workflows/build.yml`.
   - Enforce GitHub Actions' **25-input `workflow_dispatch` limit** on `.github/workflows/main.yml` (already at 25/25).
4. **English Default + Multi-Language Parity (`en` / `vi` / `zh`)**:
   - Default language is English (`README.md`, `docs/advanced-features.md`, `web/index.html`, `web/guide.html`, `web/js/i18n.js`).
   - Keep `README-VI.md` / `README-ZH.md`, `docs/advanced-features-vi.md` / `-zh.md`, `data/announcement.json`, and `web/js/i18n.js` (`en == vi == zh` keys) synchronized.
   - Keep `.github/**`, `scripts/**`, `patches/**`, `config/**`, `zram/**`, `hmbird_patch.c`, and `web/scss/**` 100% in English (zero CJK).

## 4. Post-Merge Verification Checklist

Run before committing and pushing to `origin/dev`:

1. **YAML & Workflow Wiring**:
   - `yq eval '.'` on all `.github/**/*.yml` (workflows, composite actions, issue templates).
   - Verify `workflow_dispatch` input count `<= 25` on every workflow and verify `with:` keys match callee `workflow_call.inputs` / action `inputs`.
2. **Shell, Python & Patches**:
   - `bash -n` on all shell blocks in `.github/workflows/*.yml`, `.github/actions/*/action.yml`, and `*.sh` scripts (`scripts/susfs_fixes/apply.sh`, `security_patch/apply_cve_2026_43499.sh`, `zram/apply_lz4_neon.sh`).
   - `PYTHONDONTWRITEBYTECODE=1 python3 -B -m py_compile` on all `scripts/**/*.py`.
   - `git apply --stat` on `patches/**/*.patch` and `security_patch/**/*.patch`.
3. **Web & Cleanliness**:
   - `node --input-type=module --check` on `web/js/*.js` and key parity check (`en == vi == zh`) in `web/js/i18n.js`.
   - Zero `__pycache__/`, `*.pyc`, `web/dist/`, or `node_modules/` in `git status -sb --ignored`.
4. **Commit & Push**:
   - Commit with a clear Conventional Commit message (`chore(sync): merge upstream/dev ...`) and push `HEAD:dev` (or ask user if unprompted).

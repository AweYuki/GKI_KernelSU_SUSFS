#!/usr/bin/env bash
# Apply SUSFS patches and per-kernel-version context fixes.
# Required environment variables:
#   ANDROID_VERSION KERNEL_VERSION KSU_VARIANT OS_PATCH_LEVEL SUB_LEVEL
#   KERNEL_ROOT SUSFS4KSU
# Working directory must be set to $KERNEL_ROOT before invocation.
set -eo pipefail
FIXES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# List non-upstream .rej files under the current directory (relative paths, sorted).
# Upstream branches may include committed .rej files (e.g., mm/rmap.c.rej in
# android15-6.6-2026-04 left over from upstream merge conflict resolution), which
# are not conflicts from our patches; however, patch failures overwrite files of
# the same name, so only files "tracked by git and unmodified" count as upstream.
# Outside a git repo (local verify_context.sh), git returns empty and falls back to all .rej files.
list_upstream_rej() {
  (git ls-files -- '*.rej' 2>/dev/null || true) | while IFS= read -r f; do
    if git diff --quiet -- "$f" 2>/dev/null; then
      echo "$f"
    fi
  done
}
list_untracked_rej() {
  comm -23 \
    <(find . -type f -name '*.rej' | sed 's|^\./||' | sort) \
    <(list_upstream_rej | sort)
}

echo "Applying SUSFS patches..."

SUSFS_PATCH="50_add_susfs_in_gki-$ANDROID_VERSION-$KERNEL_VERSION.patch"
cp "$SUSFS4KSU/kernel_patches/$SUSFS_PATCH" ./common/
cp "$SUSFS4KSU"/kernel_patches/fs/* ./common/fs/
cp "$SUSFS4KSU"/kernel_patches/include/linux/* ./common/include/linux/

case "$KSU_VARIANT" in
  "AweYukiSU")
    echo "AweYukiSU uses built-in SUSFS support"
    ;;
  *)
    echo "::error::Unsupported KSU_VARIANT: $KSU_VARIANT (only AweYukiSU is supported)"
    exit 1
    ;;
esac

cd "$KERNEL_ROOT/common"
CURRENT_SUB="$SUB_LEVEL"
if [[ ! "$CURRENT_SUB" =~ ^[0-9]+$ ]]; then
  CURRENT_SUB=99999
fi

# Compatibility for 5.10.66~209, 5.15.74~144, and 6.1.25~68 lacking VMA padding helpers
if grep -qF 'VMA_PAD_START(vma)' "$SUSFS_PATCH" \
  && ! grep -Rqs 'VMA_PAD_START' ./include/linux; then
  echo "Target kernel lacks VMA_PAD_START; falling back to vma->vm_end for SUSFS OPEN_REDIRECT"
  sed -i 's/VMA_PAD_START(vma)/vma->vm_end/g' "$SUSFS_PATCH"
fi

adjust_legacy_fdinfo_context() {
  sed -i '/^[[:space:]]*\/\*$/,/^[[:space:]]*u32 mask = mark->mask & IN_ALL_EVENTS;$/d' fs/notify/fdinfo.c
  perl -i -pe 's/\bmask,\s*mark->ignored_mask/inotify_mark_user_mask(mark)/g' fs/notify/fdinfo.c
  perl -i -pe 's/ignored_mask:%x/ignored_mask:0/g' fs/notify/fdinfo.c
}

restore_legacy_fdinfo_context() {
  perl -i -pe 's/^(\s+if \(inode\) \{)/$1\n\t\t\/\*\n\t\t * IN_ALL_EVENTS represents all of the mask bits\n\t\t * that we expose to userspace.  There is at\n\t\t * least one bit (FS_EVENT_ON_CHILD) which is\n\t\t * used only internally to the kernel.\n\t\t *\/\n\t\tu32 mask = mark->mask & IN_ALL_EVENTS;/m' fs/notify/fdinfo.c
  perl -i -pe 's/\binotify_mark_user_mask\(mark\)/mask, mark->ignored_mask/g' fs/notify/fdinfo.c
  perl -i -pe 's/ignored_mask:0/ignored_mask:%x/g' fs/notify/fdinfo.c
}

# Temporarily adjust legacy kernel source context so the main SUSFS patch applies cleanly
if [[ "$ANDROID_VERSION" == "android12" && "$KERNEL_VERSION" == "5.10" ]]; then
  if [[ "$CURRENT_SUB" -le 117 ]]; then
    echo "Temporarily adjusting Android 12 5.10 fdinfo.c context"
    adjust_legacy_fdinfo_context
  fi
fi

if [[ "$ANDROID_VERSION" == "android13" && "$KERNEL_VERSION" == "5.15" ]]; then
  if [[ "$CURRENT_SUB" -le 41 ]]; then
    echo "Temporarily adjusting Android 13 5.15 namespace.c/open.c/fdinfo.c context"
    if ! grep -qF '#include <linux/mnt_idmapping.h>' fs/namespace.c; then
      sed -i '/^#include <linux\/shmem_fs.h>$/a #include <linux/mnt_idmapping.h>' fs/namespace.c
    fi
    if ! grep -qF '#include <linux/mnt_idmapping.h>' fs/open.c; then
      sed -i '/^#include <linux\/compat.h>$/a #include <linux/mnt_idmapping.h>' fs/open.c
    fi
    if [ ! -f include/linux/mnt_idmapping.h ]; then
      printf '/* Stub: mnt idmap helpers live in linux/fs.h on this sublevel. */\n' > include/linux/mnt_idmapping.h
    fi
    adjust_legacy_fdinfo_context
  fi
  # Newer patches expect trace hook includes in context; pinned legacy patches may not.
  NS_BLK_515_ADJUST=""
  if awk '/^diff --git a\/fs\/namespace.c /{f=1;next} /^diff --git /{f=0}
    f && $0 == " #include <trace/hooks/blk.h>" {found=1} END{exit !found}' "$SUSFS_PATCH"; then
    if ! grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
      sed -i '/^#include "internal.h"$/a #include <trace/hooks/blk.h>' fs/namespace.c
      NS_BLK_515_ADJUST=added
    fi
  elif grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
    sed -i '/^#include <trace\/hooks\/blk.h>$/d' fs/namespace.c
    NS_BLK_515_ADJUST=removed
  fi

  TASK_MM_515_ADJUST=""
  if awk '/^diff --git a\/fs\/proc\/task_mmu.c /{f=1;next} /^diff --git /{f=0}
    f && $0 == " #include <trace/hooks/mm.h>" {found=1} END{exit !found}' "$SUSFS_PATCH"; then
    if ! grep -qxF '#include <trace/hooks/mm.h>' fs/proc/task_mmu.c; then
      sed -i '/^#include <linux\/pkeys.h>$/a #include <trace/hooks/mm.h>' fs/proc/task_mmu.c
      TASK_MM_515_ADJUST=added
    fi
  elif grep -qxF '#include <trace/hooks/mm.h>' fs/proc/task_mmu.c; then
    sed -i '/^#include <trace\/hooks\/mm.h>$/d' fs/proc/task_mmu.c
    TASK_MM_515_ADJUST=removed
  fi
fi

if [[ "$ANDROID_VERSION" == "android14" && "$KERNEL_VERSION" == "6.1" ]]; then
  if [[ "$CURRENT_SUB" -le 25 ]] && ! grep -qF '#include <trace/hooks/sched.h>' fs/proc/base.c; then
    echo "Temporarily adjusting Android 14 6.1 sched.h context"
    sed -i '/^#include <trace\/events\/oom.h>$/a #include <trace/hooks/sched.h>' fs/proc/base.c
  fi
  if [[ "$CURRENT_SUB" -le 141 ]] && ! grep -qF '#include <linux/dma-buf.h>' fs/proc/base.c; then
    echo "Temporarily adjusting Android 14 6.1 dma-buf.h context"
    sed -i '/^#include <linux\/cpufreq_times.h>$/a #include <linux/dma-buf.h>' fs/proc/base.c
  fi
  # Starting from 6.1.157, fs/namespace.c includes trace/hooks/blk.h after internal.h;
  # since 2026-10-19 (simonpunk 8a3d6fd rebased on 6.1.176), the main SUSFS patch expects
  # it in context, whereas older patches do not. Temporarily add or remove it based on
  # whether the patch context matches the source, supporting both new and pinned patches.
  NS_BLK_PATCH=""
  if awk '
    /^diff --git a\/fs\/namespace.c / { in_namespace = 1; next }
    /^diff --git / { in_namespace = 0 }
    in_namespace && $0 == " #include <trace/hooks/blk.h>" { found = 1 }
    END { exit !found }
  ' "$SUSFS_PATCH"; then
    NS_BLK_PATCH=1
  fi
  NS_BLK_ADJUST=""
  if [[ -n "$NS_BLK_PATCH" ]] && ! grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
    echo "Temporarily adjusting Android 14 6.1 namespace.c context (adding blk.h)"
    sed -i '/^#include "internal.h"$/a #include <trace/hooks/blk.h>' fs/namespace.c
    NS_BLK_ADJUST=added
  elif [[ -z "$NS_BLK_PATCH" ]] && grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
    echo "Temporarily adjusting Android 14 6.1 namespace.c context (removing blk.h)"
    sed -i '/^#include <trace\/hooks\/blk.h>$/d' fs/namespace.c
    NS_BLK_ADJUST=removed
  fi
fi

if [[ "$ANDROID_VERSION" == "android15" && "$KERNEL_VERSION" == "6.6" ]]; then
  if [[ "$CURRENT_SUB" -le 30 ]]; then
    python3 "$FIXES_DIR/susfs_fake_66_smaps.py" fs/proc/task_mmu.c apply
    if [[ "$OS_PATCH_LEVEL" == "2024-07" ]] && ! grep -q '__fold_filemap_fixup_entry' fs/proc/task_mmu.c; then
      sed -i '/^#include <asm\/elf.h>$/i #ifndef __fold_filemap_fixup_entry\nstatic inline void __fold_filemap_fixup_entry(struct vma_iterator *iter, unsigned long *end) { }\n#endif /* __fold_filemap_fixup_entry */\n' fs/proc/task_mmu.c
    fi
  fi
  if [[ "$CURRENT_SUB" -le 92 ]] && ! grep -qF '#include <linux/dma-buf.h>' fs/proc/base.c; then
    echo "Temporarily adjusting Android 15 6.6 base.c context"
    sed -i '/^#include <linux\/cpufreq_times.h>$/a #include <linux/dma-buf.h>' fs/proc/base.c
  fi
  if [[ "$CURRENT_SUB" -le 57 ]] && ! grep -qF '#include <linux/zswap.h>' mm/memory.c; then
    echo "Temporarily adjusting Android 15 6.6 memory.c context"
    sed -i '/^#include <linux\/sched\/sysctl.h>$/a #include <linux/zswap.h>' mm/memory.c
  fi
fi

if [[ "$ANDROID_VERSION" == "android16" && "$KERNEL_VERSION" == "6.12" ]]; then
  # Temporarily add or remove includes to match the selected patch, supporting both new and pinned legacy patches.
  EXEC_DMA_ADJUST=""
  if awk '/^diff --git a\/fs\/exec.c /{f=1;next} /^diff --git /{f=0}
    f && $0 == " #include <linux/dma-buf.h>" {found=1} END{exit !found}' "$SUSFS_PATCH"; then
    if ! grep -qxF '#include <linux/dma-buf.h>' fs/exec.c; then
      sed -i '/^#include <linux\/ksm.h>$/a #include <linux/dma-buf.h>' fs/exec.c
      EXEC_DMA_ADJUST=added
    fi
  elif grep -qxF '#include <linux/dma-buf.h>' fs/exec.c; then
    sed -i '/^#include <linux\/dma-buf.h>$/d' fs/exec.c
    EXEC_DMA_ADJUST=removed
  fi

  # Replace only context lines in the patch while preserving the kernel's native VMA helper.
  if grep -qF 'if (!vma_pages(vma))' fs/proc/task_mmu.c; then
    sed -i 's/^ \tif (!vma_data_pages(vma))$/ \tif (!vma_pages(vma))/' "$SUSFS_PATCH"
  fi

  SUSFS_612_GUARD_OLD_ROLLUP=0
  if grep -qF $' \t\t\tsmap_gather_stats(priv, vma, &mss);' "$SUSFS_PATCH" \
    && awk '/^static int show_smaps_rollup\(/{f=1}
      /^static const struct seq_operations proc_pid_smaps_op/{f=0}
      f && /smap_gather_stats\(vma, &mss,/{old=1} END{exit !old}' fs/proc/task_mmu.c; then
    ROLLUP_CALLS=$(awk '/^static int show_smaps_rollup\(/{f=1}
      /^static const struct seq_operations proc_pid_smaps_op/{f=0}
      f && /^\t+smap_gather_stats\(vma, &mss, (0|last_vma_end)\);$/{n++}
      END{print n+0}' fs/proc/task_mmu.c)
    if [[ "$ROLLUP_CALLS" != 3 ]]; then
      echo "::error::Legacy rollup stats calls have changed; aborting adaptation"
      exit 1
    fi
    # Equivalent stats guards for the two newer rollup hunks are applied during the version fixup phase.
    if ! awk '/^diff --git /{f=($0 ~ /^diff --git a\/fs\/proc\/task_mmu.c /);skip=0}
      /^@@ /{skip=f && /static int show_smaps_rollup/;if(skip)n++}
      !skip{print} END{exit(n!=2)}' "$SUSFS_PATCH" > "${SUSFS_PATCH}.tmp"; then
      rm -f "${SUSFS_PATCH}.tmp"
      echo "::error::Newer rollup hunks have changed; aborting adaptation"
      exit 1
    fi
    chmod --reference="$SUSFS_PATCH" "${SUSFS_PATCH}.tmp"
    mv "${SUSFS_PATCH}.tmp" "$SUSFS_PATCH"
    SUSFS_612_GUARD_OLD_ROLLUP=1
  fi
fi

# Newer kernels added trace/hooks/fs.h after internal.h in super.c; legacy SUSFS patches
# use thaw_super_locked as context to insert extern declarations and would be rejected.
# Since 2026-09-15 upstream moved the declarations after unnamed_dev_ida, avoiding this context,
# but pinned legacy patches may still use thaw_super_locked, so adjust only for older patches.
SUPER_FS_H_REMOVED=""
if grep -q '^ static int thaw_super_locked' "$SUSFS_PATCH" \
  && grep -qF '#include <trace/hooks/fs.h>' fs/super.c; then
  echo "Temporarily adjusting super.c context"
  sed -i '/^#include <trace\/hooks\/fs.h>$/,+1d' fs/super.c
  SUPER_FS_H_REMOVED=1
fi

# Generic WildKernels trace-hook include context restoration (handles any newly dropped <trace/hooks/*.h> lines & stubs missing headers)
python3 "$FIXES_DIR/susfs_restore_context.py" "$SUSFS_PATCH" "$PWD"

patch -p1 < "$SUSFS_PATCH" || true

# Widen fanotify_fdinfo() to 3 arguments when SUSFS widens show_fdinfo() (needed if CONFIG_FANOTIFY is enabled)
python3 "$FIXES_DIR/susfs_fdinfo_fanotify_arity.py" "$PWD"

# Fallback macro definition for VMA_PAD_START() on older monthly branches lacking pgsize_migration headers
if grep -q 'VMA_PAD_START(' fs/proc/task_mmu.c && ! grep -qE '#include <linux/pgsize_migration(_inline)?\.h>|define VMA_PAD_START' fs/proc/task_mmu.c; then
  sed -i '1a #ifndef VMA_PAD_START\n#define VMA_PAD_START(vma) ((vma)->vm_end)\n#endif' fs/proc/task_mmu.c
  echo "Added VMA_PAD_START fallback definition to fs/proc/task_mmu.c"
fi

# Restore legacy exec hook behavior if AweYukiSU does not yet provide the SU session FD helper
EXEC_HELPER=""
if [[ "$KSU_VARIANT" == "AweYukiSU" ]]; then
  if grep -qF 'ksu_install_su_fd();' fs/exec.c; then
    EXEC_HELPER="ksu_install_su_fd"
  elif grep -qF 'ksu_handle_post_execveat_sucompat(' fs/exec.c; then
    EXEC_HELPER="ksu_handle_post_execveat_sucompat"
  fi
fi
if [[ -n "$EXEC_HELPER" ]] \
  && ! grep -RqsE --include='*.c' "^[[:space:]]*int[[:space:]]+${EXEC_HELPER}[[:space:]]*\(" "$KERNEL_ROOT/KernelSU/kernel"; then
  echo "$KSU_VARIANT does not provide $EXEC_HELPER yet; restoring legacy exec hook"
  sed -i '/^extern int ksu_install_su_fd(void);$/d' fs/exec.c
  sed -i '/^extern int ksu_handle_post_execveat_sucompat(/,+1d' fs/exec.c
  sed -i 's/is_su_session = !\(ksu_handle_execveat[^;]*;\)/\1/' fs/exec.c
  sed -i '/^[[:space:]]*bool is_su_session = false;$/d' fs/exec.c
  sed -i '/^[[:space:]]*if (unlikely(is_su_session && retval >= 0))$/,+1d' fs/exec.c
  sed -i '/^[[:space:]]*if (unlikely(is_su_session))$/,+1d' fs/exec.c
  sed -i '/^#ifdef CONFIG_KSU_SUSFS$/N;/^#ifdef CONFIG_KSU_SUSFS\n#endif \/\/ #ifdef CONFIG_KSU_SUSFS$/d' fs/exec.c
  if grep -qE 'ksu_install_su_fd|ksu_handle_post_execveat_sucompat|is_su_session' fs/exec.c; then
    echo "::error::$KSU_VARIANT exec hook structure has changed; cannot apply compatibility fix"
    exit 1
  fi
fi

# Mark SUSFS credential helpers __maybe_unused so builds without CONFIG_KSU_SUSFS_PRIORITY_UID_FILTER
# or with optional SUSFS sub-features disabled never fail under GKI -Werror=unused-function.
if [[ -f fs/susfs.c ]]; then
  sed -i 's/^static struct cred \*susfs_switch_to_ksu_domain(void) {/static struct cred * __maybe_unused susfs_switch_to_ksu_domain(void) {/' fs/susfs.c
  sed -i 's/^static void susfs_restore_creds(struct cred \*orig_cred) {/static void __maybe_unused susfs_restore_creds(struct cred *orig_cred) {/' fs/susfs.c
fi

# Pre-i_user_ns() kernels (5.10, 5.15, and older 6.1) pass &init_user_ns explicitly to i_uid_into_mnt().
if [[ -f fs/susfs.c ]] && grep -q 'i_user_ns(' fs/susfs.c && ! grep -q 'i_user_ns' include/linux/fs.h; then
  echo "Target kernel lacks i_user_ns(); rewriting i_uid_into_mnt() calls in fs/susfs.c to &init_user_ns"
  python3 -c '
import pathlib, re
p = pathlib.Path("fs/susfs.c")
src = p.read_text(encoding="utf-8", errors="replace")
out, n = re.subn(r"i_uid_into_mnt\(i_user_ns\(([^()]*)\),", r"i_uid_into_mnt(&init_user_ns,", src)
if n:
    p.write_text(out, encoding="utf-8")
'
fi

# Upstream 5.10 patch places the extern declaration of susfs_sus_kstat_spoof_vfs_statfs
# after susfs_statfs_by_dentry, triggering an implicit declaration error under clang -Werror; move it earlier when needed.
if [[ -f fs/statfs.c ]] && grep -qF 'susfs_sus_kstat_spoof_vfs_statfs(' fs/statfs.c; then
  STATFS_USE=$(grep -n -m 1 'if (!susfs_sus_kstat_spoof_vfs_statfs(' fs/statfs.c | cut -d: -f1 || true)
  STATFS_DECL=$(grep -n -m 1 '^extern int susfs_sus_kstat_spoof_vfs_statfs(' fs/statfs.c | cut -d: -f1 || true)
  if [[ -n "$STATFS_USE" && -n "$STATFS_DECL" && "$STATFS_DECL" -gt "$STATFS_USE" ]] \
    && grep -q '^static int susfs_statfs_by_dentry(' fs/statfs.c; then
    echo "Moving susfs_sus_kstat_spoof_vfs_statfs declaration earlier in statfs.c"
    sed -i '/^static int susfs_statfs_by_dentry(/i extern int susfs_sus_kstat_spoof_vfs_statfs(struct inode *inode, struct kstatfs *buf, bool *is_fuse);' fs/statfs.c
  fi
fi

# Report conflict files generated by the main SUSFS patch before compilation; upstream .rej files are excluded
mapfile -t SUSFS_REJ_FILES < <(list_untracked_rej)
SUSFS_REJ_COUNT=${#SUSFS_REJ_FILES[@]}
if [ "$SUSFS_REJ_COUNT" -gt 0 ]; then
  echo "::warning title=SUSFS Patch Conflicts::Main SUSFS patch produced ${SUSFS_REJ_COUNT} .rej conflict file(s), which may cause build failure (see Rejects artifact)"
  printf '%s\n' "${SUSFS_REJ_FILES[@]}"
fi

# Restore temporary source adjustments used only for patch context matching
if [[ "$ANDROID_VERSION" == "android12" && "$KERNEL_VERSION" == "5.10" ]]; then
  if [[ "$CURRENT_SUB" -le 117 ]]; then
    echo "Restoring Android 12 5.10 fdinfo.c temporary adjustment"
    restore_legacy_fdinfo_context
  fi
fi

if [[ "$ANDROID_VERSION" == "android13" && "$KERNEL_VERSION" == "5.15" ]]; then
  if [[ "$CURRENT_SUB" -le 41 ]]; then
    echo "Restoring Android 13 5.15 temporary adjustments"
    sed -i '/#include <linux\/mnt_idmapping.h>$/d' fs/namespace.c
    sed -i '/#include <linux\/mnt_idmapping.h>$/d' fs/open.c
    restore_legacy_fdinfo_context
    sed -i 's|i_uid_into_mnt(i_user_ns(&fi->inode), &fi->inode).val|i_uid_into_mnt(\&init_user_ns, \&fi->inode).val|g' fs/susfs.c
    sed -i 's|i_uid_into_mnt(i_user_ns(inode), inode).val|i_uid_into_mnt(\&init_user_ns, inode).val|g' fs/susfs.c
  fi
  if [[ "$NS_BLK_515_ADJUST" == "added" ]]; then
    sed -i '/^#include <trace\/hooks\/blk.h>$/d' fs/namespace.c
  elif [[ "$NS_BLK_515_ADJUST" == "removed" ]] && ! grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
    sed -i '/^#include "internal.h"$/a #include <trace/hooks/blk.h>' fs/namespace.c
  fi
  if [[ "$TASK_MM_515_ADJUST" == "added" ]]; then
    sed -i '/^#include <trace\/hooks\/mm.h>$/d' fs/proc/task_mmu.c
  elif [[ "$TASK_MM_515_ADJUST" == "removed" ]] && ! grep -qxF '#include <trace/hooks/mm.h>' fs/proc/task_mmu.c; then
    sed -i '/^#include <linux\/pkeys.h>$/a #include <trace/hooks/mm.h>' fs/proc/task_mmu.c
  fi
fi

if [[ "$ANDROID_VERSION" == "android14" && "$KERNEL_VERSION" == "6.1" ]]; then
  if [[ "$CURRENT_SUB" -le 25 ]]; then
    sed -i '/^#include <trace\/hooks\/sched.h>$/d' fs/proc/base.c
  fi
  if [[ "$CURRENT_SUB" -le 141 ]]; then
    echo "Restoring Android 14 6.1 base.c temporary adjustment"
    sed -i '/^#include <linux\/dma-buf.h>$/d' fs/proc/base.c
  fi
  if [[ "$NS_BLK_ADJUST" == "added" ]]; then
    echo "Restoring Android 14 6.1 namespace.c temporary adjustment (removing added blk.h)"
    sed -i '/^#include <trace\/hooks\/blk.h>$/d' fs/namespace.c
  elif [[ "$NS_BLK_ADJUST" == "removed" ]] && ! grep -qxF '#include <trace/hooks/blk.h>' fs/namespace.c; then
    echo "Restoring Android 14 6.1 namespace.c temporary adjustment (restoring blk.h)"
    sed -i '/^#include "internal.h"$/a #include <trace/hooks/blk.h>' fs/namespace.c
  fi
fi

if [[ "$ANDROID_VERSION" == "android15" && "$KERNEL_VERSION" == "6.6" ]]; then
  if [[ "$CURRENT_SUB" -le 30 ]]; then
    python3 "$FIXES_DIR/susfs_fake_66_smaps.py" fs/proc/task_mmu.c revert
  fi
  if [[ "$CURRENT_SUB" -le 92 ]]; then
    echo "Restoring Android 15 6.6 base.c temporary adjustment"
    sed -i '/^#include <linux\/dma-buf.h>$/d' fs/proc/base.c
  fi
  if [[ "$CURRENT_SUB" -le 57 ]]; then
    echo "Restoring Android 15 6.6 memory.c temporary adjustment"
    sed -i '/^#include <linux\/zswap.h>$/d' mm/memory.c
  fi
fi

if [[ "$ANDROID_VERSION" == "android16" && "$KERNEL_VERSION" == "6.12" ]]; then
  if [[ "$EXEC_DMA_ADJUST" == "added" ]]; then
    sed -i '/^#include <linux\/dma-buf.h>$/d' fs/exec.c
  elif [[ "$EXEC_DMA_ADJUST" == "removed" ]] && ! grep -qxF '#include <linux/dma-buf.h>' fs/exec.c; then
    sed -i '/^#include <linux\/ksm.h>$/a #include <linux/dma-buf.h>' fs/exec.c
  fi
fi

if [[ -n "$SUPER_FS_H_REMOVED" ]] \
  && ! grep -qF '#include <trace/hooks/fs.h>' fs/super.c; then
  echo "Restoring super.c temporary adjustment"
  sed -i '/^#include "internal.h"$/a #include <trace/hooks/fs.h>' fs/super.c
fi

fix_missing_vm_flags_clear() {
  if [[ "$OS_PATCH_LEVEL" == "2024-11" ]] && grep -qF 'vm_flags_clear(new_vma, VM_PAD_MASK);' ./mm/mmap.c; then
    sed -i 's/vm_flags_clear(new_vma, VM_PAD_MASK);/new_vma->vm_flags \&= ~VM_PAD_MASK;/' ./mm/mmap.c
  fi
}

# Android 12 - 5.10 fixes
if [[ "$ANDROID_VERSION" == "android12" && "$KERNEL_VERSION" == "5.10" ]]; then
  # Fix 2024-11 branch: mmap.c calls vm_flags_clear(), but mm.h on the same branch lacks the helper
  fix_missing_vm_flags_clear
fi

# Android 13 - 5.15 fixes
if [[ "$ANDROID_VERSION" == "android13" && "$KERNEL_VERSION" == "5.15" ]]; then
  # Fix 2024-11 branch: mmap.c calls vm_flags_clear(), but mm.h on the same branch lacks the helper
  fix_missing_vm_flags_clear
fi

# Android 16 - 6.12 fixes
if [[ "$ANDROID_VERSION" == "android16" && "$KERNEL_VERSION" == "6.12" ]]; then
  # Guard only hidden mapping stats calls without altering existing iteration, locking, or range updates.
  if [[ "$SUSFS_612_GUARD_OLD_ROLLUP" == "1" ]]; then
    ROLLUP_MARKERS=$(grep -cF '/* SUSFS 6.12 legacy rollup stats compatibility guard. */' fs/proc/task_mmu.c || true)
    if [[ "$ROLLUP_MARKERS" == 0 ]]; then
      if ! awk '/^static int show_smaps_rollup\(/{f=1}
        /^static const struct seq_operations proc_pid_smaps_op/{f=0}
        f && /^\t+smap_gather_stats\(vma, &mss, (0|last_vma_end)\);$/ {
          match($0,/^\t+/);indent=substr($0,1,RLENGTH)
          print indent "/* SUSFS 6.12 legacy rollup stats compatibility guard. */"
          print "#ifdef CONFIG_KSU_SUSFS_SUS_MAP"
          print indent "if (!vma->vm_file || !(SUSFS_IS_INODE_SUS_MAP(file_inode(vma->vm_file))))"
          print "#endif"
          print "\t" $0;n++;next
        }
        {print} END{exit(n!=3)}' fs/proc/task_mmu.c > fs/proc/task_mmu.c.tmp; then
        rm -f fs/proc/task_mmu.c.tmp
        echo "::error::Failed to insert legacy rollup stats guards"
        exit 1
      fi
      chmod --reference=fs/proc/task_mmu.c fs/proc/task_mmu.c.tmp
      mv fs/proc/task_mmu.c.tmp fs/proc/task_mmu.c
    elif [[ "$ROLLUP_MARKERS" != 3 ]]; then
      echo "::error::Incomplete legacy rollup stats guards"
      exit 1
    fi
  fi
fi

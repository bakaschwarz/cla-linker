---
phase: 01-core-symlink-engine
fixed_at: 2026-04-08T16:32:00Z
review_path: .planning/phases/01-core-symlink-engine/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-08
**Source review:** .planning/phases/01-core-symlink-engine/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 Critical, 4 Warnings)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Path traversal in `new` command

**Files modified:** `src/commands/new.js`
**Commit:** `82fd3bf`
**Applied fix:** Added a guard immediately after `getRepoPath()` that rejects any `name` containing `/`, `\`, or `..`. Uses the simpler string-contains check (reviewer's alternative approach) rather than the `path.resolve` + `startsWith` check, since the string check is more explicit and covers the exact attack vectors.

---

### WR-01: Backup file silently overwritten on repeated conflict resolution

**Files modified:** `src/services/symlink-manager.js`
**Commit:** `1a33504`
**Applied fix:** Before renaming to `target + '.clawd-backup'`, the code now calls `lstat(backupPath).catch(() => null)` to check whether a backup already exists. If it does, the rename uses a timestamped suffix (`target + '.clawd-backup-' + Date.now()`) instead of the fixed name, preventing silent clobber of a previous backup.

Note: WR-04 fix is also included in this commit because both changes targeted `symlink-manager.js` and were staged together.

---

### WR-02: Unhandled errors during install/uninstall loop leave state partially updated

**Files modified:** `src/commands/manage.js`
**Commit:** `95aaccf`
**Applied fix:** Both the install and uninstall loops are now wrapped in `try/catch` blocks. Failures are pushed into an `errors` array and reported inline per package. After both loops complete, if any errors occurred the function prints a summary count. The final "Done." message is shown only when there are no errors.

---

### WR-03: `access()` used to verify a directory exists, but it succeeds on regular files too

**Files modified:** `src/config.js`, `src/services/package-registry.js`
**Commit:** `8ad4d2c`
**Applied fix:**
- `config.js`: Replaced `access(raw.repoPath)` with `lstat(raw.repoPath)` followed by an `isDirectory()` check. Updated the import to remove `access` and add `lstat`.
- `package-registry.js`: Replaced `access(filesPath)` with `lstat(filesPath)` followed by `isDirectory()`. Non-directory paths now `continue` (skip) just like missing paths. Updated the import accordingly.

---

### WR-04: `installPackage` records only the current run's symlinks, erasing pre-existing owned links on re-install

**Files modified:** `src/services/symlink-manager.js`
**Commit:** `1a33504` (committed together with WR-01 — both fixes target the same file)
**Applied fix:** After the walk loop builds `ownedLinks`, the previous state for `projectPath` is read and any paths not present in the current run (i.e., source files deleted from the package) are appended to the merged array. This ensures `uninstallPackage` retains awareness of stale symlinks and can clean them up rather than leaking them.

---

_Fixed: 2026-04-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

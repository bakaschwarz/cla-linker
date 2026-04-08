---
phase: 01-core-symlink-engine
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - bin/clawd-linker.js
  - package.json
  - src/commands/init.js
  - src/commands/manage.js
  - src/commands/new.js
  - src/config.js
  - src/services/package-registry.js
  - src/services/package-state.js
  - src/services/symlink-manager.js
  - src/utils/fs.js
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed all 10 source files implementing the core symlink engine. The overall structure is sound: atomic writes, idempotent installs, and the owned-symlinks-only uninstall model are all implemented correctly. One critical path traversal vulnerability exists in the `new` command where the package name flows directly into a filesystem path without sanitization. Four warnings cover a backup-clobbering bug, unhandled errors mid-loop that can leave state inconsistent, and two `access()` calls that succeed on files when a directory is expected. Three info items cover dead code, redundant resolution, and a minor `files` check.

## Critical Issues

### CR-01: Path traversal in `new` command — package name used as directory path without sanitization

**File:** `src/commands/new.js:22`

**Issue:** `name` is taken directly from the CLI argument and joined into a filesystem path with no validation:

```js
const pkgPath = path.join(repoPath, name);
```

A name such as `../evil` or `../../etc/cron.d/backdoor` resolves outside `repoPath`. The `access()` check on line 27 only verifies whether the path exists — it does not enforce that the resolved path is a child of `repoPath`. Because `newCommand` then calls `mkdir`, `writeFile`, and `writeFile` again on subdirectories of `pkgPath`, this allows arbitrary directory creation and file writes anywhere the user has permission.

**Fix:** Resolve the candidate path and assert it is inside `repoPath` before proceeding:

```js
const pkgPath = path.resolve(repoPath, name);
if (!pkgPath.startsWith(path.resolve(repoPath) + path.sep)) {
  console.error(chalk.red(`Invalid package name: "${name}"`));
  process.exit(1);
}
```

Alternatively, validate that `name` contains no path separators or `..` segments:

```js
if (name.includes('/') || name.includes('\\') || name.includes('..')) {
  console.error(chalk.red(`Package name must not contain path separators or ".."`));
  process.exit(1);
}
```

## Warnings

### WR-01: Backup file silently overwritten on repeated conflict resolution

**File:** `src/services/symlink-manager.js:45`

**Issue:** When a real file exists at a symlink target and the user chooses to overwrite, the code renames the original to `target + '.clawd-backup'`:

```js
await rename(target, target + '.clawd-backup');
```

If `target + '.clawd-backup'` already exists (the user ran `manage` twice and chose overwrite both times), `rename` atomically replaces it. The user's original backup — and therefore their original file — is silently destroyed with no warning. This is the only copy of the pre-link state.

**Fix:** Check whether the backup path exists before renaming, and either generate a timestamped backup name or abort with an error:

```js
const backupPath = target + '.clawd-backup';
const backupStat = await lstat(backupPath).catch(() => null);
if (backupStat) {
  // Use timestamped backup to avoid clobbering
  const ts = Date.now();
  await rename(target, `${target}.clawd-backup-${ts}`);
} else {
  await rename(target, backupPath);
}
```

### WR-02: Unhandled errors during install/uninstall loop leave state partially updated

**File:** `src/commands/manage.js:75-84`

**Issue:** `installPackage` and `uninstallPackage` are awaited inside a `for` loop with no error handling:

```js
for (const pkg of toInstall) {
  const links = await installPackage(pkg, projectPath, conflictCallback);
  console.log(chalk.green(`  Installed ${pkg.name} (${links.length} files)`));
}
```

If `installPackage` throws partway through (e.g., a filesystem permission error after some symlinks have been created and `data.json` has already been written), the loop exits silently via unhandled rejection propagation. The user sees no summary of which packages succeeded or failed, and state may be partially applied without any indication.

**Fix:** Wrap each call in a try/catch and accumulate failures, then report them at the end:

```js
const errors = [];
for (const pkg of toInstall) {
  try {
    const links = await installPackage(pkg, projectPath, conflictCallback);
    console.log(chalk.green(`  Installed ${pkg.name} (${links.length} files)`));
  } catch (err) {
    errors.push({ pkg: pkg.name, err });
    console.log(chalk.red(`  Failed to install ${pkg.name}: ${err.message}`));
  }
}
// Same pattern for toUninstall
if (errors.length > 0) {
  console.error(chalk.red(`\n${errors.length} package(s) had errors.`));
}
```

### WR-03: `access()` used to verify a directory exists, but it succeeds on regular files too

**File:** `src/config.js:31`, `src/services/package-registry.js:30`

**Issue:** Both locations use `fs/promises.access()` (default F_OK) to verify that a path is a usable directory:

- `config.js:31` — verifies the configured repo path is valid before returning it to callers.
- `package-registry.js:30` — verifies that a package's `files/` subdirectory exists.

`access()` returns successfully for any path that exists, including regular files. If a file named `clawd-packages` exists at the configured repo path, `getRepoPath()` reports it as valid; `listPackages()` then calls `readdir()` on it and throws `ENOTDIR` with a generic OS error rather than the expected user-friendly message.

**Fix:** Use `lstat()` and check `isDirectory()`:

```js
// config.js — replace the access() block
try {
  const st = await lstat(raw.repoPath);
  if (!st.isDirectory()) {
    throw new Error('not a directory');
  }
} catch {
  console.error(chalk.red(`Package repo not found at ${raw.repoPath}. Run \`clawd-linker init\` to reconfigure.`));
  process.exit(1);
}
```

Apply the same pattern in `package-registry.js` for `filesPath`.

### WR-04: `installPackage` records only the current run's symlinks, erasing pre-existing owned links on re-install

**File:** `src/services/symlink-manager.js:53-55`

**Issue:** After the install loop completes, the state is written as:

```js
state.installedIn[projectPath] = ownedLinks;
```

`ownedLinks` is built only from files walked in the current run. If a file was previously installed (and thus already has the correct symlink), it is pushed to `ownedLinks` at line 35 and correctly included. However, if a file has been manually removed from `pkg.filesPath` after installation but the old symlink still exists in the project, the old path is silently dropped from `data.json` on the next install. This means `uninstallPackage` will not clean it up.

This is an edge case rather than a common-path bug, but it creates symlink leakage: stale symlinks remain in the project directory with no record of ownership, pointing to a deleted source file (broken symlink).

**Fix:** After building `ownedLinks`, merge it with the previous state to preserve any paths that were previously recorded but not visited (i.e., source files that no longer exist). Alternatively, document this limitation explicitly so users know to manually remove stale symlinks when deleting source files from a package.

## Info

### IN-01: Unreachable `!name` guard in `new` command

**File:** `src/commands/new.js:16-19`

**Issue:** Commander's `<name>` syntax marks the argument as required and exits with a usage error if it is missing, so the `if (!name)` check on line 16 is never reached at runtime.

```js
if (!name) {
  console.error(chalk.red('Package name is required. Usage: clawd-linker new <name>'));
  process.exit(1);
}
```

**Fix:** Remove the dead guard. If keeping it for extra safety, document why it is there despite commander's validation.

### IN-02: Redundant `path.resolve()` in `setRepoPath`

**File:** `src/config.js:45`

**Issue:** `init.js` already calls `path.resolve(repoPath)` at line 39 before passing the value to `setRepoPath`. Inside `setRepoPath`, `path.resolve` is called again on line 45. The double resolution is harmless but signals an unclear ownership of the "resolve to absolute" responsibility.

**Fix:** Pick one location and document it. Either resolve inside `setRepoPath` (and remove the caller-side resolve) or remove the resolve from `setRepoPath` and document that it expects an absolute path.

### IN-03: `access()` in `init.js` re-validation does not confirm the path is a directory

**File:** `src/commands/init.js:20`

**Issue:** The guard that prevents re-init uses `access(config.repoPath)` to check the existing config path. This is the same `access()` vs. `isDirectory()` issue noted in WR-03, here in a lower-stakes context (the early-exit guard on line 18-23). A file at that path would suppress re-init unnecessarily and show the "already configured" message.

**Fix:** Use `lstat().then(st => st.isDirectory())` for the existence check, consistent with WR-03.

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

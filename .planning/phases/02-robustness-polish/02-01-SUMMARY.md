---
phase: 02-robustness-polish
plan: "01"
subsystem: symlink-manager, manage-command, cli
tags: [dry-run, headless, empty-dirs, robustness]
dependency_graph:
  requires: []
  provides: [dry-run-preview, headless-mode, empty-dir-cleanup]
  affects: [src/services/symlink-manager.js, src/commands/manage.js, bin/clawd-linker.js]
tech_stack:
  added: []
  patterns: [options-object-threading, dryRun-guard, headless-isTTY-check]
key_files:
  created: []
  modified:
    - src/utils/fs.js
    - src/services/symlink-manager.js
    - src/commands/manage.js
    - bin/clawd-linker.js
decisions:
  - "Headless manage = no-op: safe default when stdin is non-TTY or --yes is passed; user must run interactively to change packages"
  - "dryRun skips confirm prompt entirely (no interactive call needed) and also skips writeState to prevent data.json mutation"
  - "cleanEmptyDirs traverses from removed symlink up to (but not including) projectPath, deepest-first, removing only empty dirs"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 01: --dry-run, --yes/headless mode, and empty directory cleanup Summary

One-liner: Added `--dry-run` flag (preview with no fs writes), `--yes`/non-TTY headless guard, and `cleanEmptyDirs` post-uninstall cleanup to the manage command.

## What Was Built

- **ROB-01 (dry-run):** `installPackage` and `uninstallPackage` accept a `{ dryRun }` option. When true, all filesystem mutations (mkdir, symlink, unlink) and state mutations (writeState) are skipped; chalk-colored preview messages are logged instead.
- **ROB-02 (empty dir cleanup):** New `cleanEmptyDirs(removedPaths, projectPath)` export collects parent directories of removed symlinks, sorts deepest-first, and removes only empty ones. Called in manage after all uninstalls (not during dry-run).
- **UX-02 (headless mode):** `manageCommand` checks `options.yes || !process.stdin.isTTY` before any `@inquirer` call. If headless, prints an informational message and returns immediately.
- **CLI options:** `--dry-run` and `-y, --yes` registered on the `manage` command via Commander `.option()` and passed as options object to `manageCommand(options)`.
- **rmdir export:** Added `rmdir` from `fs/promises` to `src/utils/fs.js` imports and re-exports for use by `cleanEmptyDirs`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 32b8519 | feat(02-01): add dry-run option and cleanEmptyDirs to symlink-manager |
| Task 2 | a315c72 | feat(02-01): wire --dry-run, --yes, and headless mode into manage command |

## Decisions Made

1. **Headless = no-op**: When `--yes` or non-TTY is detected, the command exits early before reading installed state or showing any prompt. This is the safe default — prevents accidental changes in CI.
2. **dryRun skips confirm**: When `--dry-run` is active, the `inquirerConfirm('Proceed?')` is skipped — dry-run executes immediately to show the preview without any prompt.
3. **cleanEmptyDirs path guard**: Uses `dir !== projectPath && dir.startsWith(projectPath)` to prevent climbing above project root (T-02-03 mitigation from threat model).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Threat Flags

None - T-02-03 mitigation (projectPath boundary guard in cleanEmptyDirs) was implemented as specified in the threat model.

## Self-Check: PASSED

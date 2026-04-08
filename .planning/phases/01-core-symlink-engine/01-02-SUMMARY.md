---
phase: 01-core-symlink-engine
plan: "02"
subsystem: services
tags: [symlink, package-registry, package-state, symlink-manager, core-engine]
dependency_graph:
  requires: ["01-01"]
  provides: [package-registry, package-state, symlink-manager]
  affects: ["01-03"]
tech_stack:
  added: []
  patterns:
    - atomic-write-tmp-rename
    - per-symlink-ownership-in-data-json
    - absolute-path-symlinks
    - conflict-detection-with-callback
    - idempotent-install-via-readlink
key_files:
  created:
    - src/services/package-registry.js
    - src/services/package-state.js
    - src/services/symlink-manager.js
  modified: []
decisions:
  - "Package registry validates files/ subdirectory presence — directories without it are skipped silently (Pitfall 6)"
  - "data.json shape: { schemaVersion: 1, installedIn: { '/abs/project': ['/abs/symlink/paths'] } } (STATE-02)"
  - "Atomic writes via tmp+rename in writeState prevent data corruption on crash (Pitfall 4)"
  - "installPackage uses conflictCallback for per-file conflict decisions; backs up real files to .clawd-backup (LINK-05 / Pitfall 7)"
  - "Idempotency via readlink comparison: existing correct symlinks are no-ops (STATE-03)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-08"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
requirements:
  - STATE-01
  - STATE-02
  - STATE-03
  - LINK-01
  - LINK-02
  - LINK-03
  - LINK-04
  - LINK-05
  - PKG-01
---

# Phase 1 Plan 02: Core Service Modules Summary

**One-liner:** Three-module symlink engine — package discovery, atomic JSON state, and per-file absolute-path symlink install/uninstall with conflict detection.

## What Was Built

### src/services/package-registry.js

Enumerates valid packages in the repository. A package is a directory containing a `files/` subdirectory. Returns `PackageDescriptor[]` sorted by name. Skips dot-directories and any directory lacking `files/`.

Exports: `listPackages(repoPath)`

### src/services/package-state.js

Reads and writes `data.json` with per-symlink ownership per project path. Implements STATE-01 (state file exists per package) and STATE-02 (per-project symlink arrays). Resilient to missing or corrupt `data.json` — returns empty state instead of throwing. Uses atomic `tmp`+`rename` pattern (Pitfall 4).

Exports: `readState(dataJsonPath)`, `writeState(dataJsonPath, state)`, `getInstalledPackages(projectPath, packages)`

### src/services/symlink-manager.js

Core symlink engine. Implements LINK-01 through LINK-05 and STATE-03:

- **LINK-01:** Walks `pkg.filesPath` recursively (not package root)
- **LINK-02:** `path.resolve()` on both source and target — absolute paths only
- **LINK-03:** `mkdir(dirname, { recursive: true })` before each symlink
- **LINK-04:** Uninstall reads owned links from `data.json`, removes only those
- **LINK-05:** `conflictCallback` called per real-file conflict; user decides skip/overwrite
- **STATE-03:** `readlink()` comparison — already-correct symlinks are idempotent no-ops
- **Pitfall 7:** Backs up real files to `.clawd-backup` before overwriting

Exports: `installPackage(pkg, projectPath, conflictCallback)`, `uninstallPackage(pkg, projectPath)`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create package-registry and package-state services | 84c2265 | src/services/package-registry.js, src/services/package-state.js |
| 2 | Create symlink-manager service | d29c8f5 | src/services/symlink-manager.js |

## Decisions Made

1. Package registry checks `access(filesPath)` rather than `lstat` — simpler and sufficient for existence check.
2. `readState` validates minimum shape (`installedIn` must be an object) in addition to JSON parse — guards against partially-written JSON edge cases.
3. `installPackage` returns `ownedLinks` (all owned symlinks, including pre-existing correct ones) so `data.json` always reflects the full installed state, not just newly-created links.
4. `uninstallPackage` silently skips paths that are no longer symlinks — handles the case where the user manually deleted or replaced a linked file.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All security mitigations from the threat model were implemented:

| Threat ID | Mitigation | Implemented |
|-----------|------------|-------------|
| T-02-01 | Atomic write via tmp+rename; readState falls back on error | Yes — writeState and readState |
| T-02-02 | Backup real files to .clawd-backup before overwrite | Yes — rename(target, target + '.clawd-backup') |

No new threat surface introduced beyond what was planned.

## Known Stubs

None — all three modules are fully wired. `conflictCallback` is a parameter that Plan 03 (commands) will supply from `@inquirer/prompts`.

## Self-Check: PASSED

Files verified present:
- src/services/package-registry.js: FOUND
- src/services/package-state.js: FOUND
- src/services/symlink-manager.js: FOUND

Commits verified:
- 84c2265: feat(01-02): create package-registry and package-state services
- d29c8f5: feat(01-02): create symlink-manager with install, uninstall, and conflict detection

# Phase 1: Core Symlink Engine - Research

**Researched:** 2026-04-08
**Domain:** Node.js CLI symlink package manager — init, scaffold, manage, symlink engine, state tracking
**Confidence:** HIGH — stack fully verified via npm registry; architecture patterns derived from existing project research artifacts synthesized before this phase

---

## Summary

Phase 1 delivers the entire v1 feature surface: `init`, `new`, and `manage` commands, the symlink engine, and state tracking. All library choices are locked in CLAUDE.md. No library selection research is needed — every dependency is already decided.

The primary research value for this phase is: (1) establishing the correct module architecture so services are testable and independently composable, (2) documenting the exact Node.js `fs/promises` API patterns for symlink operations, (3) surfacing the four critical pitfalls that must be designed around from day one (stale state, relative paths, directory conflicts, non-atomic writes), and (4) specifying the `data.json` schema shape that supports per-symlink ownership correctly — this cannot be retrofitted after the fact.

The project's existing research (`.planning/research/`) already contains deep analysis of pitfalls, architecture patterns, and feature landscape. This RESEARCH.md synthesizes those findings into prescriptive guidance for planning Phase 1 tasks.

**Primary recommendation:** Build bottom-up — fs-utils first, then services, then commands, then bin entry. The symlink engine and state layer are the load-bearing components; TUI and CLI wiring are thin orchestration on top.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INIT-01 | `npx clawd-linker init` creates git-initialized repo and stores path in `~/.clawd-linker` | Config layer pattern + simple-git `git.init()` |
| INIT-02 | Re-running `init` with valid config warns and exits cleanly | Read config; validate repo path exists; warn + exit if valid |
| PKG-01 | `npx clawd-linker new <name>` scaffolds `files/`, `PACKAGE.md`, `data.json` | `fs.mkdir` + `fs.writeFile` per file; config read for repoPath |
| PKG-02 | `data.json` gitignored via per-package `.gitignore` | Write/append `<pkg>/.gitignore` with `data.json` line at scaffold time |
| MGR-01 | `manage` (alias `m`) opens interactive checkbox list of all packages | `@inquirer/prompts` checkbox; commander `.alias('m')` |
| MGR-02 | Installed packages are pre-checked in TUI | Query `data.json` for each package before rendering; set `checked: true` |
| MGR-03 | Selection drives install/uninstall | Diff selection vs current state; call symlink engine per package |
| LINK-01 | Installing symlinks each file in `files/` to corresponding project-root path | Recursive lstat-based walk of `files/`; `fs.symlink` per file |
| LINK-02 | All symlinks use absolute paths | `path.resolve()` for both source and target before any fs call |
| LINK-03 | Parent directories created before symlinking | `fs.mkdir(parentDir, { recursive: true })` before each `fs.symlink` |
| LINK-04 | Uninstalling removes exactly the symlinks that package owns | Per-symlink ownership list in `data.json`; `fs.unlink` only owned paths |
| LINK-05 | Real file at target prompts per-conflict: skip or overwrite | `fs.lstat` before `fs.symlink`; `@inquirer/prompts` confirm per conflict |
| STATE-01 | `data.json` records which project paths have the package installed | Top-level keys in `installedIn` are absolute project paths |
| STATE-02 | `data.json` records per-symlink ownership per project | Value per project key is array of absolute symlink target paths |
| STATE-03 | Re-running `manage` with same selection is a no-op | Diff yields empty toInstall/toRemove; symlink check confirms existing link |
| CFG-01 | `~/.clawd-linker` stores repo path as JSON | `{ "repoPath": "...", "schemaVersion": 1 }`; written at `init` time |
| CFG-02 | Missing repo path at startup exits with clear error | `fs.access` check on startup; fail with actionable message before any command |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

### Runtime and Module Format
- **ESM only** — `"type": "module"` in package.json; no CJS; no build step
- **Node.js >= 20.12.0** — minimum required by `@inquirer/prompts` (most restrictive dep)
- **Plain JavaScript** — no TypeScript; JSDoc `@param` for IDE autocompletion if desired

### Locked Library Choices
| Package | Pinned Version | Role |
|---------|---------------|------|
| `commander` | `^14.0.3` | CLI routing |
| `@inquirer/prompts` | `^8.4.1` | Checkbox + confirm prompts |
| `conf` | `^15.1.0` | Global config at `~/.clawd-linker` |
| `simple-git` | `^3.35.2` | `git init` for new package repos |
| `chalk` | `^5.6.2` | Terminal output color |
| `vitest` | `^4.1.3` | Test runner (dev dependency) |

### Intentionally Omitted (do not introduce)
`execa`, `ora`, `@types/node`, `tsup`, `tsx`, `zod`, `fs-extra`, `glob`, `ink`, `@clack/prompts`

### Platform
macOS-first. Symlinks assumed available. No Windows support.

### Scope
Personal tool — no auth, no server, no multi-user scenarios.

---

## Standard Stack

All versions verified against npm registry on 2026-04-08. [VERIFIED: npm registry]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `commander` | 14.0.3 | Arg parsing, subcommand routing, `--help` generation | 316M weekly downloads; simplest surface for 3 subcommands |
| `@inquirer/prompts` | 8.4.1 | All interactive prompts: checkbox, confirm, input | 19.3M downloads; native ESM; checkbox with pre-checked items |
| `conf` | 15.1.0 | Read/write `~/.clawd-linker` JSON config atomically | 3.3M downloads; atomic writes; ESM-only module |
| `simple-git` | 3.35.2 | `git init` on new package repo | 10M downloads; structured errors vs raw shell |
| `chalk` | 5.6.2 | Colored terminal output | 374M downloads; ESM-only in v5+ |

### Dev
| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.3 | Zero-config ESM test runner |

### Alternatives Already Decided Against
| Instead of | Would Have Used | Why Locked Out |
|------------|-----------------|----------------|
| `@inquirer/prompts` | `@clack/prompts` | Clack has no checkbox/multi-select prompt |
| `conf` | plain `fs` + JSON | Both valid; conf wins on atomic writes |
| `simple-git` | `execa('git', [...])` | simple-git gives structured errors |
| `vitest` | `jest` | Jest requires ESM transform config |

**Installation:**
```bash
npm install commander @inquirer/prompts conf simple-git chalk
npm install --save-dev vitest
```

---

## Architecture Patterns

### Recommended Project Structure
```
clawd-linker/
├── bin/
│   └── clawd-linker.js         # #!/usr/bin/env node; commander setup; routes to commands
├── src/
│   ├── commands/
│   │   ├── init.js             # Thin: orchestrates init UX; calls config + simple-git
│   │   ├── new.js              # Thin: orchestrates scaffold UX; calls config + fs-utils
│   │   └── manage.js           # Thin: TUI + diff; calls all services + inquirer
│   ├── services/
│   │   ├── package-registry.js # Enumerates packages in repo; returns PackageDescriptor[]
│   │   ├── package-state.js    # Reads/writes data.json per package; atomic writes
│   │   └── symlink-manager.js  # Creates/removes symlinks; detects conflicts; per-file
│   ├── config.js               # Reads/writes ~/.clawd-linker; exposes get/set
│   └── utils/
│       └── fs.js               # ONLY file that imports fs/promises
├── tests/
│   ├── unit/
│   │   ├── fs-utils.test.js
│   │   ├── config.test.js
│   │   ├── package-registry.test.js
│   │   ├── package-state.test.js
│   │   └── symlink-manager.test.js
│   └── integration/
│       └── manage.test.js
├── package.json
└── .gitignore
```

### Pattern 1: Thin Commands, Fat Services
**What:** Commands own UX (prompts, chalk output, exit codes). Services own business logic (filesystem operations, state mutations). Commands never import `fs/promises` directly.
**When to use:** Every command, always.

```javascript
// src/commands/manage.js — thin orchestrator
// Source: .planning/research/ARCHITECTURE.md
async function manageCommand() {
  const repoPath = await config.getRepoPath();
  const packages = await packageRegistry.list(repoPath);
  const installed = await packageState.getInstalledPackages(repoPath, process.cwd());
  const selected = await promptCheckbox(packages, installed);   // inquirer here
  const { toInstall, toRemove } = diff(packages, installed, selected);
  await symlinkManager.apply({ toInstall, toRemove, projectPath: process.cwd() });
}
```

### Pattern 2: fs-utils as the Only fs Boundary
**What:** `src/utils/fs.js` is the single file that imports `fs/promises`. Every other module calls through it. This creates one seam for testing and error handling.

```javascript
// src/utils/fs.js — the ONLY place that imports fs
import { symlink, unlink, lstat, readlink, readdir, mkdir, writeFile, rename, access } from 'fs/promises';

export { symlink, unlink, lstat, readlink, readdir, mkdir, writeFile, rename, access };
```

### Pattern 3: Package Descriptor Shape
**What:** Package Registry returns a consistent object shape. Nothing downstream parses raw paths.

```javascript
// PackageDescriptor — canonical shape for a package
// Source: .planning/research/ARCHITECTURE.md
{
  name: "my-claude-commands",
  path: "/Users/yannick/packages/my-claude-commands",
  filesPath: "/Users/yannick/packages/my-claude-commands/files",
  dataJsonPath: "/Users/yannick/packages/my-claude-commands/data.json"
}
```

### Pattern 4: data.json Schema — Per-Symlink Ownership (CRITICAL)
**What:** `data.json` records per-project which symlinks this package owns. This shape is required by STATE-02 and LINK-04. A flat `installedIn: ["/path/to/project"]` boolean array is insufficient and cannot be retrofitted.

```javascript
// data.json — REQUIRED shape for STATE-01, STATE-02, LINK-04
{
  "schemaVersion": 1,
  "installedIn": {
    "/abs/path/to/project-a": [
      "/abs/path/to/project-a/.gitignore",
      "/abs/path/to/project-a/.claude/commands/my-cmd.md"
    ],
    "/abs/path/to/project-b": [
      "/abs/path/to/project-b/.gitignore"
    ]
  }
}
```

The value for each project key is the ordered list of absolute paths that this package owns as symlinks in that project. Uninstall reads this list and `fs.unlink`s exactly these paths.

### Pattern 5: Atomic State Writes
**What:** Write to `data.json.tmp`, then `fs.rename` to `data.json`. Rename is atomic on the same filesystem — prevents truncated JSON on crash.

```javascript
// src/services/package-state.js
async function writeState(dataJsonPath, state) {
  const tmp = dataJsonPath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, dataJsonPath);  // atomic on same FS — Pitfall 4 prevention
}

async function readState(dataJsonPath) {
  try {
    const raw = await fs.readFile(dataJsonPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { schemaVersion: 1, installedIn: {} };  // treat missing/corrupt as empty
  }
}
```

### Pattern 6: Symlink Install Flow (implements LINK-01 through LINK-05)
**What:** For each file in `files/` (recursive, lstat-based walk), check for conflicts then create symlink.

```javascript
// src/services/symlink-manager.js — install one package
// Source: .planning/research/ARCHITECTURE.md (adapted)
async function installPackage(pkg, projectPath, conflictCallback) {
  const files = await walkFiles(pkg.filesPath);  // lstat-based walk
  const ownedLinks = [];

  for (const relPath of files) {
    const source = path.resolve(pkg.filesPath, relPath);   // absolute — LINK-02
    const target = path.resolve(projectPath, relPath);     // absolute — LINK-02

    await fs.mkdir(path.dirname(target), { recursive: true });  // LINK-03

    const stat = await fs.lstat(target).catch(() => null);
    if (stat?.isSymbolicLink()) {
      const existing = await fs.readlink(target);
      if (existing === source) continue;  // idempotent — STATE-03
    } else if (stat) {
      // real file exists — LINK-05: prompt per-conflict
      const action = await conflictCallback(target);   // returns 'skip' | 'overwrite'
      if (action === 'skip') continue;
      await fs.rename(target, target + '.clawd-backup');  // backup before overwrite
    }

    await fs.symlink(source, target);  // LINK-01, LINK-02
    ownedLinks.push(target);
  }

  return ownedLinks;  // caller updates data.json
}
```

### Pattern 7: lstat-Based File Walker (no symlink following)
**What:** Walk `files/` using `lstat` semantics. Skip entries that are themselves symlinks — only regular files become symlinks in projects.

```javascript
// src/utils/fs.js — file walker
// Returns relative paths of regular files only
async function walkFiles(filesPath) {
  const entries = await fs.readdir(filesPath, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => !e.isDirectory() && !e.isSymbolicLink())  // Pitfall 7 prevention
    .map(e => path.relative(filesPath, path.join(e.path, e.name)));
    // Note: Dirent.path is the dir containing the entry (Node 20+)
    // Dirent.parentPath was added in Node 21.4 / 20.13 as an alias — use e.path for 20.12.0 compat
}
```

### Pattern 8: Build Order (dependency-driven)
```
Layer 0: src/utils/fs.js               (no deps — Node.js built-ins only)
Layer 1: src/config.js                 (deps: fs-utils)
         src/services/package-registry.js (deps: fs-utils)
         src/services/package-state.js    (deps: fs-utils)
Layer 2: src/services/symlink-manager.js  (deps: fs-utils)
Layer 3: src/commands/init.js          (deps: config, fs-utils, simple-git)
         src/commands/new.js           (deps: config, fs-utils, package-state)
         src/commands/manage.js        (deps: all services, @inquirer/prompts)
Layer 4: bin/clawd-linker.js           (deps: commander, all commands)
```

### Anti-Patterns to Avoid
- **Symlinking directories instead of individual files:** Two packages sharing `.claude/` would conflict. Always walk to leaf files.
- **Relative symlink targets:** `path.resolve()` is mandatory. Relative paths traverse `../..` and break on repo move.
- **Trusting data.json without filesystem verification:** `lstat` + `readlink` on every recorded path at `manage` startup.
- **Synchronous fs APIs (`readdirSync`, `symlinkSync`):** Block event loop; breaks testability. Use `fs/promises` only.
- **Walking `files/` with `stat` instead of `lstat`:** `stat` follows symlinks and recurses into symlink-to-directory. Use `lstat`.
- **Targeting package root instead of `<pkg>/files/`:** Causes `data.json` and `PACKAGE.md` to be symlinked into projects.
- **Module-level config singleton:** Pass config as function arguments for testability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global JSON config with atomic writes | Custom `~/.clawd-linker` write logic | `conf` library | Handles atomic writes, home dir resolution, JSON parse errors |
| Git repository initialization | `execa('git', ['init'])` | `simple-git` | Structured error objects; cleaner API |
| Interactive checkbox TUI | Custom readline/ANSI | `@inquirer/prompts` checkbox | Pre-checked items, keyboard nav, page scrolling built-in |
| Atomic file writes | `writeFile` directly | write-to-tmp + `fs.rename` | Rename is atomic on same FS — avoids truncated state on crash |
| Directory tree walk | Manual recursion | `fs.readdir(path, { withFileTypes: true, recursive: true })` | Built-in since Node 18.17; handles Dirent typing |

**Key insight:** The filesystem and state management primitives are where hand-rolled solutions accumulate edge cases. The four critical pitfalls all live here. Let libraries handle config + prompts + git; keep the custom code to the domain-specific logic.

---

## Common Pitfalls

All four critical pitfalls below are Phase 1 concerns. They cannot be retrofitted. [VERIFIED: .planning/research/PITFALLS.md]

### Pitfall 1: Stale data.json Produces Wrong Pre-Checked State (CRITICAL)
**What goes wrong:** `data.json` says package is installed; symlink was manually deleted. TUI pre-checks the package. User unchecks to "uninstall". Tool tries to `fs.unlink` a path that doesn't exist.
**Why it happens:** Trusting state storage without cross-validating the live filesystem.
**How to avoid:** On every `manage` invocation, for each project path recorded in `data.json`: call `fs.lstat` (confirms the symlink exists) and `fs.readlink` (confirms it points into the package repo). If stale: prune from `data.json` before rendering TUI. Use corrected filesystem state — not `data.json` alone — to determine the pre-checked set.
**Warning signs:** `data.json` grows unboundedly with old project paths; checkbox state contradicts `ls -la`.

### Pitfall 2: Relative Symlink Paths Break on Repo Move (CRITICAL)
**What goes wrong:** Tool creates symlinks with relative target paths (`../../repos/my-packages/...`). Repo moves. All symlinks silently point to ENOENT. `manage` sees them as "not installed" — not as broken — because `lstat` returns a `Dirent` (the symlink exists) but `readlink` yields a dead path.
**How to avoid:** `path.resolve()` on both `source` and `target` before any `fs.symlink` call. Store resolved absolute path in `~/.clawd-linker` at `init` time. At startup, `fs.access(repoPath)` and fail loudly if missing (CFG-02).
**Warning signs:** Any `..` segments in `readlink` output.

### Pitfall 3: Directory-vs-File Conflict Causes EEXIST or Partial Install (CRITICAL)
**What goes wrong:** Project has `.claude/` as a real directory. Tool tries to create a symlink at `.claude/` (because it incorrectly linked the directory instead of individual files) — `EEXIST`. OR: conflict detection handles "regular file" case but not "directory exists at target" case, causing unhandled error.
**How to avoid:** Walk `files/` to individual leaf files only (never symlink directories). `fs.mkdir(parentDir, { recursive: true })` handles the case where an intermediate directory already exists as a real dir — it does not throw, it no-ops. The conflict detection applies only to the exact symlink target (a file), not to parent directories.
**Warning signs:** Any code that calls `fs.symlink` on a directory path; missing `recursive: true` on `fs.mkdir`.

### Pitfall 4: Non-Atomic data.json Write Corrupts State on Crash (CRITICAL)
**What goes wrong:** Uninstall removes symlinks, then process crashes before `writeFile` completes. `data.json` is truncated to 0 bytes or malformed. Tool throws JSON parse error on next startup and is unusable.
**How to avoid:** Always use write-to-tmp + `fs.rename` pattern. Always wrap `JSON.parse(fs.readFile(...))` in try/catch; treat parse failure as empty state with a warning.
**Warning signs:** Any `fs.writeFile(dataJsonPath, JSON.stringify(...))` without the tmp+rename indirection.

### Pitfall 5: Two Packages Own the Same Symlink Target
**What goes wrong:** Package A and B both have `files/Makefile`. Both installed. Uninstalling A removes the symlink. B's `data.json` says it's installed but the file is gone.
**How to avoid:** At install time, before creating a symlink, check whether the target path already appears in any other package's `data.json` for this project. Warn and prompt if ownership conflict detected. The per-symlink ownership structure (Pattern 4) is required for this to be detectable.

### Pitfall 6: Walking Package Root Instead of files/ (data.json Gets Symlinked)
**What goes wrong:** File walker targets `<pkg>/` instead of `<pkg>/files/`. `data.json` gets symlinked into the project. Writing state from one project mutates state for all projects.
**How to avoid:** Explicitly use `pkg.filesPath` (i.e., `<pkg>/files/`). Guard: if `files/` subdir doesn't exist inside a discovered package dir, skip it with a warning — do not fall back to the package root.

### Pitfall 7: Real File Overwritten Without Backup (Data Loss)
**What goes wrong:** User has a hand-crafted `.gitignore`. They confirm "overwrite" at the conflict prompt. Tool `unlink`s the real file and creates a symlink. Content is irretrievably gone.
**How to avoid:** Before `fs.unlink` on overwrite, call `fs.rename(target, target + '.clawd-backup')`. Log the backup location to the user.

### Pitfall 8: conf Default Path May Not Match ~/.clawd-linker Spec
**What goes wrong:** `conf` by default stores config in `~/Library/Preferences/clawd-linker/` on macOS — not `~/.clawd-linker`. If the spec requires exactly `~/.clawd-linker`, plain `fs` + atomic write may be clearer than fighting conf's default path resolution.
**How to avoid:** Decide during implementation: either configure `conf` with `cwd: os.homedir()` and `configName: '.clawd-linker'`, OR use plain fs + atomic write pattern. Both work; the important thing is the file lands at `~/.clawd-linker`. [ASSUMED — verify conf's `cwd` + `configName` options before finalizing]

---

## Code Examples

### File Walker (lstat-based, no symlink following)
```javascript
// src/utils/fs.js
// Source: Node.js fs docs + .planning/research/ARCHITECTURE.md
import path from 'path';
import { readdir } from 'fs/promises';

export async function walkFiles(filesPath) {
  const entries = await readdir(filesPath, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => !e.isDirectory() && !e.isSymbolicLink())
    .map(e => path.relative(filesPath, path.join(e.path, e.name)));
  // e.path is the containing directory (Dirent property, Node 20+)
  // e.parentPath is an alias added in Node 20.13 / 21.4 — use e.path for 20.12 compat
}
```

### Symlink with Conflict Detection
```javascript
// src/services/symlink-manager.js
import path from 'path';
import { lstat, readlink, symlink, mkdir, rename } from '../utils/fs.js';

export async function ensureSymlink(source, target, conflictCallback) {
  const absSource = path.resolve(source);
  const absTarget = path.resolve(target);

  await mkdir(path.dirname(absTarget), { recursive: true });

  const stat = await lstat(absTarget).catch(() => null);
  if (stat?.isSymbolicLink()) {
    const existing = await readlink(absTarget);
    if (existing === absSource) return 'no-op';   // idempotent
    // symlink exists but points elsewhere — treat as conflict
  } else if (stat) {
    const action = await conflictCallback(absTarget);   // 'skip' | 'overwrite'
    if (action === 'skip') return 'skipped';
    await rename(absTarget, absTarget + '.clawd-backup');
  }

  await symlink(absSource, absTarget);
  return 'created';
}
```

### Inquirer Checkbox with Pre-Checked Items
```javascript
// src/commands/manage.js
// Source: @inquirer/prompts API [ASSUMED from training knowledge]
import { checkbox } from '@inquirer/prompts';

const selected = await checkbox({
  message: 'Select packages to install',
  choices: packages.map(pkg => ({
    name: pkg.name,
    value: pkg.name,
    checked: installedPackageNames.has(pkg.name),
  })),
  pageSize: 15,
});
```

### Commander Subcommand Setup
```javascript
// bin/clawd-linker.js
// Source: commander docs [ASSUMED from training knowledge]
#!/usr/bin/env node
import { program } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { newCommand } from '../src/commands/new.js';
import { manageCommand } from '../src/commands/manage.js';

program.name('clawd-linker').version('0.1.0');

program.command('init').description('Create and register a package repository').action(initCommand);
program.command('new <name>').description('Scaffold a new package in the repository').action(newCommand);
program.command('manage').alias('m').description('Manage installed packages for this project').action(manageCommand);

program.parse();
```

### Global Config (startup validation pattern)
```javascript
// src/config.js — startup guard for CFG-02
import { access, readFile, writeFile, rename } from './utils/fs.js';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CONFIG_PATH = path.join(os.homedir(), '.clawd-linker');

export async function getRepoPath() {
  let raw;
  try {
    raw = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch {
    console.error(chalk.red('No package repository configured. Run `clawd-linker init` first.'));
    process.exit(1);
  }
  try {
    await access(raw.repoPath);
  } catch {
    console.error(chalk.red(`Package repo not found at ${raw.repoPath}. Run \`clawd-linker init\` to reconfigure.`));
    process.exit(1);
  }
  return raw.repoPath;
}
```

### simple-git Init
```javascript
// src/commands/init.js (partial)
// Source: simple-git docs [ASSUMED from training knowledge]
import simpleGit from 'simple-git';
import { mkdir } from '../utils/fs.js';

async function initRepo(repoPath) {
  await mkdir(repoPath, { recursive: true });
  const git = simpleGit(repoPath);
  await git.init();
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `fs.readdir` returns string[] | `readdir(..., { withFileTypes: true })` returns `Dirent[]` | `.isDirectory()` and `.isSymbolicLink()` without extra `lstat` calls |
| Manual recursion in `readdir` | `readdir(..., { withFileTypes: true, recursive: true })` | Built-in recursive walk since Node 18.17 |
| `fs.exists` (removed) | `fs.access` or `lstat().catch(() => null)` | `exists` was deprecated and removed; `lstat` is the idiomatic replacement |
| Sync fs APIs (`readdirSync`) | `fs/promises` throughout | Async-first; composable with `await`; no event loop blocking |

**Deprecated/outdated:**
- `require('fs').existsSync`: synchronous; doesn't belong in this codebase; use `lstat().catch(() => null)`
- Relative symlink targets: works on POSIX but leads to Pitfall 2; absolute paths only via `path.resolve()`
- `Dirent.parentPath`: Node 21.4+ / 20.13+ alias — use `Dirent.path` for Node 20.12.0 compatibility

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 24.14.0 | — |
| npm | Package install | Yes | 11.9.0 | — |
| git | INIT-01 (simple-git calls it) | Yes | 2.50.1 (Apple Git) | — |

**Missing dependencies with no fallback:** None.

All runtime dependencies are npm packages. All filesystem operations use Node.js built-ins. No external services, databases, or non-standard CLIs required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Dirent.path` (not `Dirent.parentPath`) is the correct property for Node 20.12.0 | Code Examples — walkFiles | Walker produces wrong paths; must verify against Node 20 changelog |
| A2 | `conf` can be configured to write to `~/.clawd-linker` (file, not directory) via `cwd` + `configName` options | Pitfall 8, Code Examples | Config written to wrong location; fall back to plain fs + atomic write |
| A3 | `@inquirer/prompts` checkbox API accepts `{ name, value, checked }` shape for pre-checked items | Code Examples | TUI doesn't pre-check installed packages; verify against @inquirer/prompts v8 docs |
| A4 | commander v14 `.alias('m')` syntax is unchanged from v12/v13 | Code Examples | Alias `m` doesn't register; verify against commander v14 changelog |

**If any A-claim is wrong**, the fallback in each case is low-cost: Node docs, conf docs, @inquirer/prompts docs, commander docs are all available. These are fast verifications before implementation begins.

---

## Open Questions (RESOLVED)

1. **conf vs plain fs for `~/.clawd-linker`** — RESOLVED: Use plain fs + atomic write (tmp+rename). `conf` cannot write to an exact file path like `~/.clawd-linker` without writing a directory; it defaults to OS config dirs. Plan 01-01 Task 3 uses plain `fs` with atomic write pattern instead. `conf` is installed but not used for global config.

2. **`Dirent.path` vs `Dirent.parentPath` in Node 20.12.0** — RESOLVED: Use `e.path` (not `e.parentPath`). `parentPath` was added as alias in Node 20.13/21.4; `path` is the correct property for Node 20.12.0 compatibility. Plan 01-01 Task 2 uses `e.path` with an inline comment explaining this.

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`) — verified all 6 package versions 2026-04-08 [VERIFIED: npm registry]
- `.planning/research/PITFALLS.md` — 13 pitfalls with root cause analysis [VERIFIED: codebase]
- `.planning/research/ARCHITECTURE.md` — module structure, data flows, anti-patterns [VERIFIED: codebase]
- `.planning/research/FEATURES.md` — feature landscape, table stakes, anti-features [VERIFIED: codebase]
- CLAUDE.md — locked technology decisions [VERIFIED: codebase]
- `.planning/REQUIREMENTS.md` — all 17 v1 requirements [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Node.js `fs/promises` API (training knowledge, stable API since Node 18; recursive readdir since 18.17)
- GNU Stow / dotbot / chezmoi design patterns (training knowledge; mature tools with stable semantics)

### Tertiary (LOW confidence — A-claims, need pre-implementation verification)
- conf `cwd` + `configName` API for custom file path (A2)
- `@inquirer/prompts` v8 checkbox `checked` option shape (A3)
- commander v14 `.alias()` syntax (A4)
- `Dirent.path` property in Node 20.12.0 recursive readdir (A1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry 2026-04-08
- Architecture: HIGH — derived from existing project research artifacts + well-established Node.js CLI patterns
- Pitfalls: HIGH — derived from detailed existing research; cross-validated with GNU Stow / dotbot patterns
- data.json schema: HIGH — required shape flows directly from STATE-02 and LINK-04 requirements

**Research date:** 2026-04-08
**Valid until:** 2026-06-08 (stable ecosystem; npm package major versions unlikely to change in 60 days)

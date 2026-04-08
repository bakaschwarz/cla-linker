<!-- GSD:project-start source:PROJECT.md -->
## Project

**clawd-linker**

A Node.js CLI tool that manages reusable file packages across multiple projects via symlinks. Packages live in a central git repository; `clawd-linker` lets you select which packages to install in a project and handles creating and removing the symlinks automatically.

**Core Value:** A developer can run `npx clawd-linker manage` in any project and instantly sync the right set of shared files — no manual copying, no drift.

### Constraints

- **Runtime**: Node.js — must work via `npx` without a global install
- **Platform**: macOS-first (symlinks assumed available)
- **Scope**: Personal tool — no auth, no server, no multi-user scenarios
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Runtime and Module Format
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module format | **ESM** (`"type": "module"`) | All shortlisted libraries are ESM-only in their current major versions (`@inquirer/prompts`, `conf`, `execa`, `chalk`, `ora`). Choosing CJS forces downgrading every dependency to an older major — not worth it. |
| Node.js minimum | **>=20.12.0** | Required by `@inquirer/prompts` (most restrictive). Node 20 is Active LTS through April 2026; Node 22 is the new LTS. `npx` will use whatever Node the user has installed — document this requirement in README. |
| Language | **Plain ESM JavaScript** (no TypeScript compile step) | This is a personal tool; adding a build step (`tsup`, `tsc`) just to run `npx clawd-linker` means either shipping a `dist/` or requiring callers to have `tsx` on PATH. Plain ESM avoids that entirely. Use JSDoc `@param` types for IDE autocompletion if desired. |
### CLI Framework
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **commander** | 14.0.3 | 316 M | Argument parsing, subcommand routing, `--help` generation |
- **yargs** — more configuration surface than needed for 3 subcommands; commander is simpler
- **oclif** — designed for large CLI suites with plugins; heavy overkill for a personal tool
- **meow** (Sindre Sorhus) — ESM-only, minimal, but lacks subcommand routing without extra wiring
### Interactive TUI / Prompts
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **@inquirer/prompts** | 8.4.1 | 19.3 M | All interactive prompts: checkbox list, confirm, input |
| **@inquirer/checkbox** | 5.1.3 | (sub-package) | The checkbox prompt specifically |
- Arrow-key navigation
- Space to toggle, Enter to confirm
- Pre-checked items (via `checked: true` on choices)
- Page scrolling for long lists
| Library | Version | Downloads | Why not |
|---------|---------|-----------|---------|
| `@clack/prompts` | 1.2.0 | 8.2 M | Beautiful output but lacks a checkbox/multi-select prompt as of this research — only single-select (`select`) is built-in. |
| legacy `inquirer` | 13.4.1 | 41.5 M | The `latest` tag is the new rewrite that maps to `@inquirer/prompts`; the old API is on the `legacy` dist-tag. Use the scoped packages directly to avoid confusion. |
| `ink` | 7.0.0 | — | React-for-terminal. Powerful but adds React as a runtime dependency. Overkill when `@inquirer/prompts` covers all needed interactions. |
### Config File (Global `~/.clawd-linker`)
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **conf** | 15.1.0 | 3.3 M | Read/write JSON config at `~/.clawd-linker` with atomic writes and schema validation |
### Git Integration
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **simple-git** | 3.35.2 | 10 M | `git init` on new repo, `.gitignore` management |
### Process Execution (for shelling out)
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **execa** | 9.6.1 | 114 M | Run subprocesses if needed beyond simple-git |
### Filesystem Operations
| Operation | API |
|-----------|-----|
| Create symlink | `fs.symlink(target, path)` |
| Remove symlink | `fs.unlink(path)` |
| Read symlink target | `fs.readlink(path)` |
| Check if symlink | `fs.lstat(path)` → check `stats.isSymbolicLink()` |
| Read/write JSON | `fs.readFile` + `JSON.parse` / `JSON.stringify` + `fs.writeFile` |
| Walk directory | `fs.readdir(path, { withFileTypes: true, recursive: true })` (Node 18.17+) |
| Create directory | `fs.mkdir(path, { recursive: true })` |
### Terminal Output Styling
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **chalk** | 5.6.2 | 374 M | Colored terminal output (errors red, success green) |
### Testing
| Library | Version | Weekly Downloads | Purpose |
|---------|---------|-----------------|---------|
| **vitest** | 4.1.3 | 39.8 M | Unit and integration tests |
## Full Dependency List
### Runtime dependencies
| Package | Version Pin | Rationale |
|---------|-------------|-----------|
| `commander` | `^14.0.3` | CLI routing |
| `@inquirer/prompts` | `^8.4.1` | Interactive checkbox + confirm prompts |
| `conf` | `^15.1.0` | Global config at `~/.clawd-linker` |
| `simple-git` | `^3.35.2` | `git init` for new package repos |
| `chalk` | `^5.6.2` | Terminal output color |
### Dev dependencies
| Package | Version Pin | Rationale |
|---------|-------------|-----------|
| `vitest` | `^4.1.3` | Test runner with native ESM support |
### Intentionally omitted
| Package | Reason |
|---------|--------|
| `execa` | Not needed; simple-git covers git; fs built-ins cover the rest |
| `ora` | No long-running async operations in v1 |
| `@types/node` | Project is plain JS, not TypeScript |
| `tsup` / `tsx` | No build step; plain ESM runs directly via `node` |
| `zod` | Config schema is trivial (single field); not worth the dependency |
| `fs-extra` | Node >= 20 built-ins are sufficient |
| `glob` | `fs.readdir` with `recursive: true` is sufficient |
| `ink` | React-in-terminal is overkill for a 3-command tool |
| `@clack/prompts` | No multi-select prompt; missing key feature |
## package.json Structure
## Alternatives Considered (Summary)
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI framework | `commander` | `yargs` | More config overhead for 3 subcommands |
| CLI framework | `commander` | `oclif` | Plugin framework overkill for personal tool |
| Interactive prompts | `@inquirer/prompts` | `@clack/prompts` | Clack lacks multi-select / checkbox prompt |
| Interactive prompts | `@inquirer/prompts` | `ink` | React runtime dependency; overkill |
| Config | `conf` | plain `fs` + JSON | Both valid; `conf` adds atomic writes |
| Git | `simple-git` | `isomorphic-git` | isomorphic-git is for no-git-binary envs (browsers/CI) |
| Git | `simple-git` | shell `execa('git', [...])` | simple-git gives structured errors; reasonable swap if surface stays minimal |
| Filesystem | `fs/promises` (built-in) | `fs-extra` | Node 20 covers everything needed |
| Testing | `vitest` | `jest` | Jest requires ESM transform config; vitest is zero-config for ESM |
| Language | Plain ESM JS | TypeScript | No build step = simpler npx distribution |
## Sources
- npm registry version data: verified via `npm view <package> version` (2026-04-08)
- Download counts: npmjs.com downloads API (`/downloads/point/last-week/<pkg>`), week of 2026-04-01
- Engine requirements: verified via `npm view <package> engines` (2026-04-08)
- Node.js `fs/promises` API coverage: verified by running `typeof fs.symlink` etc. against Node 24.14.0
- `@inquirer/prompts` checkbox feature set: package description and keywords from npm registry
- `conf` ESM-only status: verified via `npm view conf type` → `"module"` (2026-04-08)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

import path from 'path';
import { readdir, lstat } from '../utils/fs.js';

/**
 * @typedef {Object} PackageDescriptor
 * @property {string} name - Package name (directory name)
 * @property {string} path - Absolute path to package root
 * @property {string} filesPath - Absolute path to package's files/ directory
 * @property {string} dataJsonPath - Absolute path to package's data.json
 */

/**
 * List all valid packages in the repository.
 * A valid package is a directory containing a `files/` subdirectory.
 * Skips directories without files/ (with no error — they may be non-package dirs).
 * @param {string} repoPath - Absolute path to the package repository
 * @returns {Promise<PackageDescriptor[]>} Array of package descriptors sorted by name
 */
export async function listPackages(repoPath) {
  const entries = await readdir(repoPath, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const pkgPath = path.join(repoPath, entry.name);
    const filesPath = path.join(pkgPath, 'files');

    // WR-03: access() succeeds on regular files too — use lstat + isDirectory()
    try {
      const st = await lstat(filesPath);
      if (!st.isDirectory()) continue; // exists but is not a directory — skip
    } catch {
      continue; // No files/ subdirectory — skip silently
    }

    packages.push({
      name: entry.name,
      path: pkgPath,
      filesPath,
      dataJsonPath: path.join(pkgPath, 'data.json'),
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

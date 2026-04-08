import path from 'path';
import {
  symlink,
  unlink,
  lstat,
  readlink,
  readdir,
  mkdir,
  writeFile,
  readFile,
  rename,
  access,
  rmdir,
} from 'fs/promises';

export { symlink, unlink, lstat, readlink, readdir, mkdir, writeFile, readFile, rename, access, rmdir };

/**
 * Walk a directory recursively and return relative paths of regular files only.
 * Uses lstat semantics — does NOT follow symlinks (Pitfall 7 prevention).
 * @param {string} dirPath - Absolute path to directory to walk
 * @returns {Promise<string[]>} Relative paths of regular files
 */
export async function walkFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => !e.isDirectory() && !e.isSymbolicLink())
    .map(e => path.relative(dirPath, path.join(e.parentPath ?? e.path, e.name)));
  // e.parentPath added in Node 21.4 (e.path deprecated); fallback for Node 20.12
}

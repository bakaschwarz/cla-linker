import { readdir, lstat } from 'fs/promises';
import path from 'path';
import type { Package } from '../types.js';

export async function listPackages(repoPath: string): Promise<Package[]> {
  const entries = await readdir(repoPath, { withFileTypes: true });
  const packages: Package[] = [];

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

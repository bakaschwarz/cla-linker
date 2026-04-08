import { readdir } from 'fs/promises';
import path from 'path';

export async function walkFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => !e.isDirectory() && !e.isSymbolicLink())
    .map(e => path.relative(dirPath, path.join(e.parentPath, e.name)));
}

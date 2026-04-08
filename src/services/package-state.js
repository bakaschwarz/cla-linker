import { readFile, writeFile, rename } from '../utils/fs.js';

/**
 * Read the state from a package's data.json.
 * Returns empty state on missing/corrupt file (Pitfall 4 resilience).
 * @param {string} dataJsonPath - Absolute path to data.json
 * @returns {Promise<{schemaVersion: number, installedIn: Object.<string, string[]>}>}
 */
export async function readState(dataJsonPath) {
  try {
    const raw = await readFile(dataJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Validate minimum shape
    if (!parsed.installedIn || typeof parsed.installedIn !== 'object') {
      return { schemaVersion: 1, installedIn: {} };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, installedIn: {} };
  }
}

/**
 * Write state to data.json using atomic write pattern (tmp + rename).
 * Prevents truncated JSON on crash (Pitfall 4).
 * @param {string} dataJsonPath - Absolute path to data.json
 * @param {Object} state - State object to write
 */
export async function writeState(dataJsonPath, state) {
  const tmp = dataJsonPath + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await rename(tmp, dataJsonPath);
}

/**
 * Get the set of package names installed in a given project.
 * Reads data.json for each package and checks if projectPath has entries.
 * @param {string} projectPath - Absolute path to the project
 * @param {Array<{name: string, dataJsonPath: string}>} packages - Package descriptors
 * @returns {Promise<Set<string>>} Set of installed package names
 */
export async function getInstalledPackages(projectPath, packages) {
  const installed = new Set();
  for (const pkg of packages) {
    const state = await readState(pkg.dataJsonPath);
    const projectLinks = state.installedIn[projectPath];
    if (projectLinks && projectLinks.length > 0) {
      installed.add(pkg.name);
    }
  }
  return installed;
}

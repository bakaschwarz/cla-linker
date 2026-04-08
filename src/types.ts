export interface Package {
  name: string;
  path: string;
  filesPath: string;
  dataJsonPath: string;
}

export interface PackageState {
  schemaVersion: number;
  installedIn: Record<string, string[]>;
}

export type ConflictAction = 'overwrite' | 'skip';
export type ConflictCallback = (targetPath: string) => Promise<ConflictAction>;

export interface InstallOptions {
  dryRun?: boolean;
}

export interface ManageOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export interface ReconcileResult {
  pruned: number;
}

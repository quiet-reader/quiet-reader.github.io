/** Immutable identifiers from the currently deployed Quiet Reader V2 data contract. */
export const LEGACY_DATABASE = {
  name: "quietbook-v2",
  version: 1,
  store: "items",
  keyPath: "id",
} as const;

export const LEGACY_JSON_BACKUP_FORMAT = "QuietBookBackup" as const;
export type LegacyJsonBackupVersion = 2 | 3;

export interface LegacyJsonBackup {
  format: typeof LEGACY_JSON_BACKUP_FORMAT;
  version: LegacyJsonBackupVersion;
  [key: string]: unknown;
}

export interface BackupArchiveFile {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupManifest {
  format: string;
  version: number;
  files: BackupArchiveFile[];
  [key: string]: unknown;
}
/** Immutable identifiers from the currently deployed Quiet Reader V2/V3 data contract. */
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
  mediaType?: string;
  role?: string;
}

export interface BackupOrigin {
  deviceId: string;
  deviceName: string;
  application: string;
  applicationVersion: string;
  platform: string;
  sessionStartedAt: number;
  installationStartedAt: number;
  dataStartAt?: string;
  dataEndAt?: string;
}

export interface BackupHistoryEntry {
  id: string;
  createdAt: string;
  fingerprint: string;
  deviceId?: string;
  deviceName?: string;
  applicationVersion?: string;
  status?: string;
  [key: string]: unknown;
}

/** V3 archive metadata is optional to retain compatibility with earlier ZIP archives. */
export interface BackupManifest {
  format: string;
  archiveVersion?: number;
  version?: number;
  createdAt?: string;
  fingerprint?: string;
  origin?: BackupOrigin;
  backupHistory?: BackupHistoryEntry[];
  collections?: unknown[];
  counts?: { books?: number; pastes?: number; images?: number };
  checksumAlgorithm?: "SHA-256" | string;
  libraryIndex?: string;
  files: BackupArchiveFile[];
  [key: string]: unknown;
}

export interface BackupLibraryIndex {
  schemaVersion: number;
  createdAt: string;
  books: Array<{ id: string; path: string }>;
  pastes: Array<{ id: string; path: string }>;
  sections?: Record<string, boolean>;
  theme?: string;
  preferences?: Record<string, string | null | undefined>;
}

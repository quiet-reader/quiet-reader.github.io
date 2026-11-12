export const LEGACY_BACKUP_FORMAT = "QuietBookBackup" as const;
export const CURRENT_DATABASE_NAME = "quietbook-v2" as const;
export const CURRENT_OBJECT_STORE = "items" as const;
export interface LegacyJsonBackup { format: typeof LEGACY_BACKUP_FORMAT; version: 2 | 3; books?: unknown[]; pastes?: unknown[]; [key: string]: unknown; }
export interface ArchiveFileEntry { path: string; size: number; sha256: string; }
export interface ArchiveManifest { format: string; version: number; files: ArchiveFileEntry[]; [key: string]: unknown; }

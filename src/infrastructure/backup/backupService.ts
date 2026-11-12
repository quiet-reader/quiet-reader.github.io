import JSZip from "jszip";
import {
  getAllLegacyRecords,
  putLegacyRecords,
  type LegacyLibraryRecord,
} from "@/infrastructure/persistence/legacyDatabase";

const ARCHIVE_FORMAT = "QuietReaderArchive";
const ARCHIVE_VERSION = 1;
const LEGACY_FORMAT = "QuietBookBackup";
const HISTORY_KEY = "qrBackupHistory";
const DEVICE_ID_KEY = "qrDeviceId";
const DEVICE_NAME_KEY = "qrDeviceName";
const INSTALLATION_KEY = "qrInstallationStartedAt";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type JsonRecord = Record<string, unknown>;
type FileEntry = { path: string; size: number; sha256: string; mediaType: string; role: string };
type Selection = { novels: boolean; marks: boolean; progress: boolean; pastes: boolean; appearance: boolean };
type DeviceMetadata = {
  deviceId: string; deviceName: string; application: string; applicationVersion: string;
  platform: string; sessionStartedAt: string; installationStartedAt: string;
  dataStartAt?: string; dataEndAt?: string;
};
type Manifest = {
  format: string; archiveVersion: number; createdAt: string; fingerprint: string;
  origin: DeviceMetadata; backupHistory: JsonRecord[]; collections: JsonRecord[];
  encoding: string; checksumAlgorithm: string; libraryIndex: string;
  counts: { books: number; pastes: number; images: number }; files: FileEntry[];
};
export type BackupRestoreResult = {
  items: LegacyLibraryRecord[];
  theme?: string;
  preferences?: JsonRecord;
  collections: JsonRecord[];
  backupHistory: JsonRecord[];
  metadata: DeviceMetadata | null;
  fingerprint: string | null;
  createdAt: string | null;
};
export type BackupExportResult = { blob: Blob; filename: string; fingerprint: string; createdAt: string };

function clone<T>(value: T): T {
  return structuredClone(value);
}
function safeParse<T>(value: string | null, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function history(): JsonRecord[] {
  return safeParse<JsonRecord[]>(localStorage.getItem(HISTORY_KEY), []);
}
function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function metadata(): DeviceMetadata {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) { deviceId = id(); localStorage.setItem(DEVICE_ID_KEY, deviceId); }
  let installation = Number(localStorage.getItem(INSTALLATION_KEY) ?? 0);
  if (!installation) { installation = Date.now(); localStorage.setItem(INSTALLATION_KEY, String(installation)); }
  return {
    deviceId,
    deviceName: localStorage.getItem(DEVICE_NAME_KEY) || "Unnamed device",
    application: "Quiet Reader",
    applicationVersion: "3",
    platform: navigator.userAgent || "Unknown platform",
    sessionStartedAt: new Date().toISOString(),
    installationStartedAt: new Date(installation).toISOString(),
  };
}
async function digest(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 requires HTTPS or localhost.");
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", input.buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function fromDataUrl(value: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) throw new Error("An embedded image has an invalid data URL.");
  const mime = match[1] || "application/octet-stream";
  if (match[2]) {
    const binary = atob(match[3] ?? "");
    return { mime, bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)) };
  }
  return { mime, bytes: encoder.encode(decodeURIComponent(match[3] ?? "")) };
}
function extension(mime: string): string {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" } as Record<string, string>)[mime] ?? "bin";
}
function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${toBase64(bytes)}`;
}
function collections(): JsonRecord[] {
  return safeParse<JsonRecord[]>(localStorage.getItem("qrCollections"), []);
}
function preferences(): JsonRecord {
  return {
    tagColors: localStorage.getItem("qrTagColors"),
    libraryView: localStorage.getItem("qrLibraryView"),
    librarySort: localStorage.getItem("qrLibrarySort"),
    autoReadHighlight: localStorage.getItem("qrAutoReadHighlight"),
  };
}
async function shaText(value: string): Promise<string> {
  return digest(encoder.encode(value));
}
async function writeJson(zip: JSZip, files: FileEntry[], path: string, value: unknown, role: string) {
  const text = JSON.stringify(value, null, 2);
  const bytes = encoder.encode(text);
  zip.file(path, bytes);
  files.push({ path, size: bytes.byteLength, sha256: await digest(bytes), mediaType: "application/json", role });
}
async function externalize(record: JsonRecord, zip: JSZip, files: FileEntry[], nextAsset: { value: number }): Promise<JsonRecord> {
  const copy = clone(record);
  const addAsset = async (value: string): Promise<JsonRecord> => {
    const asset = fromDataUrl(value);
    const path = `assets/${String(nextAsset.value++).padStart(6, "0")}.${extension(asset.mime)}`;
    zip.file(path, asset.bytes);
    files.push({ path, size: asset.bytes.byteLength, sha256: await digest(asset.bytes), mediaType: asset.mime, role: "image" });
    return { __quietReaderAsset: path, mime: asset.mime };
  };
  if (typeof copy["cover"] === "string" && copy["cover"].startsWith("data:image/")) copy["cover"] = await addAsset(copy["cover"]);
  const chapters = copy["chapters"];
  if (Array.isArray(chapters)) for (const raw of chapters) {
    if (!raw || typeof raw !== "object") continue;
    const chapter = raw as JsonRecord;
    if (!Array.isArray(chapter["images"])) continue;
    for (const rawImage of chapter["images"]) {
      if (!rawImage || typeof rawImage !== "object") continue;
      const image = rawImage as JsonRecord;
      if (typeof image["data"] === "string" && image["data"].startsWith("data:image/")) image["data"] = await addAsset(image["data"]);
    }
  }
  const gallery = copy["gallery"];
  if (gallery && typeof gallery === "object" && Array.isArray((gallery as JsonRecord)["images"])) {
    for (const rawImage of (gallery as JsonRecord)["images"] as unknown[]) {
      if (!rawImage || typeof rawImage !== "object") continue;
      const image = rawImage as JsonRecord;
      if (typeof image["data"] === "string" && image["data"].startsWith("data:image/")) image["data"] = await addAsset(image["data"]);
    }
  }
  return copy;
}

export async function exportBackup(selection: Selection, deviceName?: string): Promise<BackupExportResult> {
  if (!Object.values(selection).some(Boolean)) throw new Error("Select at least one backup category.");
  if (deviceName?.trim()) localStorage.setItem(DEVICE_NAME_KEY, deviceName.trim());
  const device = metadata();
  const all = await getAllLegacyRecords();
  const books = all.filter((item) => item["kind"] === "book");
  const pastes = all.filter((item) => item["kind"] === "paste");
  const zip = new JSZip();
  const files: FileEntry[] = [];
  const bookRefs: Array<{ id: string; path: string }> = [];
  const pasteRefs: Array<{ id: string; path: string }> = [];
  const nextAsset = { value: 1 };
  for (let index = 0; index < books.length; index += 1) {
    const book = books[index];
    if (!book) continue;
    if (!selection.novels && !selection.marks && !selection.progress) continue;
    const copy = selection.novels
      ? await externalize(book as JsonRecord, zip, files, nextAsset)
      : { id: book.id, kind: "book", source: book["source"], title: book["title"], author: book["author"] };
    if (selection.novels && !selection.marks) { delete copy["bookmarks"]; delete copy["highlights"]; }
    else if (selection.marks) {
      copy["bookmarks"] = clone(book["bookmarks"] ?? []);
      copy["highlights"] = clone(book["highlights"] ?? []);
    }
    if (selection.novels && !selection.progress) delete copy["progress"];
    else if (selection.progress && book["progress"]) copy["progress"] = clone(book["progress"]);
    if (selection.progress && Array.isArray(book["readingHistory"])) copy["readingHistory"] = clone(book["readingHistory"].slice(-10));
    const path = `books/book-${String(index + 1).padStart(6, "0")}.json`;
    await writeJson(zip, files, path, copy, "book");
    bookRefs.push({ id: book.id, path });
  }
  if (selection.pastes) for (let index = 0; index < pastes.length; index += 1) {
    const paste = pastes[index];
    if (!paste) continue;
    const path = `pastes/paste-${String(index + 1).padStart(6, "0")}.json`;
    await writeJson(zip, files, path, paste, "paste");
    pasteRefs.push({ id: paste.id, path });
  }
  const prefs = selection.appearance ? preferences() : undefined;
  const theme = selection.appearance ? localStorage.getItem("qbtheme") ?? "default" : undefined;
  const selectedCollections = selection.novels ? collections() : [];
  const createdAt = new Date().toISOString();
  const library = { schemaVersion: 1, createdAt, books: bookRefs, pastes: pasteRefs, sections: selection, theme, preferences: prefs };
  await writeJson(zip, files, "library.json", library, "library-index");
  const fingerprint = await shaText(files.filter((file) => file.role !== "library-index").map((file) => `${file.path} ${file.sha256}`).sort().join("\n") + "\n" + JSON.stringify({ selection, collections: selectedCollections, theme, preferences: prefs }));
  const manifestOrigin = metadata();
  const timestamps = all.flatMap((item) => [item["createdAt"], item["addedAt"]]).map((value) => typeof value === "number" ? value : Date.parse(String(value))).filter(Number.isFinite);
  manifestOrigin.dataStartAt = new Date(timestamps.length ? Math.min(...timestamps) : Date.parse(manifestOrigin.installationStartedAt)).toISOString();
  manifestOrigin.dataEndAt = createdAt;
  const manifest: Manifest = {
    format: ARCHIVE_FORMAT, archiveVersion: ARCHIVE_VERSION, createdAt, fingerprint,
    origin: manifestOrigin, backupHistory: history(), collections: selectedCollections,
    encoding: "UTF-8", checksumAlgorithm: "SHA-256", libraryIndex: "library.json",
    counts: { books: bookRefs.length, pastes: pasteRefs.length, images: files.filter((file) => file.role === "image").length },
    files,
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  const manifestHash = await shaText(manifestText);
  zip.file("manifest.json", manifestText);
  zip.file("checksums.sha256", [...files, { path: "manifest.json", sha256: manifestHash }].map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const safeName = device.deviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "device";
  const stamp = createdAt.replace(/[:.]/g, "-");
  const entry = { id: id(), createdAt, fingerprint, deviceId: device.deviceId, deviceName: device.deviceName, applicationVersion: device.applicationVersion, platform: device.platform, size: blob.size, sizeLabel: `${(blob.size / 1048576).toFixed(2)} MB`, status: "Exported" };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...history(), entry].slice(-100)));
  return { blob, filename: `quiet-reader-${safeName}-${stamp}.zip`, fingerprint, createdAt };
}

function hydrate(value: unknown, assets: Map<string, { mime: string; bytes: Uint8Array }>): unknown {
  if (Array.isArray(value)) return value.map((entry) => hydrate(entry, assets));
  if (!value || typeof value !== "object") return value;
  const object = value as JsonRecord;
  if (typeof object["__quietReaderAsset"] === "string") {
    const asset = assets.get(object["__quietReaderAsset"]);
    if (!asset) throw new Error(`A referenced image is missing: ${object["__quietReaderAsset"]}`);
    return dataUrl(asset.mime, asset.bytes);
  }
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, hydrate(entry, assets)]));
}
function parseLegacy(value: JsonRecord): BackupRestoreResult {
  if (value["format"] !== LEGACY_FORMAT || ![2, 3].includes(Number(value["version"]))) {
    throw new Error("Unsupported legacy Quiet Reader JSON backup. Expected QuietBookBackup version 2 or 3.");
  }
  const raw = value["items"] ?? [...(Array.isArray(value["books"]) ? value["books"] : []), ...(Array.isArray(value["pastes"]) ? value["pastes"] : [])];
  if (!Array.isArray(raw)) throw new Error("The legacy backup has no valid item list.");
  return {
    items: raw as LegacyLibraryRecord[], theme: typeof value["theme"] === "string" ? value["theme"] : undefined,
    preferences: value["preferences"] as JsonRecord | undefined,
    collections: Array.isArray(value["collections"]) ? value["collections"] as JsonRecord[] : [],
    backupHistory: [], metadata: null, fingerprint: null, createdAt: null,
  };
}
export async function parseBackupFile(file: File): Promise<BackupRestoreResult> {
  if (!/\.zip$/i.test(file.name) && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
    const parsed = JSON.parse(await file.text()) as JsonRecord;
    return parseLegacy(parsed);
  }
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("The ZIP does not contain manifest.json.");
  const manifestText = await manifestFile.async("string");
  const manifest = JSON.parse(manifestText) as Manifest;
  if (manifest.format !== ARCHIVE_FORMAT || manifest.archiveVersion !== ARCHIVE_VERSION || manifest.checksumAlgorithm !== "SHA-256" || !Array.isArray(manifest.files)) {
    throw new Error("Unsupported or incomplete Quiet Reader archive.");
  }
  const seen = new Set<string>();
  const verified = new Map<string, Uint8Array>();
  for (const entry of manifest.files) {
    if (!entry.path || entry.path.startsWith("/") || entry.path.split("/").includes("..") || seen.has(entry.path)) {
      throw new Error("The manifest contains an unsafe or duplicate path.");
    }
    seen.add(entry.path);
    const zipEntry = zip.file(entry.path);
    if (!zipEntry) throw new Error(`Required archive file is missing: ${entry.path}`);
    const bytes = await zipEntry.async("uint8array");
    if (bytes.byteLength !== entry.size || await digest(bytes) !== entry.sha256) throw new Error(`Archive verification failed: ${entry.path}`);
    verified.set(entry.path, bytes);
  }
  const checksums = zip.file("checksums.sha256");
  if (!checksums) throw new Error("The checksum list is missing.");
  const checksumText = await checksums.async("string");
  const checksumMap = new Map(checksumText.trim().split(/\r?\n/).map((line) => {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    return match ? [match[2] ?? "", match[1] ?? ""] as const : ["", ""] as const;
  }).filter(([path]) => Boolean(path)));
  if (checksumMap.get("manifest.json") !== await digest(encoder.encode(manifestText))) throw new Error("The manifest checksum does not match.");
  for (const entry of manifest.files) if (checksumMap.get(entry.path) !== entry.sha256) throw new Error(`Checksum list mismatch: ${entry.path}`);
  const indexBytes = verified.get(manifest.libraryIndex || "library.json");
  if (!indexBytes) throw new Error("The library index is missing.");
  const library = JSON.parse(decoder.decode(indexBytes)) as JsonRecord;
  if (library["schemaVersion"] !== 1 || !Array.isArray(library["books"]) || !Array.isArray(library["pastes"])) throw new Error("The library index is invalid.");
  const assets = new Map<string, { mime: string; bytes: Uint8Array }>();
  for (const entry of manifest.files.filter((file) => file.role === "image")) {
    const bytes = verified.get(entry.path);
    if (!bytes) throw new Error(`Missing image asset: ${entry.path}`);
    assets.set(entry.path, { mime: entry.mediaType, bytes });
  }
  const readRef = (ref: unknown, kind: "book" | "paste"): LegacyLibraryRecord => {
    if (!ref || typeof ref !== "object") throw new Error("Invalid library index reference.");
    const itemRef = ref as JsonRecord;
    const bytes = typeof itemRef["path"] === "string" ? verified.get(itemRef["path"]) : undefined;
    if (!bytes) throw new Error("A referenced record is missing from the verified archive.");
    const item = JSON.parse(decoder.decode(bytes)) as JsonRecord;
    if (item["kind"] !== kind || item["id"] !== itemRef["id"] || typeof item["id"] !== "string") throw new Error("A record does not match its library index reference.");
    return hydrate(item, assets) as LegacyLibraryRecord;
  };
  const books = (library["books"] as unknown[]).map((ref) => readRef(ref, "book"));
  const pastes = (library["pastes"] as unknown[]).map((ref) => readRef(ref, "paste"));
  return {
    items: [...books, ...pastes],
    theme: typeof library["theme"] === "string" ? library["theme"] : undefined,
    preferences: library["preferences"] as JsonRecord | undefined,
    collections: Array.isArray(manifest.collections) ? manifest.collections : [],
    backupHistory: Array.isArray(manifest.backupHistory) ? manifest.backupHistory : [],
    metadata: manifest.origin ?? null,
    fingerprint: manifest.fingerprint ?? null,
    createdAt: manifest.createdAt ?? null,
  };
}

export async function restoreBackupFile(file: File): Promise<{ books: number; pastes: number }> {
  const restored = await parseBackupFile(file);
  if (restored.items.some((item) => !item || typeof item.id !== "string" || !["book", "paste"].includes(String(item["kind"])))) {
    throw new Error("The backup contains an invalid book or paste record.");
  }
  const unique = new Set<string>();
  for (const item of restored.items) {
    if (unique.has(item.id)) throw new Error(`Duplicate record ID in backup: ${item.id}`);
    unique.add(item.id);
  }
  // The full archive is validated before this single atomic IndexedDB transaction.
  await putLegacyRecords(restored.items);
  if (restored.theme) localStorage.setItem("qbtheme", restored.theme);
  const preferenceKeys: Record<string, string> = {
    tagColors: "qrTagColors", libraryView: "qrLibraryView", librarySort: "qrLibrarySort", autoReadHighlight: "qrAutoReadHighlight",
  };
  for (const [key, storageKey] of Object.entries(preferenceKeys)) {
    const value = restored.preferences?.[key];
    if (typeof value === "string") localStorage.setItem(storageKey, value);
  }
  if (restored.collections.length) {
    const existing = collections();
    const merged = new Map([...existing, ...restored.collections].map((collection) => [String(collection["id"] ?? collection["name"]), collection]));
    localStorage.setItem("qrCollections", JSON.stringify([...merged.values()]));
  }
  const mergedHistory = new Map([...history(), ...restored.backupHistory].map((entry) => [String(entry["id"] ?? entry["fingerprint"]), entry]));
  if (restored.fingerprint) mergedHistory.set(`import-${restored.fingerprint}-${Date.now()}`, {
    id: id(), createdAt: restored.createdAt ?? new Date().toISOString(), fingerprint: restored.fingerprint,
    deviceId: restored.metadata?.deviceId ?? "unknown", deviceName: restored.metadata?.deviceName ?? "Imported backup",
    applicationVersion: restored.metadata?.applicationVersion ?? "Unknown", platform: restored.metadata?.platform ?? "Unknown",
    status: "Imported",
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...mergedHistory.values()].slice(-100)));
  return { books: restored.items.filter((item) => item["kind"] === "book").length, pastes: restored.items.filter((item) => item["kind"] === "paste").length };
}

export function getBackupHistory(): JsonRecord[] { return history(); }
export function getBackupDeviceName(): string { return localStorage.getItem(DEVICE_NAME_KEY) || "Unnamed device"; }

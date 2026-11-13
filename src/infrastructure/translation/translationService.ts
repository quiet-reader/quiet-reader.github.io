export type TranslationProvider = "googleFree" | "google" | "deepl" | "libre" | "omni";

export interface TranslationSource {
  id: string;
  type: TranslationProvider;
  name: string;
  endpoint?: string;
  apiKey?: string;
  defaultTarget: string;
}

const STORAGE_KEY = "qrTranslationSources";

export function loadTranslationSources(storage: Pick<Storage, "getItem"> = localStorage): TranslationSource[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TranslationSource =>
      Boolean(item) && typeof item === "object" &&
      typeof item.id === "string" && typeof item.name === "string" &&
      ["googleFree", "google", "deepl", "libre", "omni"].includes(String(item.type)) &&
      typeof item.defaultTarget === "string"
    );
  } catch {
    return [];
  }
}

export function saveTranslationSources(sources: TranslationSource[], storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(sources));
}

export function upsertTranslationSource(sources: TranslationSource[], source: TranslationSource): TranslationSource[] {
  const index = sources.findIndex((item) => item.id === source.id);
  if (index < 0) return [...sources, source];
  return sources.map((item, itemIndex) => itemIndex === index ? source : item);
}

export function removeTranslationSource(sources: TranslationSource[], id: string): TranslationSource[] {
  return sources.filter((source) => source.id !== id);
}

function decodeHtmlEntities(value: string): string {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

type JsonRecord = Record<string, unknown>;
function asRecord(value: unknown): JsonRecord { return value && typeof value === "object" ? value as JsonRecord : {}; }
function nested(value: unknown, key: string): unknown { return asRecord(value)[key]; }

async function readJson(response: Response): Promise<JsonRecord> {
  const raw = await response.text();
  let data: JsonRecord;
  try { data = asRecord(JSON.parse(raw)); }
  catch { throw new Error("The translation provider returned an unreadable response."); }
  if (!response.ok) { const error = asRecord(data["error"]); throw new Error(String(error["message"] ?? data["message"] ?? data["detail"] ?? data["error"] ?? `Translation request failed (HTTP ${response.status}).`)); }
  return data;
}

/** Sends a complete chapter in one request so paragraph context is not lost. */
export async function translateChapter(
  source: TranslationSource,
  text: string,
  target = source.defaultTarget,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!text.trim()) throw new Error("There is no chapter text to translate.");
  const count = [...text].length;
  if (source.type === "omni") throw new Error("This source uses manual translation. Paste the translated chapter into the result field.");
  if (source.type === "googleFree") {
    const params = new URLSearchParams({ client: "gtx", sl: "auto", tl: target, dt: "t", q: text });
    let response: Response;
    try {
      response = await fetcher("https://translate.googleapis.com/translate_a/single", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: params.toString(), credentials: "omit",
      });
    } catch {
      throw new Error("Google Translate Free could not be reached. The unofficial endpoint may be blocked or rate-limited.");
    }
    const raw = await response.text();
    if (!response.ok) throw new Error(`Google Translate Free rejected the request (HTTP ${response.status}).`);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new Error("Google Translate Free returned an unreadable response."); }
    const rows = Array.isArray(data) ? data[0] : undefined;
    const result = Array.isArray(rows) ? rows.map((part) => Array.isArray(part) ? String(part[0] ?? "") : "").join("") : "";
    if (!result) throw new Error("Google Translate Free returned no translated text.");
    return result;
  }
  if (source.type === "google") {
    if (!source.apiKey?.trim()) throw new Error("Add your Google Cloud Translation API key in Translation settings.");
    if (count > 30_000) throw new Error("This chapter exceeds Google Cloud Translation's 30,000-character request limit.");
    const response = await fetcher(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(source.apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target, format: "text" }),
    });
    const data = await readJson(response);
    const googleData = asRecord(data["data"]);
    const translations = googleData["translations"];
    const translated = Array.isArray(translations) ? nested(translations[0], "translatedText") : undefined;
    if (typeof translated !== "string" || !translated) throw new Error("Google returned no translated text.");
    return decodeHtmlEntities(translated);
  }
  if (source.type === "deepl") {
    if (!source.apiKey?.trim()) throw new Error("Add your DeepL API key in Translation settings.");
    if (count > 128_000) throw new Error("This chapter exceeds DeepL's 128,000-character request limit.");
    const response = await fetcher(source.endpoint?.trim() || "https://api-free.deepl.com/v2/translate", {
      method: "POST", headers: { Authorization: `DeepL-Auth-Key ${source.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], target_lang: target.toUpperCase() }),
    });
    const data = await readJson(response);
    const translations = data["translations"];
    const translated = Array.isArray(translations) ? nested(translations[0], "text") : undefined;
    if (typeof translated !== "string" || !translated) throw new Error("DeepL returned no translated text.");
    return translated;
  }
  const endpoint = source.endpoint?.replace(/\/$/, "");
  if (!endpoint) throw new Error("Set the LibreTranslate server endpoint.");
  const response = await fetcher(`${endpoint}/translate`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(source.apiKey ? { Authorization: `Bearer ${source.apiKey}` } : {}) },
    body: JSON.stringify({ q: text, source: "auto", target, format: "text", ...(source.apiKey ? { api_key: source.apiKey } : {}) }),
  });
  const data = await readJson(response);
  const translated = data["translatedText"];
  if (typeof translated !== "string" || !translated) throw new Error("LibreTranslate returned no translated text.");
  return translated;
}

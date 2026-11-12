import { describe, expect, it, vi } from "vitest";
import {
  loadTranslationSources, removeTranslationSource, saveTranslationSources,
  translateChapter, upsertTranslationSource, type TranslationSource,
} from "./translationService";

const source: TranslationSource = {
  id: "local", type: "libre", name: "Local LibreTranslate",
  endpoint: "http://localhost:5000", defaultTarget: "en",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("translation source settings", () => {
  it("round-trips settings in browser-local storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    saveTranslationSources([source], storage);
    expect(loadTranslationSources(storage)).toEqual([source]);
  });

  it("upserts by id and removes only the requested source", () => {
    const changed = { ...source, name: "Updated" };
    expect(upsertTranslationSource([source], changed)).toEqual([changed]);
    expect(removeTranslationSource([source, { ...source, id: "other" }], "local")).toHaveLength(1);
  });

  it("ignores malformed stored settings", () => {
    expect(loadTranslationSources({ getItem: () => "{broken" })).toEqual([]);
    expect(loadTranslationSources({ getItem: () => JSON.stringify([{ id: 2 }]) })).toEqual([]);
  });
});

describe("translateChapter", () => {
  it("posts the whole chapter to LibreTranslate and returns its result", async () => {
    const fetcher = vi.fn(async () => response({ translatedText: "translated chapter" }));
    await expect(translateChapter(source, "A complete chapter", "en", fetcher)).resolves.toBe("translated chapter");
    expect(fetcher).toHaveBeenCalledWith("http://localhost:5000/translate", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ q: "A complete chapter", source: "auto", target: "en", format: "text" }),
    }));
  });

  it("uses a form-encoded POST for the unofficial Google endpoint", async () => {
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_input, init) => { calls.push(init ?? {}); return new Response(JSON.stringify([[["你好", "hello"]]]), { status: 200 }); };
    const result = await translateChapter({ ...source, type: "googleFree" }, "hello", "zh-CN", fetcher);
    expect(result).toBe("你好");
    expect(calls[0]?.method).toBe("POST");
  });

  it("rejects empty text, missing endpoints, and manual providers", async () => {
    await expect(translateChapter(source, "  ")).rejects.toThrow("no chapter text");
    await expect(translateChapter({ ...source, endpoint: "" }, "hello")).rejects.toThrow("endpoint");
    await expect(translateChapter({ ...source, type: "omni" }, "hello")).rejects.toThrow("manual");
  });

  it("surfaces provider errors rather than returning an empty translation", async () => {
    const fetcher = vi.fn(async () => response({ error: "rate limited" }, 429));
    await expect(translateChapter(source, "hello", "en", fetcher)).rejects.toThrow("rate limited");
  });
});

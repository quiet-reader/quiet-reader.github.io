import { useMemo, useState } from "react";
import {
  loadTranslationSources, removeTranslationSource, saveTranslationSources,
  translateChapter, upsertTranslationSource, type TranslationProvider, type TranslationSource,
} from "@/infrastructure/translation/translationService";

const providerNames: Record<TranslationProvider, string> = {
  googleFree: "Google Translate (free, unofficial)",
  google: "Google Cloud Translation API",
  deepl: "DeepL API",
  libre: "LibreTranslate / local server",
  omni: "OmniTranslate (manual handoff)",
};

function makeSource(): TranslationSource {
  return { id: globalThis.crypto?.randomUUID?.() ?? `translation-${Date.now()}`, type: "googleFree", name: "Google Translate Free", defaultTarget: "en" };
}

export function TranslationPanel({ chapterText }: { chapterText: string }) {
  const [sources, setSources] = useState<TranslationSource[]>(() => loadTranslationSources());
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<TranslationSource | null>(null);
  const [target, setTarget] = useState("en");
  const [translated, setTranslated] = useState("");
  const [manualText, setManualText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => sources.find((source) => source.id === selectedId) ?? sources[0], [sources, selectedId]);

  function persist(next: TranslationSource[]) {
    setSources(next);
    saveTranslationSources(next);
  }

  function saveEditor() {
    if (!editing?.name.trim()) { setMessage("Enter a source name."); return; }
    if (editing.type === "libre" && !editing.endpoint?.trim()) { setMessage("Enter the LibreTranslate endpoint."); return; }
    const next = upsertTranslationSource(sources, { ...editing, name: editing.name.trim(), defaultTarget: editing.defaultTarget.trim() || "en" });
    persist(next);
    setSelectedId(editing.id);
    setTarget(editing.defaultTarget.trim() || "en");
    setEditing(null);
    setMessage("Translation source saved in this browser.");
  }

  async function runTranslation() {
    if (!selected) { setMessage("Create a translation source first."); return; }
    setBusy(true); setMessage("Translating the complete chapter…");
    try {
      if (selected.type === "omni") {
        setMessage("Paste the translated chapter below to apply it.");
        return;
      }
      const result = await translateChapter(selected, chapterText, target || selected.defaultTarget);
      setTranslated(result);
      setMessage("Translation complete. The original chapter has not been changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Translation failed.");
    } finally { setBusy(false); }
  }

  function saveManualTranslation() {
    if (!manualText.trim()) { setMessage("Paste the translated chapter first."); return; }
    setTranslated(manualText);
    setMessage("Manual translation applied. The original chapter has not been changed.");
  }

  return (
    <section className="translation-panel" aria-label="Chapter translation">
      <div className="translation-panel-heading"><h2>Translate chapter</h2><span>Original text stays unchanged</span></div>
      {editing ? (
        <div className="translation-source-editor">
          <label>Source name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>Provider<select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as TranslationProvider })}>{Object.entries(providerNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {(editing.type === "libre" || editing.type === "deepl") && <label>API endpoint<input value={editing.endpoint ?? ""} onChange={(event) => setEditing({ ...editing, endpoint: event.target.value })} placeholder={editing.type === "deepl" ? "https://api-free.deepl.com/v2/translate" : "http://localhost:5000"} /></label>}
          {editing.type !== "googleFree" && editing.type !== "omni" && <label>API key<input type="password" autoComplete="off" value={editing.apiKey ?? ""} onChange={(event) => setEditing({ ...editing, apiKey: event.target.value })} /></label>}
          <label>Default target language<input value={editing.defaultTarget} onChange={(event) => setEditing({ ...editing, defaultTarget: event.target.value })} placeholder="en, zh-CN, ja…" /></label>
          <p className="translation-warning">Provider keys are stored in this browser and sent directly to the selected provider. Use a local service if you do not want a third party key stored here.</p>
          <div className="translation-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="button" onClick={saveEditor}>Save source</button></div>
        </div>
      ) : (
        <>
          <div className="translation-controls">
            <label>Translation source<select value={selected?.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); const item = sources.find((source) => source.id === event.target.value); if (item) setTarget(item.defaultTarget); }}><option value="">Choose a source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} · {providerNames[source.type]}</option>)}</select></label>
            <label>Target language<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="en, zh-CN, ja…" /></label>
          </div>
          <div className="translation-actions"><button type="button" onClick={() => setEditing(makeSource())}>Add source</button>{selected && <button type="button" onClick={() => setEditing(selected)}>Edit source</button>}{selected && <button type="button" onClick={() => { const next = removeTranslationSource(sources, selected.id); persist(next); setSelectedId(next[0]?.id ?? ""); setTranslated(""); }}>Delete source</button>}<button type="button" disabled={busy || !chapterText.trim() || !selected} onClick={() => void runTranslation()}>{busy ? "Translating…" : "Translate entire chapter"}</button></div>
          {selected?.type === "omni" && <label>Paste translated chapter<textarea rows={6} value={manualText} onChange={(event) => setManualText(event.target.value)} /><button type="button" onClick={saveManualTranslation}>Apply pasted translation</button></label>}
        </>
      )}
      {message && <p className="translation-status" role="status">{message}</p>}
      {translated && <div className="translation-result"><div className="translation-panel-heading"><h3>Translated chapter</h3><button type="button" onClick={() => { setTranslated(""); setMessage("Showing the original chapter again."); }}>Restore original</button></div><pre>{translated}</pre><button type="button" onClick={() => void navigator.clipboard.writeText(translated).then(() => setMessage("Translated chapter copied."), () => setMessage("Clipboard access is unavailable."))}>Copy translation</button></div>}
    </section>
  );
}

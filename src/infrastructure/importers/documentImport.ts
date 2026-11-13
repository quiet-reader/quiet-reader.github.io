import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { freshBook } from "@/domain/book/factory";
import { putLegacyRecord, type LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ChapterImage = { id: string; data: string; caption?: string };
type ImportedBook = LegacyLibraryRecord & {
  kind: string; source: string; title: string; author?: string; cover?: string;
  chapters: Array<{ id: string; title: string; text: string; images: ChapterImage[]; createdAt: number; updatedAt: number; history: unknown[] }>;
};
const id = () => globalThis.crypto?.randomUUID?.() ?? `chapter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
};
function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}
function resolveZipPath(base: string, href: string): string {
  const url = new URL(href, `https://epub.invalid/${base}`);
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}
function extractText(node: Element, images: ChapterImage[], zip: JSZip, base: string): Promise<string> {
  const walk = async (element: Node): Promise<string> => {
    if (element.nodeType === Node.TEXT_NODE) return element.textContent ?? "";
    if (element.nodeType !== Node.ELEMENT_NODE) return "";
    const current = element as Element;
    if (current.tagName.toLowerCase() === "img") {
      const src = current.getAttribute("src");
      if (!src) return "";
      const path = resolveZipPath(base, src);
      const file = zip.file(path);
      if (!file) return "";
      const bytes = await file.async("uint8array");
      const extension = path.split(".").pop()?.toLowerCase() ?? "";
      const imageId = id();
      images.push({ id: imageId, data: dataUrl(bytes, mimeByExtension[extension] ?? "application/octet-stream"), caption: current.getAttribute("alt") ?? "" });
      return `[IMAGE:${imageId}]`;
    }
    const children = Array.from(current.childNodes);
    const parts: string[] = [];
    for (const child of children) parts.push(await walk(child));
    const content = parts.join("");
    return ["p", "div", "blockquote", "li", "h1", "h2", "h3", "h4", "h5", "h6", "br"].includes(current.tagName.toLowerCase())
      ? `\n${content.trim()}\n` : content;
  };
  return walk(node);
}
export async function importEpub(file: File): Promise<ImportedBook> {
  const zip = await JSZip.loadAsync(file);
  const container = zip.file("META-INF/container.xml");
  if (!container) throw new Error("This EPUB is missing META-INF/container.xml.");
  const containerDoc = new DOMParser().parseFromString(await container.async("string"), "application/xml");
  const rootfile = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
  if (!rootfile) throw new Error("The EPUB package document could not be located.");
  const opfFile = zip.file(rootfile);
  if (!opfFile) throw new Error("The EPUB package document is missing.");
  const opfText = await opfFile.async("string");
  const opf = new DOMParser().parseFromString(opfText, "application/xml");
  const base = rootfile.includes("/") ? rootfile.slice(0, rootfile.lastIndexOf("/") + 1) : "";
  const title = opf.getElementsByTagNameNS("*", "title")[0]?.textContent?.trim() || file.name.replace(/\.epub$/i, "") || "Imported EPUB";
  const author = opf.getElementsByTagNameNS("*", "creator")[0]?.textContent?.trim() || "";
  const manifest = new Map<string, Element>();
  for (const item of Array.from(opf.querySelectorAll("manifest > item"))) {
    const itemId = item.getAttribute("id");
    if (itemId) manifest.set(itemId, item);
  }
  const book = freshBook("epub", title) as unknown as ImportedBook;
  book.author = author;
  const coverItem = Array.from(manifest.values()).find((item) => item.getAttribute("properties")?.split(/\s+/).includes("cover-image"));
  if (coverItem) {
    const coverPath = resolveZipPath(base, coverItem.getAttribute("href") ?? "");
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      const bytes = await coverFile.async("uint8array");
      const mime = coverItem.getAttribute("media-type") || mimeByExtension[coverPath.split(".").pop()?.toLowerCase() ?? ""] || "image/jpeg";
      book.cover = dataUrl(bytes, mime);
    }
  }
  const spine = Array.from(opf.querySelectorAll("spine > itemref"));
  for (const reference of spine) {
    const item = manifest.get(reference.getAttribute("idref") ?? "");
    const href = item?.getAttribute("href");
    if (!href || !item) continue;
    const path = resolveZipPath(base, href);
    const chapterFile = zip.file(path);
    if (!chapterFile) continue;
    const html = new DOMParser().parseFromString(await chapterFile.async("string"), "text/html");
    html.querySelectorAll("script,style,nav,header,footer").forEach((element) => element.remove());
    const contentRoot = html.body ?? html.documentElement;
    const images: ChapterImage[] = [];
    const extracted = await extractText(contentRoot, images, zip, path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "");
    const text = extracted.replace(/\n{3,}/g, "\n\n").trim();
    if (!text) continue;
    const now = Date.now();
    book.chapters.push({
      id: id(),
      title: contentRoot.querySelector("h1,h2,h3")?.textContent?.trim() || `Chapter ${book.chapters.length + 1}`,
      text, images, createdAt: now, updatedAt: now, history: [],
    });
  }
  if (!book.chapters.length) throw new Error("No readable chapter text was found in this EPUB.");
  return book;
}
export async function importPdf(file: File): Promise<ImportedBook> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = "";
    let previousY: number | null = null;
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str) continue;
      const y = raw.transform?.[5];
      if (previousY !== null && typeof y === "number" && Math.abs(y - previousY) > 2) text += "\n";
      else if (text && !text.endsWith("\n")) text += " ";
      text += raw.str;
      if (typeof y === "number") previousY = y;
    }
    pages.push(text.trim());
  }
  const extracted = pages.filter(Boolean).join("\n\n");
  if (!extracted) throw new Error("No selectable text was found. This PDF may be scanned or image-only.");
  const book = freshBook("pdf", file.name.replace(/\.pdf$/i, "") || "Imported PDF") as unknown as ImportedBook;
  const now = Date.now();
  book.chapters = [{ id: id(), title: "Document", text: extracted, images: [], createdAt: now, updatedAt: now, history: [] }];
  return book;
}
export async function persistImportedBook(book: ImportedBook): Promise<void> {
  await putLegacyRecord(book);
}

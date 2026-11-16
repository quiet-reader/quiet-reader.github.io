import type { LegacyItemRepository, LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

export interface GalleryImage {
  id: string;
  src: string;
  caption?: string;
  addedAt: number;
  [field: string]: unknown;
}
interface BookWithGallery extends LegacyLibraryRecord {
  gallery?: { images?: GalleryImage[]; [field: string]: unknown };
  updated?: number;
  [field: string]: unknown;
}

/** Per-novel gallery operations that preserve other legacy book fields and gallery metadata. */
export function createGalleryEngine(repository: LegacyItemRepository<BookWithGallery>) {
  return {
    async addImage(bookId: string, src: string, caption = ""): Promise<GalleryImage> {
      const book = await repository.get(bookId);
      if (!book) throw new Error("Novel not found.");
      const image: GalleryImage = { id: globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}`, src, caption, addedAt: Date.now() };
      const gallery = book.gallery ?? {};
      await repository.save({ ...book, gallery: { ...gallery, images: [...(gallery.images ?? []), image] }, updated: Date.now() });
      return image;
    },
    async removeImage(bookId: string, imageId: string): Promise<void> {
      const book = await repository.get(bookId);
      if (!book) throw new Error("Novel not found.");
      const gallery = book.gallery ?? {};
      await repository.save({ ...book, gallery: { ...gallery, images: (gallery.images ?? []).filter((image) => image.id !== imageId) }, updated: Date.now() });
    },
    async list(bookId: string): Promise<GalleryImage[]> {
      const book = await repository.get(bookId);
      return book?.gallery?.images ?? [];
    },
  };
}

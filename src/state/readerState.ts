/** Reader navigation state; persisted progress remains on the book record. */
export interface ReaderState {
  chapter: number;
}
export const initialReaderState: ReaderState = { chapter: 0 };

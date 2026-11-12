/** Uncommitted editor state; pending images are not persisted until save. */
export interface EditorState {
  editIndex: number | null;
  pendingImages: File[];
}
export const initialEditorState: EditorState = { editIndex: null, pendingImages: [] };

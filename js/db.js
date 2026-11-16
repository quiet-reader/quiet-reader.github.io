// Backward-compatible facade for existing feature modules.
// New application code should depend on the persistence adapter contract instead.
export {
  openItemDatabase as openDB,
  put,
  remove,
  putMany,
  getAll
} from './infrastructure/persistence/item-repository.js';

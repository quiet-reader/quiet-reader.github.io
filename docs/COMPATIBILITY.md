# Data compatibility contract

## Existing IndexedDB

The current application uses:

- Database: `quietbook-v2`
- Version: `1`
- Object store: `items`
- Key path: `id`

Existing records include novels, EPUB/PDF items, galleries, saved pasted chapters, nested chapters, image data, notes, tags, locks, bookmarks, highlights, progress, reading/editing history and relationships. Some assets remain embedded as data URLs. This is not a complete schema description; inspect the source before touching any record shape.

## Preservation rules

- Never delete, recreate, clear, or casually upgrade the existing database.
- Never drop unknown fields when editing a record.
- Preserve IDs, ordering, chapter index meaning, references, timestamps, image identity and lock semantics.
- Never replace an existing record with a default object because a field is absent.
- No schema migration as a side effect of opening the app.
- Do not split embedded image data into a new store until a separately reviewed migration and rollback strategy exists.

## Backup compatibility

The source supports a ZIP archive with `manifest.json`, `library.json`, individual book/paste JSON records, binary assets and SHA-256 checksums. Restore validates integrity before writing records and performs book/paste writes in one IndexedDB transaction. Restore is additive/upserting by record ID and retains unrelated local records.

Legacy `QuietBookBackup` JSON versions 2 and 3 remain importable.

Tests must cover valid and corrupt checksums, missing files/assets, duplicate IDs, existing IDs, unrelated records, partial archives, transaction failures and round-trip fidelity. Do not expose an import UI until these checks pass.

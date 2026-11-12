# Compatibility contract

Source: `quiet-reader/quiet-reader-webapp`, branch `V2-feature`, commit `755bdd2f345c5ad5da2aaab0e8dbb940da70a691`.

## IndexedDB
- Database `quietbook-v2`, version 1.
- Object store `items`, key path `id`.
- Existing records are authoritative. Do not upgrade, delete, recreate, normalize or rewrite records on app startup.

## Backup formats
- ZIP `quiet-reader-backup.zip`: `manifest.json`, `library.json`, individual book/paste JSON records, extracted image assets, and `checksums.sha256`.
- Legacy JSON format `QuietBookBackup`, versions 2 and 3.
- Restore is additive/upserting by record ID; unrelated local records remain.
- Verify every listed payload, byte length and SHA-256 digest before writing. Book and paste writes must be atomic in one IndexedDB transaction.

A parser passing is not a restore passing. Test corrupt checksums, missing assets, duplicate IDs, partial archives, existing IDs, unrelated records and transaction failures before enabling import in this port.

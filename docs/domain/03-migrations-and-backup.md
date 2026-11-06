# Data Migration & Backup Strategy

## Schema migrations (Dexie versions)

- The schema lives in `src/infrastructure/db.ts` behind `this.version(1).stores({...})`.
- A migration is a **new version block**, never an edit of an existing one:

  ```ts
  this.version(1).stores({ ... });               // frozen
  this.version(2).stores({ ... }).upgrade((tx) => {
    return tx.table("transactions").toCollection().modify((row) => { ... });
  });
  ```

- Rules:
  - Never drop or rename an index that historical sync clients may rely on
    without a tombstone plan (ADR-003).
  - Upgrades must be idempotent and row-local; they run inside one Dexie
    transaction and are aborted atomically on failure.
  - Every row keeps `id` (client ULID), `createdAt`, `updatedAt` — migrations
    add fields, they never regenerate identity.

## Backup / export format

`src/application/backup.ts` produces a **versioned envelope**:

```json
{
  "app": "couple-finance-control",
  "version": 1,
  "exportedAt": "2026-…",
  "tables": { "households": [...], "transactions": [...], ... }
}
```

- `version` is the compatibility contract: an importer may accept `version: 1`
  today and must *explicitly* map older versions forward — never guess.
- Restore is all-or-nothing: validation runs first, then every table is cleared
  and re-inserted inside a single read-write transaction.
- Rows are stored exactly as persisted (integer cents, plain string ids), so a
  backup is a faithful snapshot of the local database — including history that
  must stay immutable (loan payments, settled statements).

## Recovery

- **Reset demo data** deletes the database; the `populate` hook reseeds the
  fictional household on next open.
- **Clear all data** wipes every financial table — accounts, transactions,
  cards, purchases, plans, loans, loan payments, PIX keys and contacts — inside
  a single transaction, keeping the household, its members and the category
  dictionary. It never deletes the database, so the demo seed does not run. It
  also flips the household's optional `demo` flag to `false` (a non-indexed
  field, so no schema version bump), which is what the shell reads to stop
  labelling the ledger as fictional; rows written before the flag existed read
  as `true`.
- **Import backup** replaces local data with a snapshot — the intended path
  before/after clearing browser storage or moving devices, until the sync
  layer (ADR-003) exists.

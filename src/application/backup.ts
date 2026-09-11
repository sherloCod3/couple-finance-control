/**
 * Backup / export strategy (hardening checklist).
 * The envelope is versioned so future schema migrations can accept older
 * backups explicitly (see docs/domain/03-migrations-and-backup.md).
 */
import { db } from "../infrastructure/db";
import { DomainError } from "../domain/models/money";

export interface BackupEnvelope {
  app: "couple-finance-control";
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

const TABLES = [
  "households",
  "members",
  "accounts",
  "categories",
  "contacts",
  "pixKeys",
  "transactions",
  "cards",
  "cardPurchases",
  "recurrings",
  "loans",
  "loanPayments",
] as const;

export async function exportBackup(): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  const envelope: BackupEnvelope = {
    app: "couple-finance-control",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Validate + restore atomically. Returns the number of rows restored. */
export async function importBackup(json: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DomainError("Invalid JSON.");
  }
  const env = parsed as Partial<BackupEnvelope> | null;
  if (
    !env ||
    env.app !== "couple-finance-control" ||
    env.version !== 1 ||
    typeof env.tables !== "object" ||
    env.tables === null
  ) {
    throw new DomainError("Unrecognized backup format.");
  }
  const tables = env.tables as Record<string, unknown[]>;
  for (const name of TABLES) {
    const rows = tables[name];
    if (rows !== undefined && (!Array.isArray(rows) || rows.some((r) => typeof r !== "object" || r === null))) {
      throw new DomainError("Unrecognized backup format.");
    }
  }

  // Deep row-shape guard (runs BEFORE the destructive clear): every row must
  // carry a non-empty string id and integer-cent amounts where the schema
  // requires them, otherwise a well-formed envelope could corrupt the store.
  const isId = (v: unknown): boolean => typeof v === "string" && v.length > 0;
  const isCents = (v: unknown): boolean => typeof v === "number" && Number.isSafeInteger(v);
  const isOptCents = (v: unknown): boolean => v === null || isCents(v);
  const check = (table: string, rows: unknown[], ok: (r: Record<string, unknown>) => boolean): void => {
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      if (!isId(row.id) || !ok(row)) throw new DomainError(`Invalid row in backup table "${table}".`);
    }
  };
  const byTable: Record<string, (r: Record<string, unknown>) => boolean> = {
    households: () => true,
    members: () => true,
    accounts: (r) => isCents(r.openingBalanceCents),
    categories: () => true,
    contacts: () => true,
    pixKeys: () => true,
    transactions: (r) => isCents(r.amountCents),
    cards: (r) => isCents(r.limitCents),
    cardPurchases: (r) => isCents(r.amountCents),
    recurrings: (r) => isOptCents(r.amountCents) && isOptCents(r.minCents) && isOptCents(r.maxCents),
    loans: (r) =>
      isCents(r.principalCents) &&
      (r.schedule === undefined ||
        (Array.isArray(r.schedule) &&
          r.schedule.every(
            (s) => typeof s === "object" && s !== null && isCents((s as Record<string, unknown>).amountCents)
          ))),
    loanPayments: (r) => isCents(r.amountCents),
  };
  for (const name of TABLES) {
    check(name, (tables[name] ?? []) as unknown[], byTable[name]);
  }

  let count = 0;
  await db.transaction(
    "rw",
    TABLES.map((n) => db.table(n)),
    async () => {
      for (const name of TABLES) {
        const rows = tables[name] ?? [];
        await db.table(name).clear();
        if (rows.length > 0) await db.table(name).bulkAdd(rows as never[]);
        count += rows.length;
      }
    }
  );
  return count;
}

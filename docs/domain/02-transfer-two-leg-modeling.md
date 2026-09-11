# Transfer modeling — the two-leg approach

**Status:** Decided (resolves the open FIN-04 question in the v2 baseline).

## Decision

A transfer is modeled as **two linked transactions** — one `EXPENSE` on the source
account and one `INCOME` on the destination account — sharing a `transferGroupId`
(a monotonic ULID). There is no single `TRANSFER`-typed record in the ledger.

## Why

1. **The core invariant stays pure.** Balance math is always
   `INCOME adds, EXPENSE subtracts, ADJUSTMENT corrects` — no
   `if (type === TRANSFER)` branches in any calculator.
2. **Edge cases come for free.** Transfer fees (a small extra EXPENSE leg), pending
   transfers (future-dated legs), or cross-household splits (legs in different
   households) are expressible without rewriting the math.
3. **Net worth is correct by construction.** The two legs always sum to zero, so a
   transfer can never artificially inflate or shrink household wealth (Section 04).

## Consequences

- Income/expense analytics must exclude transfer legs (`transferGroupId !== null`).
- The UI presents a transfer as a single merged row (grouped by `transferGroupId`);
  editing or deleting acts on both legs atomically inside one Dexie transaction.
- `transferGroupId` is indexed so legs are cheap to locate.

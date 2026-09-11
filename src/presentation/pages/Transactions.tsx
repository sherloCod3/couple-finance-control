/** Transaction history with filtering, merged transfer legs and editing. */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getTransactions, type TxView } from "../../application/queries";
import * as uc from "../../application/useCases";
import {
  Button,
  Confirm,
  EmptyState,
  IPlus,
  IReceipt,
  ISearch,
  Skeleton,
  TxRow,
  fmtCents,
  fmtDateLong,
  inputCls,
  useToast,
} from "../ui";
import { fill, monthNameOf, useT } from "../i18n";
import { TransactionModal, type TxPreset } from "../actions";

type KindFilter = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";

export default function Transactions() {
  const toast = useToast();
  const { t } = useT();
  const txs = useLiveQuery(() => getTransactions(), []);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [accountFilter, setAccountFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [modal, setModal] = useState<{ open: boolean; preset?: TxPreset }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<TxView | null>(null);

  const KIND_FILTERS: { value: KindFilter; label: string }[] = [
    { value: "ALL", label: t.common_allTime },
    { value: "INCOME", label: t.common_income },
    { value: "EXPENSE", label: t.common_expenses },
    { value: "TRANSFER", label: t.common_transfers },
    { value: "ADJUSTMENT", label: t.common_adjustments },
  ];

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t2 of txs ?? []) set.add(t2.date.slice(0, 7));
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [txs]);

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const t2 of txs ?? []) map.set(t2.accountId, t2.accountName);
    return [...map.entries()];
  }, [txs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (txs ?? []).filter((t2) => {
      if (kind !== "ALL" && t2.kind !== kind && !(kind === "EXPENSE" && t2.kind === "CARD_PAYMENT")) return false;
      if (accountFilter && t2.accountId !== accountFilter && t2.toAccountId !== accountFilter) return false;
      if (monthFilter && !t2.date.startsWith(monthFilter)) return false;
      if (q && !`${t2.description} ${t2.categoryName ?? ""} ${t2.accountName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txs, search, kind, accountFilter, monthFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, TxView[]>();
    for (const t2 of filtered) {
      const list = map.get(t2.date) ?? [];
      list.push(t2);
      map.set(t2.date, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let adjustments = 0;
    for (const t2 of filtered) {
      if (t2.kind === "INCOME") income += t2.amountCents;
      else if (t2.kind === "EXPENSE" || t2.kind === "CARD_PAYMENT") expenses += t2.amountCents;
      else if (t2.kind === "ADJUSTMENT") adjustments += t2.signedCents;
    }
    return { income, expenses, net: income - expenses + adjustments };
  }, [filtered]);

  const openEdit = (tx: TxView): void => {
    if (tx.kind === "TRANSFER" && tx.transferGroupId) {
      setModal({
        open: true,
        preset: {
          kind: "transfer",
          editGroupId: tx.transferGroupId,
          amountCents: tx.amountCents,
          date: tx.date,
          description: tx.description,
          accountId: tx.accountId,
          toAccountId: tx.toAccountId,
          note: tx.note ?? undefined,
        },
      });
      return;
    }
    if (tx.kind === "CARD_PAYMENT") return; // card payments are edited by paying/adjusting statements
    setModal({
      open: true,
      preset: {
        kind: tx.kind === "INCOME" ? "income" : tx.kind === "ADJUSTMENT" ? "adjustment" : "expense",
        editTxId: tx.id,
        amountCents: tx.amountCents,
        adjustPositive: tx.signedCents >= 0,
        date: tx.date,
        description: tx.description,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        recurringId: tx.recurringId,
        note: tx.note ?? undefined,
      },
    });
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    try {
      await uc.deleteTransaction(pendingDelete.id);
      toast.push(
        "success",
        pendingDelete.kind === "TRANSFER" ? t.tx_transferDeleted : t.tx_deleted
      );
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setPendingDelete(null);
    }
  };

  if (!txs) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint">
              <ISearch size={15} />
            </span>
            <input
              className={`${inputCls} pl-9`}
              placeholder={t.common_searchPh}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-linesoft p-1">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    kind === k.value ? "bg-raise text-pine-800 shadow-sm" : "text-inksoft hover:text-ink"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <select className={`${inputCls} w-auto`} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value="">{t.common_allAccounts}</option>
              {accounts.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select className={`${inputCls} w-auto`} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">{t.common_allTime}</option>
              {months.map((m) => (
                <option key={m} value={m}>{monthNameOf(m)}</option>
              ))}
            </select>
            <Button onClick={() => setModal({ open: true })}>
              <IPlus size={15} /> {t.common_new}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-linesoft pt-3 text-[12px] text-inksoft">
          <span>{fill(t.common_entries, { n: filtered.length })}</span>
          <span>
            {t.common_income} <span className="num font-semibold text-pine-700">{fmtCents(summary.income)}</span>
          </span>
          <span>
            {t.common_expenses} <span className="num font-semibold text-rust-600">{fmtCents(summary.expenses)}</span>
          </span>
          <span>
            {t.common_net}{" "}
            <span className={`num font-semibold ${summary.net < 0 ? "text-rust-600" : "text-pine-700"}`}>
              {summary.net < 0 ? `−${fmtCents(-summary.net)}` : `+${fmtCents(summary.net)}`}
            </span>
          </span>
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <EmptyState
            icon={<IReceipt size={22} />}
            title={txs.length === 0 ? t.tx_noTx : t.tx_nothingMatches}
            body={txs.length === 0 ? t.tx_noTxBody : t.tx_tryClearing}
            action={
              txs.length === 0 ? (
                <Button onClick={() => setModal({ open: true })}>
                  <IPlus size={15} /> {t.tx_recordEntry}
                </Button>
              ) : undefined
            }
          />
        </section>
      ) : (
        <div className="space-y-3">
          {groups.map(([date, items]) => {
            const dayNet = items.reduce((acc, t2) => {
              if (t2.kind === "INCOME") return acc + t2.amountCents;
              if (t2.kind === "EXPENSE" || t2.kind === "CARD_PAYMENT") return acc - t2.amountCents;
              if (t2.kind === "ADJUSTMENT") return acc + t2.signedCents;
              return acc;
            }, 0);
            return (
              <section key={date} className="rounded-xl border border-line bg-surface shadow-sm">
                <header className="flex items-center justify-between border-b border-linesoft px-4 py-2.5">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-inkfaint">{fmtDateLong(date)}</h3>
                  <span className={`num text-[12px] font-semibold ${dayNet < 0 ? "text-rust-600" : "text-pine-700"}`}>
                    {dayNet < 0 ? `−${fmtCents(-dayNet)}` : dayNet > 0 ? `+${fmtCents(dayNet)}` : fmtCents(0)}
                  </span>
                </header>
                <div className="px-2 py-1.5">
                  {items.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      onEdit={tx.kind === "CARD_PAYMENT" ? undefined : openEdit}
                      onDelete={(t2) => setPendingDelete(t2)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TransactionModal open={modal.open} onClose={() => setModal({ open: false })} preset={modal.preset} />
      <Confirm
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete?.kind === "TRANSFER" ? t.tx_deleteTransferTitle : t.tx_deleteTitle}
        message={
          pendingDelete?.kind === "TRANSFER"
            ? t.tx_deleteTransferMsg
            : fill(t.tx_deleteMsg, { desc: pendingDelete?.description ?? "" })
        }
      />
    </div>
  );
}

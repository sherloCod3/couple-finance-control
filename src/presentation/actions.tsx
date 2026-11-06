/**
 * Shared action dialogs. Every write goes through an application use case;
 * the dialogs only collect input and surface results (ADR-001).
 */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getFormMeta,
  type CardView,
  type LoanView,
  type StatementView,
} from "../application/queries";
import * as uc from "../application/useCases";
import { todayISO } from "../domain/utils/dates";
import {
  AmountInput,
  Button,
  EmptyState,
  Field,
  IWallet,
  Modal,
  Segmented,
  fmtCents,
  inputCls,
  useToast,
} from "./ui";
import { fill, useT } from "./i18n";

export type TxKindDraft = "income" | "expense" | "transfer" | "adjustment";

export interface TxPreset {
  kind?: TxKindDraft;
  amountCents?: number | null;
  adjustPositive?: boolean;
  date?: string;
  description?: string;
  categoryId?: string | null;
  accountId?: string;
  toAccountId?: string;
  recurringId?: string | null;
  note?: string;
  editTxId?: string;
  editGroupId?: string;
}

export function TransactionModal({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: TxPreset;
}) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [kind, setKind] = useState<TxKindDraft>("expense");
  const [amount, setAmount] = useState<number | null>(null);
  const [adjustPositive, setAdjustPositive] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [recurringId, setRecurringId] = useState("");
  const [note, setNote] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setKind(preset?.kind ?? "expense");
    setAmount(preset?.amountCents ?? null);
    setAdjustPositive(preset?.adjustPositive ?? false);
    setAccountId(preset?.accountId ?? "");
    setToAccountId(preset?.toAccountId ?? "");
    setDate(preset?.date ?? todayISO());
    setDescription(preset?.description ?? "");
    setCategoryId(preset?.categoryId ?? "");
    setRecurringId(preset?.recurringId ?? "");
    setNote(preset?.note ?? "");
    setCreatedBy("");
    setFormKey((k) => k + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const accounts = meta?.accounts ?? [];
  const members = meta?.members ?? [];
  const cats = (meta?.categories ?? []).filter((c) =>
    kind === "income" ? c.kind === "income" : c.kind === "expense"
  );
  const effectiveAccount = accountId || accounts[0]?.id || "";
  const effectiveTo = toAccountId || accounts.find((a) => a.id !== effectiveAccount)?.id || "";
  const effectiveBy = createdBy || members[0]?.id || "";
  const isEdit = Boolean(preset?.editTxId || preset?.editGroupId);
  // `meta` is undefined until the live query resolves — that is "loading", not
  // "no accounts". An entry must belong to an account, so a genuinely empty
  // ledger blocks new entries; editing one always has an account.
  const needsAccount = meta !== undefined && accounts.length === 0 && !isEdit;

  if (needsAccount) {
    return (
      <Modal open={open} onClose={onClose} title={t.entry_new}>
        <EmptyState
          icon={<IWallet size={22} />}
          title={t.entry_needAccountTitle}
          body={t.entry_needAccountBody}
        />
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" onClick={onClose}>{t.common_close}</Button>
        </div>
      </Modal>
    );
  }

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "transfer") {
        const input: uc.TransferInput = {
          fromAccountId: effectiveAccount,
          toAccountId: effectiveTo,
          amountCents: amount ?? 0,
          date,
          description: description || t.entry_defaultTransfer,
          note: note || null,
          createdBy: effectiveBy,
        };
        if (preset?.editGroupId) {
          await uc.updateTransfer(preset.editGroupId, input);
          toast.push("success", t.entry_transferUpdated);
        } else {
          await uc.createTransfer(input);
          toast.push("success", fill(t.entry_transferRecorded, { v: fmtCents(amount ?? 0) }));
        }
      } else {
        const type = kind === "income" ? "INCOME" : kind === "expense" ? "EXPENSE" : "ADJUSTMENT";
        const input: uc.SingleTxInput = {
          type,
          amountCents: amount ?? 0,
          adjustmentPositive: kind === "adjustment" ? adjustPositive : undefined,
          accountId: effectiveAccount,
          date,
          description,
          categoryId: kind === "adjustment" ? null : categoryId || null,
          note: note || null,
          createdBy: effectiveBy,
          recurringId: kind === "expense" && recurringId ? recurringId : null,
        };
        if (preset?.editTxId) {
          await uc.updateTransaction(preset.editTxId, input);
          toast.push("success", t.entry_updated);
        } else {
          await uc.createTransaction(input);
          toast.push(
            "success",
            fill(t.entry_recorded, {
              kind:
                type === "INCOME"
                  ? t.entry_incomeWord
                  : type === "EXPENSE"
                    ? t.entry_expenseWord
                    : t.entry_adjustmentWord,
              v: fmtCents(amount ?? 0),
            })
          );
        }
      }
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.entry_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t.entry_edit : t.entry_new}
      subtitle={kind === "transfer" ? t.entry_transferSubtitle : undefined}
    >
      <div className="space-y-4">
        <Segmented<TxKindDraft>
          options={[
            { value: "income", label: t.entry_income },
            { value: "expense", label: t.entry_expense },
            // A transfer needs two accounts; offering it with one is a dead end.
            ...(accounts.length > 1
              ? [{ value: "transfer" as TxKindDraft, label: t.entry_transfer }]
              : []),
            { value: "adjustment", label: t.entry_adjust },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId("");
            setRecurringId("");
          }}
        />
        <Field label={t.common_amount}>
          <AmountInput key={`amt-${formKey}`} initialCents={preset?.amountCents ?? null} onChange={setAmount} autoFocus />
        </Field>
        {kind === "adjustment" && (
          <Field label={t.entry_direction} hint={t.entry_adjustHint}>
            <Segmented
              options={[
                { value: "out", label: t.entry_moneyOut },
                { value: "in", label: t.entry_moneyIn },
              ]}
              value={adjustPositive ? "in" : "out"}
              onChange={(v) => setAdjustPositive(v === "in")}
            />
          </Field>
        )}
        {kind === "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.entry_fromAccount}>
              <select className={inputCls} value={effectiveAccount} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname}{a.last4 ? ` ••${a.last4}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.entry_toAccount}>
              <select className={inputCls} value={effectiveTo} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname}{a.last4 ? ` ••${a.last4}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <Field label={t.common_account}>
            <select className={inputCls} value={effectiveAccount} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname}{a.last4 ? ` ••${a.last4}` : ""} — {a.institution}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind !== "adjustment" && kind !== "transfer" && (
          <Field label={t.common_category}>
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.common_uncategorized}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common_date}>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t.entry_recordedBy}>
            <select className={inputCls} value={effectiveBy} onChange={(e) => setCreatedBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t.common_description}>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={kind === "transfer" ? t.entry_transferPh : t.entry_expensePh}
          />
        </Field>
        {kind === "expense" && (meta?.recurrings.length ?? 0) > 0 && (
          <Field label={t.entry_linkedPlan} hint={t.entry_linkedPlanHint}>
            <select className={inputCls} value={recurringId} onChange={(e) => setRecurringId(e.target.value)}>
              <option value="">{t.entry_notLinked}</option>
              {meta?.recurrings.map((r) => (
                <option key={r.id} value={r.id}>{r.description}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t.common_notes}>
          <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t.common_saving : isEdit ? t.entry_saveChanges : t.common_record}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CardPaymentModal({
  open,
  onClose,
  card,
  statement,
}: {
  open: boolean;
  onClose: () => void;
  card: CardView | null;
  statement: StatementView | null;
}) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [amount, setAmount] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open || !statement) return;
    setAmount(statement.remainingCents);
    setDate(todayISO());
    setAccountId("");
    setFormKey((k) => k + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !card || !statement) return null;

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.payCardStatement({
        cardId: card.id,
        period: statement.period,
        accountId: accountId || meta?.accounts[0]?.id || "",
        amountCents: amount ?? 0,
        date,
        createdBy: meta?.members[0]?.id || "",
      });
      toast.push("success", fill(t.card_paymentRecorded, { v: fmtCents(amount ?? 0) }));
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.card_couldNotPay);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fill(t.card_payTitle, { name: card.nickname, last4: card.last4 })}
      subtitle={t.card_paySubtitle}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-linesoft bg-paper px-3 py-2.5 text-center">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_statement}</p>
            <p className="num mt-0.5 text-[13px] font-semibold">{fmtCents(statement.totalCents)}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_paidLabel}</p>
            <p className="num mt-0.5 text-[13px] font-semibold text-pine-700">{fmtCents(statement.paidCents)}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_remaining}</p>
            <p className="num mt-0.5 text-[13px] font-semibold text-rust-600">{fmtCents(statement.remainingCents)}</p>
          </div>
        </div>
        <Field label={t.common_amount}>
          <AmountInput key={`amt-${formKey}`} initialCents={statement.remainingCents} onChange={setAmount} autoFocus />
        </Field>
        <Field label={t.card_payFrom}>
          <select className={inputCls} value={accountId || meta?.accounts[0]?.id || ""} onChange={(e) => setAccountId(e.target.value)}>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.nickname}{a.last4 ? ` ••${a.last4}` : ""} — {a.institution}</option>
            ))}
          </select>
        </Field>
        <Field label={t.common_date}>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.loan_recordPayment}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function LoanPaymentModal({
  open,
  onClose,
  loan,
}: {
  open: boolean;
  onClose: () => void;
  loan: LoanView | null;
}) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [amount, setAmount] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const isReceivable = loan?.direction === "receivable";

  useEffect(() => {
    if (!open || !loan) return;
    setAmount(loan.nextDue ? loan.nextDue.amountCents : loan.outstandingCents);
    setDate(todayISO());
    setAccountId(meta?.accounts[0]?.id ?? "");
    setNote("");
    setFormKey((k) => k + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !loan) return null;

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.addLoanPayment({
        loanId: loan.id,
        amountCents: amount ?? 0,
        date,
        note: note || null,
        createdBy: meta?.members[0]?.id || "",
        accountId: accountId || null,
      });
      toast.push(
        "success",
        isReceivable
          ? fill(t.loan_receiptRecorded, { v: fmtCents(amount ?? 0) })
          : fill(t.loan_paymentRecorded, { v: fmtCents(amount ?? 0) })
      );
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.card_couldNotPay);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReceivable ? fill(t.loan_receiptTitle, { name: loan.counterparty }) : fill(t.loan_paymentTitle, { name: loan.counterparty })}
      subtitle={fill(t.loan_outstandingIs, { v: fmtCents(loan.outstandingCents) })}
    >
      <div className="space-y-4">
        <Field label={t.common_amount}>
          <AmountInput key={`amt-${formKey}`} initialCents={loan.nextDue ? loan.nextDue.amountCents : loan.outstandingCents} onChange={setAmount} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common_date}>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t.loan_accountImpact} hint={t.loan_accountImpactHint}>
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t.common_uncategorized}</option>
              {meta?.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nickname}{a.last4 ? ` ••${a.last4}` : ""}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t.loan_noteOpt}>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.loan_notePh} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.common_record}</Button>
        </div>
      </div>
    </Modal>
  );
}

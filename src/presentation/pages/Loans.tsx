/** FIN-10 — money we owe vs money owed to us, with immutable payment history. */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getFormMeta, getLoans, type LoanView } from "../../application/queries";
import * as uc from "../../application/useCases";
import { addMonthsKey, dayOfMonth, isoWithDay, monthKey, todayISO } from "../../domain/utils/dates";
import {
  AmountInput,
  Badge,
  Button,
  EmptyState,
  Field,
  ICheck,
  IPlus,
  IScale,
  Modal,
  ProgressBar,
  Reveal,
  Segmented,
  Skeleton,
  cls,
  fmtCents,
  fmtDate,
  inputCls,
  useToast,
} from "../ui";
import { daysUntil, fill, relDueT, useT } from "../i18n";
import { LoanPaymentModal } from "../actions";

function LoanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [direction, setDirection] = useState<"owed" | "receivable">("owed");
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");
  const [principal, setPrincipal] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [plan, setPlan] = useState<"none" | "plan">("plan");
  const [count, setCount] = useState(12);
  const [installment, setInstallment] = useState<number | null>(null);
  const [firstDue, setFirstDue] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setDirection("owed");
    setCounterparty("");
    setDescription("");
    setPrincipal(null);
    setStartDate(todayISO());
    setPlan("plan");
    setCount(12);
    setInstallment(null);
    setFirstDue(todayISO());
    setNote("");
    setFormKey((k) => k + 1);
  }
  if (!open && seen) setSeen(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const schedule =
        plan === "plan"
          ? Array.from({ length: count }, (_, i) => ({
              dueDate: isoWithDay(addMonthsKey(monthKey(firstDue), i), dayOfMonth(firstDue)),
              amountCents: installment ?? 0,
            }))
          : [];
      await uc.saveLoan({
        direction,
        counterparty,
        description: description || null,
        principalCents: principal ?? 0,
        startDate,
        schedule,
        note: note || null,
        createdBy: meta?.members[0]?.id ?? "",
      });
      toast.push("success", t.loan_saved);
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t.loan_newLoan} subtitle={t.loan_subtitle}>
      <div className="space-y-4">
        <Field label={t.loan_direction}>
          <Segmented<"owed" | "receivable">
            options={[
              { value: "owed", label: t.loan_weOwe },
              { value: "receivable", label: t.loan_owedToUs },
            ]}
            value={direction}
            onChange={setDirection}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.loan_counterparty}>
            <input className={inputCls} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={t.loan_counterpartyPh} autoFocus />
          </Field>
          <Field label={t.loan_description}>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Auto financing" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal">
            <AmountInput key={`amt-${formKey}`} initialCents={null} onChange={setPrincipal} />
          </Field>
          <Field label={t.loan_startDate}>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t.loan_repaymentPlan}>
          <Segmented<"none" | "plan">
            options={[
              { value: "plan", label: t.loan_monthlyInstallments },
              { value: "none", label: t.loan_noSchedule },
            ]}
            value={plan}
            onChange={setPlan}
          />
        </Field>
        {plan === "plan" && (
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-paper p-3">
            <Field label={t.loan_installments}>
              <input
                type="number"
                min={1}
                max={120}
                className={`${inputCls} num`}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
              />
            </Field>
            <Field label={t.loan_monthlyAmount}>
              <AmountInput key={`inst-${formKey}`} initialCents={null} onChange={setInstallment} />
            </Field>
            <Field label={t.loan_firstDue}>
              <input type="date" className={inputCls} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label={t.loan_noteOpt}>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.common_save}</Button>
        </div>
      </div>
    </Modal>
  );
}

function LoanCard({ loan, index, onPay }: { loan: LoanView; index: number; onPay: (l: LoanView) => void }) {
  const toast = useToast();
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const owed = loan.direction === "owed";
  const settled = loan.outstandingCents <= 0;
  const overdue = loan.nextDue !== null && loan.nextDue.dueDate < todayISO();

  return (
    <Reveal delay={index * 50}>
      <article className="rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpanded(!expanded)}>
          <span className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", owed ? "bg-rust-100 text-rust-600" : "bg-pine-100 text-pine-700")}>
            <IScale size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-ink">{loan.counterparty}</p>
            <p className="text-[11.5px] text-inkfaint">
              {loan.description ?? (owed ? t.loan_moneyWeOwe : t.loan_moneyOwedToUs)}
              {loan.nextDue && !settled && (
                <>
                  {" · "}
                  {t.loan_nextWord}{" "}
                  <span className={overdue ? "font-semibold text-rust-600" : ""}>
                    {fmtDate(loan.nextDue.dueDate)} ({relDueT(daysUntil(loan.nextDue.dueDate), t)})
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className={cls("num text-[15px] font-semibold", owed ? "text-rust-600" : "text-pine-700")}>
              {fmtCents(loan.outstandingCents)}
            </p>
            {settled ? (
              <Badge tone="ok">{t.loan_settled}</Badge>
            ) : overdue && owed ? (
              <Badge tone="danger" pulse>{t.loan_overdueBadge}</Badge>
            ) : (
              <Badge tone="neutral">{fill(t.loan_pctRepaid, { pct: loan.progressPct })}</Badge>
            )}
          </div>
        </button>
        <div className="px-4 pb-3">
          <ProgressBar pct={loan.progressPct} tone={owed ? (overdue ? "danger" : "warn") : "ok"} className="h-1.5" />
          <div className="mt-1.5 flex justify-between text-[11px] text-inkfaint">
            <span>{t.loan_principal} <span className="num font-semibold text-inksoft">{fmtCents(loan.principalCents)}</span></span>
            <span>{t.loan_paid} <span className="num font-semibold text-pine-700">{fmtCents(loan.paidCents)}</span></span>
          </div>
        </div>
        {expanded && (
          <div className="fade-in grid gap-4 border-t border-linesoft px-4 py-3 sm:grid-cols-2">
            {loan.schedule.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.loan_upcomingSchedule}</p>
                <ul className="space-y-1">
                  {loan.schedule
                    .filter((s) => !s.settled)
                    .slice(0, 6)
                    .map((s) => (
                      <li key={s.dueDate} className="flex items-center justify-between text-[12px]">
                        <span className={cls(s.dueDate < todayISO() ? "font-semibold text-rust-600" : "text-inksoft")}>{fmtDate(s.dueDate)}</span>
                        <span className="num text-inksoft">{fmtCents(s.amountCents)}</span>
                      </li>
                    ))}
                  {loan.schedule.filter((s) => !s.settled).length === 0 && (
                    <li className="text-[12px] text-pine-700">{t.loan_allSettled}</li>
                  )}
                </ul>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">
                {t.loan_paymentHistory} <span className="normal-case text-inkfaint/70">{t.loan_immutable}</span>
              </p>
              {loan.payments.length === 0 ? (
                <p className="text-[12px] text-inkfaint">{t.loan_noPayments}</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {loan.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-[12px]">
                      <span className="text-pine-700"><ICheck size={12} /></span>
                      <span className="text-inksoft">{fmtDate(p.date)}</span>
                      <span className="num ml-auto font-semibold">{fmtCents(p.amountCents)}</span>
                      {p.hasTransaction && <Badge tone="steel">{t.loan_inLedger}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {!settled && (
          <footer className="flex justify-end gap-2 border-t border-linesoft px-4 py-2.5">
            {loan.payments.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto !text-rust-600 hover:!bg-rust-100"
                onClick={async () => {
                  try {
                    await uc.deleteLoan(loan.id);
                    toast.push("success", t.loan_deleted);
                  } catch (e) {
                    toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
                  }
                }}
              >
                {t.common_delete}
              </Button>
            )}
            <Button size="sm" variant={owed ? "primary" : "soft"} onClick={() => onPay(loan)}>
              {owed ? t.loan_recordPayment : t.loan_recordReceipt}
            </Button>
          </footer>
        )}
      </article>
    </Reveal>
  );
}

export default function Loans() {
  const { t } = useT();
  const loans = useLiveQuery(() => getLoans(), []);
  const [modal, setModal] = useState(false);
  const [paying, setPaying] = useState<LoanView | null>(null);

  if (!loans) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  const owed = loans.filter((l) => l.direction === "owed");
  const receivable = loans.filter((l) => l.direction === "receivable");

  return (
    <div className="space-y-6">
      <section data-tour="page-loans" className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-[12.5px] leading-relaxed text-inksoft">{t.loan_intro}</p>
        <Button onClick={() => setModal(true)}>
          <IPlus size={15} /> {t.loan_newLoan}
        </Button>
      </section>

      <section>
        <h2 className="font-display mb-2.5 text-[16px] font-bold tracking-tight">{t.loan_moneyWeOwe}</h2>
        {owed.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface shadow-sm">
            <EmptyState icon={<IScale size={20} />} title={t.loan_noDebts} body={t.loan_noDebtsBody} />
          </div>
        ) : (
          <div className="space-y-3">
            {owed.map((l, i) => (
              <LoanCard key={l.id} loan={l} index={i} onPay={setPaying} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display mb-2.5 text-[16px] font-bold tracking-tight">{t.loan_moneyOwedToUs}</h2>
        {receivable.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface shadow-sm">
            <EmptyState icon={<IScale size={20} />} title={t.loan_nothingReceivable} body={t.loan_nothingReceivableBody} />
          </div>
        ) : (
          <div className="space-y-3">
            {receivable.map((l, i) => (
              <LoanCard key={l.id} loan={l} index={i} onPay={setPaying} />
            ))}
          </div>
        )}
      </section>

      <LoanModal open={modal} onClose={() => setModal(false)} />
      <LoanPaymentModal open={paying !== null} onClose={() => setPaying(null)} loan={paying} />
    </div>
  );
}

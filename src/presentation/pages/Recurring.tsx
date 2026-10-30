/**
 * FIN-08 — recurring expenses are forecasts/templates. Recording a real
 * transaction and linking it to a plan marks that occurrence as settled.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getFormMeta, getRecurrings, type RecurringView } from "../../application/queries";
import * as uc from "../../application/useCases";
import { todayISO } from "../../domain/utils/dates";
import {
  AmountInput,
  Badge,
  Button,
  Confirm,
  EmptyState,
  Field,
  IPlus,
  IRepeat,
  Modal,
  Reveal,
  Segmented,
  Skeleton,
  Toggle,
  cls,
  fmtCents,
  fmtDate,
  inputCls,
  useToast,
} from "../ui";
import { fill, monthNames, useT, weekdayNames, type Dict } from "../i18n";
import { TransactionModal, type TxPreset } from "../actions";

type Freq = "monthly" | "weekly" | "yearly";

const freqLabel = (r: RecurringView, t: Dict): string => {
  if (r.frequency === "weekly")
    return fill(t.plan_freqWeekly, { d: weekdayNames()[(r.expectedDay - 1 + 7) % 7] });
  if (r.frequency === "yearly")
    return fill(t.plan_freqYearly, { m: monthNames()[(r.expectedMonth ?? 1) - 1], d: r.expectedDay });
  return fill(t.plan_freqMonthly, { d: r.expectedDay });
};

function RecurringModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: RecurringView | null }) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<Freq>("monthly");
  const [expectedDay, setExpectedDay] = useState(5);
  const [expectedMonth, setExpectedMonth] = useState(1);
  const [mode, setMode] = useState<"fixed" | "range">("fixed");
  const [fixed, setFixed] = useState<number | null>(null);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setDescription(preset?.description ?? "");
    setCategoryId(preset?.categoryId ?? "");
    setFrequency((preset?.frequency as Freq) ?? "monthly");
    setExpectedDay(preset?.expectedDay ?? 5);
    setExpectedMonth(preset?.expectedMonth ?? 1);
    setMode(preset?.fixedCents === null && (preset?.minCents !== null || preset === null) ? (preset ? "range" : "fixed") : preset?.fixedCents !== null ? "fixed" : "range");
    setFixed(preset?.fixedCents ?? null);
    setMin(preset?.minCents ?? null);
    setMax(preset?.maxCents ?? null);
    setActive(preset?.active ?? true);
    setKey((k) => k + 1);
  }
  if (!open && seen) setSeen(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.saveRecurring({
        id: preset?.id,
        description,
        categoryId: categoryId || null,
        frequency,
        expectedDay,
        expectedMonth: frequency === "yearly" ? expectedMonth : null,
        fixedCents: mode === "fixed" ? fixed : null,
        minCents: mode === "range" ? min : null,
        maxCents: mode === "range" ? max : null,
        active,
        createdBy: meta?.members[0]?.id ?? "",
      });
      toast.push("success", preset ? t.plan_updated : t.plan_created);
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={preset ? t.plan_editPlan : t.plan_newPlan} subtitle={t.plan_subtitle}>
      <div className="space-y-4">
        <Field label={t.common_description}>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common_category}>
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.common_uncategorized}</option>
              {meta?.categories.filter((c) => c.kind === "expense").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t.plan_frequency}>
            <Segmented<Freq>
              options={[
                { value: "monthly", label: t.plan_monthly },
                { value: "weekly", label: t.plan_weekly },
                { value: "yearly", label: t.plan_yearly },
              ]}
              value={frequency}
              onChange={(f) => {
                setFrequency(f);
                if (f === "yearly") setMode("fixed");
              }}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {frequency === "weekly" ? (
            <Field label={t.plan_weekday}>
              <select className={inputCls} value={expectedDay} onChange={(e) => setExpectedDay(Number(e.target.value))}>
                {weekdayNames().map((w, i) => (
                  <option key={w} value={i + 1}>{w}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={t.plan_dayOfMonth}>
              <select className={inputCls} value={expectedDay} onChange={(e) => setExpectedDay(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{fill(t.common_day, { n: d })}</option>
                ))}
              </select>
            </Field>
          )}
          {frequency === "yearly" ? (
            <Field label={t.plan_month}>
              <select className={inputCls} value={expectedMonth} onChange={(e) => setExpectedMonth(Number(e.target.value))}>
                {monthNames().map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={t.plan_amountStyle}>
              <Segmented<"fixed" | "range">
                options={[
                  { value: "fixed", label: t.plan_fixed },
                  { value: "range", label: t.plan_range },
                ]}
                value={mode}
                onChange={setMode}
              />
            </Field>
          )}
        </div>
        {frequency !== "yearly" && mode === "range" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.plan_minimum}>
              <AmountInput key={`min-${key}`} initialCents={preset?.minCents ?? null} onChange={setMin} />
            </Field>
            <Field label={t.plan_maximum}>
              <AmountInput key={`max-${key}`} initialCents={preset?.maxCents ?? null} onChange={setMax} />
            </Field>
          </div>
        ) : (
          <Field label={t.plan_amount}>
            <AmountInput key={`amt-${key}`} initialCents={preset?.fixedCents ?? null} onChange={setFixed} />
          </Field>
        )}
        {preset && (
          <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2.5">
            <span className="text-[12.5px] font-semibold text-inksoft">{t.plan_active}</span>
            <Toggle on={active} onChange={() => setActive(!active)} label="Toggle active" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.common_save}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Recurring() {
  const toast = useToast();
  const { t } = useT();
  const recurrings = useLiveQuery(() => getRecurrings(), []);
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [modal, setModal] = useState<{ open: boolean; preset?: RecurringView | null }>({ open: false });
  const [txModal, setTxModal] = useState<{ open: boolean; preset?: TxPreset }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<RecurringView | null>(null);

  if (!recurrings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  const monthlyCommitment = recurrings
    .filter((r) => r.active)
    .reduce((acc, r) => {
      if (r.frequency === "monthly") return acc + r.expectedCents;
      if (r.frequency === "weekly") return acc + r.expectedCents * 4;
      return acc + Math.round(r.expectedCents / 12);
    }, 0);

  const recordPayment = (r: RecurringView): void => {
    setTxModal({
      open: true,
      preset: {
        kind: "expense",
        amountCents: r.expectedCents,
        date: r.currentDue ?? todayISO(),
        description: r.description,
        categoryId: r.categoryId,
        recurringId: r.id,
        accountId: meta?.accounts[0]?.id,
      },
    });
  };

  return (
    <div className="space-y-4">
      <section data-tour="page-plans" className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-[12.5px] leading-relaxed text-inksoft">{t.plan_intro}</p>
        <Button onClick={() => setModal({ open: true })}>
          <IPlus size={15} /> {t.plan_createPlan}
        </Button>
      </section>

      {recurrings.length === 0 ? (
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <EmptyState
            icon={<IRepeat size={22} />}
            title={t.plan_noPlans}
            body={t.plan_noPlansBody}
            action={<Button onClick={() => setModal({ open: true })}><IPlus size={15} /> {t.plan_createPlan}</Button>}
          />
        </section>
      ) : (
        <div className="space-y-2.5">
          {recurrings.map((r, i) => {
            const missed = r.active && r.currentDue !== null && r.currentDue < todayISO() && !r.paidThisPeriod;
            const due = r.active && r.currentDue !== null && r.currentDue >= todayISO() && !r.paidThisPeriod;
            return (
              <Reveal key={r.id} delay={i * 40}>
                <article
                  className={cls(
                    "group flex flex-wrap items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-sm transition-all hover:shadow-md sm:flex-nowrap",
                    missed ? "border-rust-600/40" : "border-line",
                    !r.active && "opacity-60"
                  )}
                >
                  <span className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", missed ? "bg-rust-100 text-rust-600" : "bg-pine-100 text-pine-700")}>
                    <IRepeat size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {r.description}
                      {r.categoryName && (
                        <Badge tone="neutral">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.categoryColor ?? "#8B968C" }} />
                          {r.categoryName}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-inkfaint">
                      {freqLabel(r, t)}
                      {r.nextDue && r.active && <> · {fill(t.plan_nextOn, { d: fmtDate(r.nextDue) })}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.fixedCents !== null ? (
                      <p className="num text-[15px] font-semibold text-ink">{fmtCents(r.fixedCents)}</p>
                    ) : (
                      <p className="num text-[13px] font-semibold text-ink">
                        {fmtCents(r.minCents ?? 0)}–{fmtCents(r.maxCents ?? 0)}
                        <span className="ml-1 text-[10.5px] font-medium text-inkfaint">est.</span>
                      </p>
                    )}
                    <div className="mt-0.5">
                      {!r.active ? (
                        <Badge tone="neutral">{t.plan_paused}</Badge>
                      ) : r.paidThisPeriod ? (
                        <Badge tone="ok">{t.plan_paidPeriod}</Badge>
                      ) : missed ? (
                        <Badge tone="danger" pulse>{fill(t.plan_missedOn, { d: fmtDate(r.currentDue ?? "") })}</Badge>
                      ) : due ? (
                        <Badge tone="warn">{fill(t.plan_dueOn, { d: fmtDate(r.currentDue ?? "") })}</Badge>
                      ) : (
                        <Badge tone="steel">{t.plan_scheduled}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.active && !r.paidThisPeriod && (
                      <Button size="sm" variant="soft" onClick={() => recordPayment(r)}>
                        {t.plan_recordPayment}
                      </Button>
                    )}
                    <Toggle
                      on={r.active}
                      onChange={async () => {
                        await uc.toggleRecurring(r.id);
                        toast.push("info", r.active ? fill(t.plan_pausedMsg, { name: r.description }) : fill(t.plan_resumedMsg, { name: r.description }));
                      }}
                      label={`Toggle ${r.description}`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, preset: r })} className="opacity-0 group-hover:opacity-100">
                      {t.common_edit}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-rust-600 opacity-0 hover:!bg-rust-100 group-hover:opacity-100"
                      onClick={() => setPendingDelete(r)}
                    >
                      {t.common_delete}
                    </Button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}

      {recurrings.length > 0 && (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3 text-[12.5px] text-inksoft">
          {fill(t.plan_commitment, { v: fmtCents(monthlyCommitment) })}
          <span className="text-inkfaint"> · {t.plan_forecastsNever}</span>
        </p>
      )}

      <RecurringModal open={modal.open} onClose={() => setModal({ open: false })} preset={modal.preset} />
      <TransactionModal open={txModal.open} onClose={() => setTxModal({ open: false })} preset={txModal.preset} />
      <Confirm
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t.plan_deleteTitle}
        message={fill(t.plan_deleteMsg, { name: pendingDelete?.description ?? "" })}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await uc.deleteRecurring(pendingDelete.id);
          toast.push("success", t.plan_deleted);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

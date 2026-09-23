/**
 * FIN-05 / FIN-06 / FIN-07 — the household's immediate answers:
 * cash, commitments, what's due, what's overdue, the month so far,
 * and where the money went.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getDashboard,
  getLoans,
  getRecurrings,
  type CardView,
  type LoanView,
  type StatementView,
} from "../../application/queries";
import type { Obligation } from "../../domain/services/position";
import { currentMonthKey } from "../../domain/utils/dates";
import { BarsChart, Donut } from "../charts";
import { daysUntil, fill, monthNameOf, monthShortOf, relDueT, useT } from "../i18n";
import {
  Badge,
  Button,
  EmptyState,
  IArrowRight,
  IBell,
  ICard,
  ICheck,
  IScale,
  ITrendDown,
  ITrendUp,
  ProgressBar,
  Reveal,
  Skeleton,
  TxRow,
  cls,
  fmtCents,
  fmtDate,
  fmtSignedCents,
  useCountUp,
} from "../ui";
import { CardPaymentModal, LoanPaymentModal, TransactionModal, type TxPreset } from "../actions";

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[190px] w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-64 rounded-xl xl:col-span-7" />
        <Skeleton className="h-64 rounded-xl xl:col-span-5" />
        <Skeleton className="h-72 rounded-xl xl:col-span-7" />
        <Skeleton className="h-72 rounded-xl xl:col-span-5" />
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const vm = useLiveQuery(() => getDashboard(), []);
  const loans = useLiveQuery(() => getLoans(), []);
  const recurrings = useLiveQuery(() => getRecurrings(), []);

  const [txModal, setTxModal] = useState<{ open: boolean; preset?: TxPreset }>({ open: false });
  const [cardPay, setCardPay] = useState<{ card: CardView | null; statement: StatementView | null }>({
    card: null,
    statement: null,
  });
  const [loanPay, setLoanPay] = useState<LoanView | null>(null);

  const cashCents = useCountUp(vm?.position.currentCash.cents ?? 0);

  // Rules of Hooks: called unconditionally, before the loading early return,
  // so hook order stays stable between the skeleton and loaded renders.
  const { t } = useT();

  if (!vm) return <DashboardSkeleton />;

  const { position, series, slices, recent, cards, accounts } = vm;
  const obligations = [...position.overdue, ...position.upcoming].slice(0, 6);
  const monthName = monthNameOf(currentMonthKey());
  // "Are we spending more or less than we received?" — spending includes card
  // purchases, so this is the same basis as the Spending figure below it.
  const savingsPct = position.monthIncome.isZero()
    ? null
    : Math.round(
        ((position.monthIncome.cents - position.monthSpending.cents) / position.monthIncome.cents) * 100
      );

  const recordObligation = (o: Obligation): void => {
    const ref = o.ref;
    if (ref.kind === "recurring") {
      const rec = recurrings?.find((r) => r.id === ref.recurringId);
      setTxModal({
        open: true,
        preset: {
          kind: "expense",
          amountCents: o.amount.cents,
          date: o.dueDate,
          description: o.title,
          categoryId: rec?.categoryId ?? null,
          recurringId: ref.recurringId,
          accountId: accounts[0]?.id,
        },
      });
    } else if (ref.kind === "card-statement") {
      const card = cards.find((c) => c.id === ref.cardId) ?? null;
      const statement = card?.statements.find((s) => s.period === ref.period) ?? null;
      if (card && statement) setCardPay({ card, statement });
    } else {
      const loan = loans?.find((l) => l.id === ref.loanId) ?? null;
      if (loan) setLoanPay(loan);
    }
  };

  return (
    <div className="space-y-5">
      {/* ---- position board ------------------------------------------------ */}
      <Reveal>
        <section className="ledger-sheet relative overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
            <div className="px-6 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-inkfaint">
                  {t.dash_cashPosition} · {fill(t.dash_accountsCount, { n: accounts.length })}
                </p>
                <span
                  className={cls(
                    "num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
                    position.monthDelta.isNegative() ? "bg-rust-100 text-rust-700" : "bg-pine-100 text-pine-800"
                  )}
                >
                  {position.monthDelta.isNegative() ? <ITrendDown size={12} /> : <ITrendUp size={12} />}
                  {fmtSignedCents(position.monthDelta.cents)} {t.dash_thisMonth}
                </span>
              </div>
              <p className="num mt-3 text-[42px] font-semibold leading-none tracking-tight text-ink sm:text-[52px]">
                {fmtCents(cashCents)}
              </p>
              <p className="mt-2.5 max-w-[360px] text-[12.5px] leading-relaxed text-inkfaint">
                {t.dash_currentHint}
              </p>
              <div className="mt-4">
                <Button variant="soft" size="sm" onClick={() => onNavigate("accounts")}>
                  {t.dash_viewAccounts} <IArrowRight size={13} />
                </Button>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-0 border-t border-dashed border-line bg-raise/60 px-6 py-5 md:border-l md:border-t-0 sm:px-8">
              {[
                {
                  label: t.dash_availableNow,
                  value: position.availableCash,
                  tone: "bg-pine-500",
                  hint: t.dash_availableHint,
                },
                {
                  label: t.dash_committed,
                  value: position.committedCash,
                  tone: "bg-gold-600",
                  hint: t.dash_committedHint,
                },
                {
                  label: t.dash_projected,
                  value: position.projectedCash,
                  tone: "bg-steel-600",
                  hint: t.dash_projectedHint,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="group flex items-baseline justify-between gap-3 border-b border-linesoft py-3 last:border-b-0"
                >
                  <div>
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-inksoft">
                      <span className={cls("h-2 w-2 rounded-full", row.tone)} />
                      {row.label}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-inkfaint transition-colors group-hover:text-inksoft">
                      {row.hint}
                    </p>
                  </div>
                  <span className="num text-[17px] font-semibold text-ink">{fmtCents(row.value.cents)}</span>
                </div>
              ))}
            </div>
          </div>
          {position.overdue.length > 0 && (
            <div className="flex items-center gap-2 border-t border-rust-600/20 bg-rust-100/70 px-6 py-2.5 text-[12.5px] font-semibold text-rust-700 sm:px-8">
              <IBell size={15} />
              {fill(t.dash_overdueCount, { n: position.overdue.length })} ·{" "}
              <span className="num">{fmtCents(position.overdue.reduce((a, o) => a + o.amount.cents, 0))}</span>
              <span className="ml-auto hidden text-[11.5px] font-medium text-rust-700/70 sm:block">
                {t.dash_bannerTail}
              </span>
            </div>
          )}
        </section>
      </Reveal>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* ---- needs attention ------------------------------------------- */}
        <Reveal className="xl:col-span-7" delay={60}>
          <section className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_needsAttention}</h2>
              <Badge tone={position.overdue.length > 0 ? "danger" : "neutral"} pulse={position.overdue.length > 0}>
                {position.overdue.length} {t.dash_overdue} · {position.upcoming.length} {t.dash_upcoming}
              </Badge>
            </header>
            {obligations.length === 0 ? (
              <EmptyState
                icon={<ICheck size={22} />}
                title={t.dash_allClear}
                body={t.dash_allClearBody}
              />
            ) : (
              <ul className="divide-y divide-linesoft">
                {obligations.map((o) => (
                  <li key={o.key} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cls(
                        "h-2 w-2 shrink-0 rounded-full",
                        o.status === "overdue" ? "bg-rust-600 pulse-dot" : "bg-gold-600"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{o.title}</p>
                      <p className="text-[11.5px] text-inkfaint">
                        {fmtDate(o.dueDate)} ·{" "}
                        <span className={o.status === "overdue" ? "font-semibold text-rust-600" : ""}>
                          {relDueT(daysUntil(o.dueDate), t)}
                        </span>
                        {" · "}{o.detail}
                      </p>
                    </div>
                    <span className="num text-[13.5px] font-semibold text-ink">{fmtCents(o.amount.cents)}</span>
                    <Button size="sm" variant="outline" onClick={() => recordObligation(o)}>
                      {t.common_record}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        {/* ---- month overview --------------------------------------------- */}
        <Reveal className="xl:col-span-5" delay={120}>
          <section className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold tracking-tight">{monthName}</h2>
              <Badge tone={position.monthNet.isNegative() ? "danger" : "ok"}>
                {t.common_cashNet} {fmtSignedCents(position.monthNet.cents)}
              </Badge>
            </header>
            <div className="space-y-3.5">
              {[
                {
                  label: t.dash_incomeReceived,
                  cents: position.monthIncome.cents,
                  cls: "text-pine-700",
                  tone: "bg-pine-500" as const,
                  note: null as string | null,
                },
                {
                  label: t.dash_spending,
                  cents: position.monthSpending.cents,
                  cls: "text-rust-600",
                  tone: "bg-rust-600" as const,
                  note: position.monthCardSpending.isZero()
                    ? null
                    : fill(t.dash_includesCards, { v: fmtCents(position.monthCardSpending.cents) }),
                },
              ].map((r) => {
                const maxBar = Math.max(position.monthIncome.cents, position.monthSpending.cents, 1);
                return (
                  <div key={r.label}>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[12px] font-bold text-inksoft">{r.label}</p>
                      <p className={cls("num text-[15px] font-semibold", r.cls)}>{fmtCents(r.cents)}</p>
                    </div>
                    <ProgressBar pct={(r.cents / maxBar) * 100} className="mt-1.5 h-1.5" tone={r.tone === "bg-pine-500" ? "ok" : "danger"} />
                    {r.note && <p className="mt-1 text-[11px] text-inkfaint">{r.note}</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 rounded-lg bg-paper px-3 py-2.5 text-[12px] leading-relaxed text-inksoft">
              {savingsPct === null
                ? t.dash_noIncome
                : savingsPct >= 0
                  ? fill(t.dash_savingsKeep, { pct: savingsPct })
                  : fill(t.dash_spendingAhead, { pct: Math.abs(savingsPct) })}
            </p>
          </section>
        </Reveal>

        {/* ---- cash flow chart --------------------------------------------- */}
        <Reveal className="xl:col-span-7" delay={60}>
          <section className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_cashFlow}</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")}>
                {t.dash_allActivity} <IArrowRight size={13} />
              </Button>
            </header>
            <BarsChart
              data={series.map((p, i) => ({
                label: monthShortOf(p.ym),
                income: p.income.cents,
                // Same basis as the month card: cash expenses + card purchases.
                expenses: p.spending.cents,
                highlight: i === series.length - 1,
              }))}
            />
          </section>
        </Reveal>

        {/* ---- spending by category ---------------------------------------- */}
        <Reveal className="xl:col-span-5" delay={120}>
          <section className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_whereMoney}</h2>
            {slices.length === 0 ? (
              <EmptyState
                icon={<ICheck size={22} />}
                title={t.dash_noSpending}
                body={t.dash_noSpendingBody}
              />
            ) : (
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <div className="w-[150px] shrink-0 sm:w-[172px]">
                  <Donut slices={slices} totalCents={slices.reduce((a, s) => a + s.cents, 0)} />
                </div>
                <ul className="w-full flex-1 space-y-2">
                  {slices.slice(0, 5).map((s) => {
                    const delta =
                      s.prevCents > 0 ? Math.round(((s.cents - s.prevCents) / s.prevCents) * 100) : null;
                    return (
                      <li key={s.id ?? s.name}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.name}
                            {delta !== null && delta !== 0 && (
                              <span className={cls("num inline-flex items-center gap-0.5 text-[10.5px]", delta > 0 ? "text-rust-600" : "text-pine-700")}>
                                {delta > 0 ? <ITrendUp size={10} /> : <ITrendDown size={10} />}
                                {Math.abs(delta)}%
                              </span>
                            )}
                          </span>
                          <span className="num font-semibold text-inksoft">{fmtCents(s.cents)}</span>
                        </div>
                        <ProgressBar pct={s.sharePct} className="mt-1 h-1" tone="steel" />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </Reveal>

        {/* ---- recent activity ---------------------------------------------- */}
        <Reveal className="xl:col-span-7" delay={60}>
          <section className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_recent}</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")}>
                {t.dash_viewAll} <IArrowRight size={13} />
              </Button>
            </header>
            <div className="-mx-2">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} showDate />
              ))}
            </div>
          </section>
        </Reveal>

        {/* ---- cards + loans ------------------------------------------------ */}
        <Reveal className="xl:col-span-5" delay={120}>
          <div className="flex h-full flex-col gap-5">
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_cards}</h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate("cards")}>
                  {t.dash_manage} <IArrowRight size={13} />
                </Button>
              </header>
              {cards.length === 0 ? (
                <EmptyState icon={<ICard size={20} />} title={t.dash_noCards} body={t.dash_noCardsBody} />
              ) : (
                <div className="space-y-4">
                  {cards.map((c) => {
                    const openStatement = c.statements.find((s) => s.remainingCents > 0);
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-ink">{c.nickname} <span className="num text-inkfaint">••{c.last4}</span></span>
                          <Badge tone="steel">{fill(t.dash_pctLimit, { pct: c.usedPct })}</Badge>
                        </div>
                        <ProgressBar pct={c.usedPct} tone="steel" className="mt-1.5" />
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[11.5px] text-inkfaint">
                            <span className="num font-semibold text-inksoft">{fmtCents(c.availableCents)}</span> {t.dash_availableShort}
                          </p>
                          {openStatement ? (
                            <button
                              type="button"
                              onClick={() => setCardPay({ card: c, statement: openStatement })}
                              className="rounded-md bg-steel-100 px-2 py-1 text-[11.5px] font-semibold text-steel-700 transition-colors hover:bg-steel-600 hover:text-white"
                            >
                              {t.dash_pay} {fmtCents(openStatement.remainingCents)} · {fill(t.dash_dueShort, { d: fmtDate(openStatement.dueDate) })}
                            </button>
                          ) : (
                            <span className="text-[11.5px] font-medium text-pine-700">{t.dash_settled}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="flex-1 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[16px] font-bold tracking-tight">{t.dash_loans}</h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate("loans")}>
                  {t.dash_details} <IArrowRight size={13} />
                </Button>
              </header>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-paper px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-inkfaint">
                    <IScale size={13} /> {t.dash_weOwe}
                  </p>
                  <p className="num mt-1 text-[17px] font-semibold text-rust-600">{fmtCents(vm.loans.owedCents)}</p>
                  <p className="text-[11px] text-inkfaint">{fill(t.dash_loanCount, { n: vm.loans.owedCount })}</p>
                </div>
                <div className="rounded-lg bg-paper px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-inkfaint">
                    <IScale size={13} /> {t.dash_owedToUs}
                  </p>
                  <p className="num mt-1 text-[17px] font-semibold text-pine-700">{fmtCents(vm.loans.receivableCents)}</p>
                  <p className="text-[11px] text-inkfaint">{fill(t.dash_loanCount, { n: vm.loans.receivableCount })}</p>
                </div>
              </div>
            </section>
          </div>
        </Reveal>
      </div>

      <TransactionModal open={txModal.open} onClose={() => setTxModal({ open: false })} preset={txModal.preset} />
      <CardPaymentModal
        open={cardPay.card !== null}
        onClose={() => setCardPay({ card: null, statement: null })}
        card={cardPay.card}
        statement={cardPay.statement}
      />
      <LoanPaymentModal open={loanPay !== null} onClose={() => setLoanPay(null)} loan={loanPay} />
    </div>
  );
}

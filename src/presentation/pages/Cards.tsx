/** FIN-09 — cards, statements, purchases, limits and statement payments. */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCards, getFormMeta, type CardView, type StatementView } from "../../application/queries";
import * as uc from "../../application/useCases";
import { addMonthsKey, dayOfMonth, daysInMonthKey, monthKey, todayISO } from "../../domain/utils/dates";
import {
  AmountInput,
  Badge,
  Button,
  Confirm,
  EmptyState,
  Field,
  ICard,
  IPlus,
  ITrash,
  IconBtn,
  Modal,
  ProgressBar,
  Reveal,
  Skeleton,
  cls,
  fmtCents,
  fmtDate,
  inputCls,
  useToast,
} from "../ui";
import { fill, monthNameOf, useT } from "../i18n";
import { CardPaymentModal } from "../actions";

function CardModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: CardView | null }) {
  const toast = useToast();
  const { t } = useT();
  const [issuer, setIssuer] = useState("");
  const [nickname, setNickname] = useState("");
  const [last4, setLast4] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [closingDay, setClosingDay] = useState(5);
  const [dueDay, setDueDay] = useState(12);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setIssuer(preset?.issuer ?? "");
    setNickname(preset?.nickname ?? "");
    setLast4(preset?.last4 ?? "");
    setLimit(preset?.limitCents ?? null);
    setClosingDay(preset?.closingDay ?? 5);
    setDueDay(preset?.dueDay ?? 12);
    setKey((k) => k + 1);
  }
  if (!open && seen) setSeen(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.saveCard({ id: preset?.id, issuer, nickname, last4, limitCents: limit ?? 0, closingDay, dueDay });
      toast.push("success", preset ? t.card_updated : t.card_added);
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <Modal open={open} onClose={onClose} title={preset ? t.card_editCard : t.card_newCard} subtitle={t.card_last4Only}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.card_issuer}>
            <input className={inputCls} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Banco Demo" />
          </Field>
          <Field label={t.card_nickname}>
            <input className={inputCls} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Demo Card" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.card_last4Label}>
            <input className={`${inputCls} num`} value={last4} maxLength={4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} placeholder="4321" />
          </Field>
          <Field label={t.card_creditLimit}>
            <AmountInput key={`amt-${key}`} initialCents={preset?.limitCents ?? null} onChange={setLimit} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.card_closingDay} hint={t.card_closingHint}>
            <select className={inputCls} value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))}>
              {days.map((d) => (
                <option key={d} value={d}>{fill(t.common_day, { n: d })}</option>
              ))}
            </select>
          </Field>
          <Field label={t.card_dueDay} hint={t.card_dueHint}>
            <select className={inputCls} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
              {days.map((d) => (
                <option key={d} value={d}>{fill(t.common_day, { n: d })}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.card_saveCard}</Button>
        </div>
      </div>
    </Modal>
  );
}

function PurchaseModal({ open, onClose, cards, defaultCardId }: { open: boolean; onClose: () => void; cards: CardView[]; defaultCardId: string | null }) {
  const toast = useToast();
  const { t } = useT();
  const meta = useLiveQuery(() => getFormMeta(), []);
  const [cardId, setCardId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCardId(defaultCardId ?? cards[0]?.id ?? "");
    setAmount(null);
    setDate(todayISO());
    setDescription("");
    setCategoryId("");
    setFormKey((k) => k + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const card = cards.find((c) => c.id === cardId) ?? null;
  const bookedPeriod =
    card && date
      ? dayOfMonth(date) <= Math.min(card.closingDay, daysInMonthKey(monthKey(date)))
        ? monthKey(date)
        : addMonthsKey(monthKey(date), 1)
      : null;

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.addPurchase({
        cardId,
        amountCents: amount ?? 0,
        date,
        description,
        categoryId: categoryId || null,
        createdBy: meta?.members[0]?.id ?? "",
      });
      toast.push(
        "success",
        bookedPeriod ? fill(t.card_purchaseBooked, { month: monthNameOf(bookedPeriod) }) : t.card_purchaseSaved
      );
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t.card_newPurchase} subtitle={t.card_purchaseSubtitle}>
      <div className="space-y-4">
        {cards.length > 1 && (
          <Field label={t.nav_cards}>
            <select className={inputCls} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.nickname} ••{c.last4}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t.common_amount}>
          <AmountInput key={`amt-${formKey}`} initialCents={null} onChange={setAmount} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.card_purchaseDate}>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t.common_category}>
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.common_uncategorized}</option>
              {meta?.categories.filter((c) => c.kind === "expense").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t.common_description}>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Restaurant" />
        </Field>
        {bookedPeriod && (
          <p className="rounded-lg bg-steel-100 px-3 py-2 text-[12px] font-medium text-steel-700">
            {fill(t.card_booksInto, { month: monthNameOf(bookedPeriod) })}
            {card ? ` ${fill(t.card_closesDue, { c: card.closingDay, d: card.dueDay })}` : ""}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.card_recordPurchase}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Cards() {
  const toast = useToast();
  const { t } = useT();
  const cards = useLiveQuery(() => getCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardModal, setCardModal] = useState<{ open: boolean; preset?: CardView | null }>({ open: false });
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [pay, setPay] = useState<{ card: CardView | null; statement: StatementView | null }>({ card: null, statement: null });
  const [pendingPurchase, setPendingPurchase] = useState<{ id: string; description: string } | null>(null);

  useEffect(() => {
    if (!selectedId && cards && cards.length > 0) setSelectedId(cards[0].id);
  }, [cards, selectedId]);

  if (!cards) {
    return (
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-72 rounded-xl xl:col-span-5" />
        <Skeleton className="h-72 rounded-xl xl:col-span-7" />
      </div>
    );
  }

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  return (
    <div className="space-y-5">
      <section data-tour="page-cards" className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-[12.5px] leading-relaxed text-inksoft">{t.card_intro}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPurchaseModal(true)} disabled={cards.length === 0}>
            <IPlus size={15} /> {t.card_purchaseBtn}
          </Button>
          <Button onClick={() => setCardModal({ open: true })}>
            <IPlus size={15} /> {t.card_cardBtn}
          </Button>
        </div>
      </section>

      {cards.length === 0 ? (
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <EmptyState
            icon={<ICard size={22} />}
            title={t.card_noCardsTitle}
            body={t.card_noCardsBody}
            action={<Button onClick={() => setCardModal({ open: true })}><IPlus size={15} /> {t.card_addCard}</Button>}
          />
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <Reveal className="xl:col-span-5">
            <div className="space-y-4">
              {cards.map((c) => (
                <div key={c.id} className="group">
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cls(
                      "relative block w-full overflow-hidden rounded-xl bg-pine-900 p-5 text-left text-pine-50 shadow-md transition-all duration-200",
                      selected?.id === c.id ? "ring-2 ring-gold-600 ring-offset-2 ring-offset-paper" : "hover:-translate-y-0.5 hover:shadow-lg"
                    )}
                  >
                    <svg className="pointer-events-none absolute -right-10 -top-16 opacity-[0.16]" width="220" height="220" viewBox="0 0 220 220" fill="none" aria-hidden="true">
                      <circle cx="110" cy="110" r="60" stroke="#8FBA9B" strokeWidth="1.5" />
                      <circle cx="110" cy="110" r="85" stroke="#8FBA9B" strokeWidth="1.5" />
                      <circle cx="110" cy="110" r="108" stroke="#8FBA9B" strokeWidth="1.5" />
                    </svg>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-pine-200">{c.issuer}</span>
                      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
                        <rect x="1" y="1" width="28" height="20" rx="4" fill="none" stroke="#C99B3F" strokeWidth="1.6" />
                        <path d="M1 8h28M10 1v20M20 1v20" stroke="#C99B3F" strokeWidth="1" opacity="0.6" />
                      </svg>
                    </div>
                    <p className="num mt-6 text-[19px] font-semibold tracking-[0.08em]">
                      •••• •••• •••• {c.last4}
                    </p>
                    <p className="mt-0.5 text-[12px] text-pine-200">{c.nickname}</p>
                  </button>
                  <div className="mt-2.5 px-1">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-inkfaint">
                        {fill(t.card_availableOf, { a: fmtCents(c.availableCents), l: fmtCents(c.limitCents) })}
                      </span>
                      <span className="num font-semibold text-steel-700">{fill(t.card_pctUsed, { pct: c.usedPct })}</span>
                    </div>
                    <ProgressBar pct={c.usedPct} tone={c.usedPct > 85 ? "danger" : "steel"} className="mt-1.5" />
                    <div className="mt-1.5 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="sm" onClick={() => setCardModal({ open: true, preset: c })}>{t.common_edit}</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-rust-600 hover:!bg-rust-100"
                        onClick={async () => {
                          try {
                            await uc.deleteCard(c.id);
                            toast.push("success", t.card_deleted);
                            if (selectedId === c.id) setSelectedId(null);
                          } catch (e) {
                            toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
                          }
                        }}
                      >
                        {t.common_delete}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal className="xl:col-span-7" delay={80}>
            {selected && (
              <div className="space-y-4">
                {selected.statements.length === 0 ? (
                  <section className="rounded-xl border border-line bg-surface shadow-sm">
                    <EmptyState
                      icon={<ICard size={22} />}
                      title={t.card_noPurchases}
                      body={fill(t.card_noPurchasesBody, { name: selected.nickname, last4: selected.last4 })}
                      action={<Button variant="soft" onClick={() => setPurchaseModal(true)}><IPlus size={15} /> {t.card_recordPurchase}</Button>}
                    />
                  </section>
                ) : (
                  selected.statements.map((s) => (
                    <section key={s.period} className="rounded-xl border border-line bg-surface shadow-sm">
                      <header className="flex flex-wrap items-center gap-2 border-b border-linesoft px-4 py-3">
                        <h3 className="font-display text-[15px] font-bold tracking-tight">{monthNameOf(s.period)}</h3>
                        {s.status === "paid" && <Badge tone="ok">{t.card_paid}</Badge>}
                        {s.status === "open" && <Badge tone="steel">{fill(t.card_dueOn, { d: fmtDate(s.dueDate) })}</Badge>}
                        {s.status === "overdue" && <Badge tone="danger" pulse>{fill(t.card_overdueWas, { d: fmtDate(s.dueDate) })}</Badge>}
                        <span className="ml-auto text-[11px] text-inkfaint">{fill(t.card_closedOn, { d: fmtDate(s.closeDate) })}</span>
                      </header>
                      <div className="grid grid-cols-3 gap-2 px-4 py-3">
                        <div>
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_total}</p>
                          <p className="num text-[15px] font-semibold">{fmtCents(s.totalCents)}</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_paidLabel}</p>
                          <p className="num text-[15px] font-semibold text-pine-700">{fmtCents(s.paidCents)}</p>
                        </div>
                        <div>
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-inkfaint">{t.card_remaining}</p>
                          <p className={cls("num text-[15px] font-semibold", s.remainingCents > 0 ? "text-rust-600" : "text-inksoft")}>
                            {fmtCents(s.remainingCents)}
                          </p>
                        </div>
                      </div>
                      <ul className="divide-y divide-linesoft border-t border-linesoft">
                        {s.purchases.map((p) => (
                          <li key={p.id} className="group/p flex items-center gap-3 px-4 py-2">
                            <span className="num w-14 shrink-0 text-[11.5px] text-inkfaint">{fmtDate(p.date)}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p.description}</span>
                            {p.categoryName && (
                              <span className="hidden items-center gap-1 text-[11px] text-inkfaint sm:inline-flex">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.categoryColor ?? "#8B968C" }} />
                                {p.categoryName}
                              </span>
                            )}
                            <span className="num text-[13px] font-semibold">{fmtCents(p.amountCents)}</span>
                            <IconBtn
                              label={t.card_deletePurchaseLabel}
                              danger
                              className="opacity-0 group-hover/p:opacity-100"
                              onClick={() => setPendingPurchase({ id: p.id, description: p.description })}
                            >
                              <ITrash size={14} />
                            </IconBtn>
                          </li>
                        ))}
                      </ul>
                      {s.remainingCents > 0 && (
                        <footer className="flex justify-end border-t border-linesoft px-4 py-2.5">
                          <Button size="sm" variant="primary" onClick={() => setPay({ card: selected, statement: s })}>
                            {fill(t.card_payAmount, { v: fmtCents(s.remainingCents) })}
                          </Button>
                        </footer>
                      )}
                    </section>
                  ))
                )}
              </div>
            )}
          </Reveal>
        </div>
      )}

      <CardModal open={cardModal.open} onClose={() => setCardModal({ open: false })} preset={cardModal.preset} />
      <PurchaseModal open={purchaseModal} onClose={() => setPurchaseModal(false)} cards={cards} defaultCardId={selectedId} />
      <CardPaymentModal
        open={pay.card !== null}
        onClose={() => setPay({ card: null, statement: null })}
        card={pay.card}
        statement={pay.statement}
      />
      <Confirm
        open={pendingPurchase !== null}
        onClose={() => setPendingPurchase(null)}
        title={t.card_deletePurchaseTitle}
        message={fill(t.card_deletePurchaseMsg, { desc: pendingPurchase?.description ?? "" })}
        onConfirm={async () => {
          if (!pendingPurchase) return;
          await uc.deletePurchase(pendingPurchase.id);
          toast.push("success", t.card_purchaseDeleted);
          setPendingPurchase(null);
        }}
      />
    </div>
  );
}

/**
 * Guided tour — dims the page and walks the household through the ledger
 * workflow, page by page. Presentation only (ADR-001): no financial logic.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fill, useT } from "./i18n";
import { Button, IX, cls } from "./ui";

export const TOUR_KEY = "cfc-tour-v1";

export type PageId = "overview" | "transactions" | "accounts" | "cards" | "recurring" | "loans";

interface Step {
  page: PageId;
  target: string;
  title: string;
  body: string;
}

export const hasSeenTour = (): boolean => {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // no storage (private mode) — do not nag on every visit
  }
};

export const markTourSeen = (): void => {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* private mode */
  }
};

/** Demo reset restarts the guided flow. */
export const resetTour = (): void => {
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    /* private mode */
  }
};

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Where the card goes around the highlighted box, clamped to the viewport. */
export function placeCard(
  box: Rect,
  card: { width: number; height: number },
  vp: { width: number; height: number }
): { top: number; left: number; placement: "below" | "above" } {
  const gap = 12;
  const pad = 12;
  const below = box.top + box.height + gap;
  const above = box.top - gap - card.height;
  const placement = below + card.height > vp.height - pad && above > pad ? "above" : "below";
  const top = Math.max(pad, Math.min(placement === "below" ? below : above, vp.height - card.height - pad));
  const left = Math.max(
    pad,
    Math.min(box.left + box.width / 2 - card.width / 2, vp.width - card.width - pad)
  );
  return { top, left, placement };
}

const sameRect = (a: Rect | null, b: Rect): boolean =>
  !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

export function Tour({
  open,
  page,
  onNavigate,
  onClose,
}: {
  open: boolean;
  page: PageId;
  onNavigate: (page: PageId) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [ring, setRing] = useState<{ i: number; rect: Rect } | null>(null);
  const [card, setCard] = useState({ width: 0, height: 0 });
  const [vp, setVp] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef("");
  // Adjusting state during render (instead of an effect) keeps the reset synchronous.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setI(0);
  }
  const box = ring && ring.i === i ? ring.rect : null;

  const steps = useMemo<Step[]>(
    () => [
      { page: "overview", target: "shell-head", title: t.tour_s1_title, body: t.tour_s1_body },
      { page: "overview", target: "quick-add", title: t.tour_s2_title, body: t.tour_s2_body },
      { page: "overview", target: "dash-position", title: t.tour_s3_title, body: t.tour_s3_body },
      { page: "transactions", target: "tx-filters", title: t.tour_s4_title, body: t.tour_s4_body },
      { page: "accounts", target: "page-accounts", title: t.tour_s5_title, body: t.tour_s5_body },
      { page: "cards", target: "page-cards", title: t.tour_s6_title, body: t.tour_s6_body },
      { page: "recurring", target: "page-plans", title: t.tour_s7_title, body: t.tour_s7_body },
      { page: "loans", target: "page-loans", title: t.tour_s8_title, body: t.tour_s8_body },
    ],
    [t]
  );

  const applyBox = useCallback((stepIndex: number, r: Rect) => {
    setRing((prev) =>
      prev && prev.i === stepIndex && sameRect(prev.rect, r) ? prev : { i: stepIndex, rect: r }
    );
  }, []);

  const finish = useCallback(() => {
    markTourSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const on = (): void => setVp({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [open]);

  // Measure the current target, switching pages first when the step lives elsewhere.
  useEffect(() => {
    if (!open) return;
    const step = steps[i];
    if (!step) return;
    targetRef.current = step.target;
    if (step.page !== page) {
      onNavigate(step.page);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const deadline = performance.now() + 5000;
    let raf = 0;
    const measure = (): void => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        if (performance.now() < deadline) raf = requestAnimationFrame(measure);
        return;
      }
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
      applyBox(i, el.getBoundingClientRect());
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [open, i, page, steps, onNavigate, applyBox]);

  // Keep the ring glued to the target while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const remeasure = (): void => {
      if (!targetRef.current) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${targetRef.current}"]`);
      if (el) applyBox(i, el.getBoundingClientRect());
    };
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [open, i, applyBox]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCard((c) => (c.width === r.width && c.height === r.height ? c : { width: r.width, height: r.height }));
  }, [open, i, vp]);

  useLayoutEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open, i]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") setI((n) => (n >= steps.length - 1 ? n : n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length, finish]);

  if (!open) return null;
  const step = steps[i];
  if (!step) return null;

  const last = i === steps.length - 1;
  const mobile = vp.width < 640;
  const pos = box && !mobile ? placeCard(box, card, vp) : null;
  const cardStyle = mobile
    ? undefined
    : pos
      ? { top: pos.top, left: pos.left }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={finish} aria-hidden="true" />
      {box && (
        <div
          className="tour-ring fixed z-[71] rounded-xl"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className={cls(
          "pop-in fixed z-[72] rounded-xl border border-line bg-surface p-4 shadow-2xl outline-none",
          mobile ? "inset-x-3 bottom-3" : "w-[336px]"
        )}
        style={cardStyle}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="num text-[10.5px] font-bold uppercase tracking-[0.14em] text-inkfaint">
            {fill(t.tour_step, { n: i + 1, total: steps.length })}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label={t.common_close}
            className="rounded-md p-1 text-inkfaint transition-colors hover:bg-linesoft hover:text-ink"
          >
            <IX size={14} />
          </button>
        </div>
        <h2 id="tour-title" className="font-display text-[15.5px] font-bold tracking-tight text-ink">
          {step.title}
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-inksoft">{step.body}</p>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-[12px] font-semibold text-inkfaint underline decoration-line underline-offset-2 transition-colors hover:text-ink"
          >
            {t.tour_skip}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>
                {t.tour_back}
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? t.tour_done : t.tour_next}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

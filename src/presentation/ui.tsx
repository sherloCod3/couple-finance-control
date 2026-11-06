/**
 * Shared presentation kit: formatting, hooks, icons, primitives, toasts.
 * Pure display + interaction — no financial math lives here (ADR-001).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TxView } from "../application/queries";
import { moneyFormatter, uiLocaleCode, useT } from "./i18n";

// ---------- formatting (display only — never used for math) ---------------

export const fmtCents = (cents: number): string => moneyFormatter().format(cents / 100);

export const fmtSignedCents = (cents: number): string =>
  cents > 0 ? `+${moneyFormatter().format(cents / 100)}` : moneyFormatter().format(cents / 100);

export const fmtCompact = (cents: number): string => {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "−" : "";
  if (abs >= 100_000) return `${sign}R$${(abs / 100_000).toFixed(1)}k`;
  return `${sign}${moneyFormatter().format(cents / 100)}`;
};

export const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(uiLocaleCode(), { month: "short", day: "numeric" });
};

export const fmtDateLong = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(uiLocaleCode(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/** Boundary parser for typed amounts → integer cents, or null when invalid. */
export const parseAmountInput = (raw: string): number | null => {
  const clean = raw.replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(".") ? clean.replace(/,/g, "") : clean.replace(",", ".");
  if (!/^-?\d*(\.\d{0,2})?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
};

// ---------- hooks -----------------------------------------------------------

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  useEffect(() => {
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useCountUp(target: number, duration = 750): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number): void => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, duration]);
  return value;
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -24px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${className ?? ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ---------- icons -----------------------------------------------------------

export interface IconProps {
  size?: number;
  className?: string;
}

const make =
  (node: ReactNode) =>
  ({ size = 18, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {node}
    </svg>
  );

export const IGrid = make(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>);
export const IList = make(<><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></>);
export const IWallet = make(<><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9" /><path d="M3 7.5V17a2.5 2.5 0 0 0 2.5 2.5h13A2.5 2.5 0 0 0 21 17v-5.5A2.5 2.5 0 0 0 18.5 9H5.5A2.5 2.5 0 0 1 3 7.5Z" /><circle cx="16.5" cy="14.25" r="1" fill="currentColor" stroke="none" /></>);
export const ICard = make(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 15h4" /></>);
export const IRepeat = make(<><path d="M17 2.5 21 6l-4 3.5" /><path d="M21 6H8a4.5 4.5 0 0 0-4.5 4.5" /><path d="M7 21.5 3 18l4-3.5" /><path d="M3 18h13a4.5 4.5 0 0 0 4.5-4.5" /></>);
export const IScale = make(<><path d="M12 3v18" /><path d="M5 21h14" /><path d="M4 7h16" /><path d="M6.5 7 4 12.5a2.8 2.8 0 0 0 5 0L6.5 7Z" /><path d="M17.5 7 15 12.5a2.8 2.8 0 0 0 5 0L17.5 7Z" /></>);
export const IPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IX = make(<><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>);
export const ICheck = make(<path d="m4.5 12.5 5 5 10-11" />);
export const IPencil = make(<><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" /><path d="m14.5 7 3 3" /></>);
export const ITrash = make(<><path d="M4 7h16" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8L17.5 7" /><path d="M10 11v6M14 11v6" /></>);
export const ISwap = make(<><path d="M7 3.5 3.5 7 7 10.5" /><path d="M3.5 7h13a4 4 0 0 1 4 4" /><path d="m17 13.5 3.5 3.5-3.5 3.5" /><path d="M20.5 17h-13a4 4 0 0 1-4-4" /></>);
export const ISearch = make(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>);
export const ICopy = make(<><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 5.5v-1a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" transform="translate(1,1)" /></>);
export const IAlert = make(<><path d="M12 3.5 1.9 20.5h20.2L12 3.5Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" /></>);
export const IInfo = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" /></>);
export const ICloudOff = make(<><path d="M6.5 18.5h11a4 4 0 0 0 .8-7.9 6 6 0 0 0-11.5 1.6" /><path d="M6.5 18.5a3.5 3.5 0 0 1-.4-7" /><path d="m3 3 18 18" /></>);
export const IDownload = make(<><path d="M12 3v11" /><path d="m7.5 10 4.5 4.5L16.5 10" /><path d="M4 20h16" /></>);
export const IKey = make(<><circle cx="8" cy="15.5" r="4.5" /><path d="m11.5 12.5 8-8" /><path d="M16 8l2.5 2.5" /><path d="M19 5l1.5 1.5" /></>);
export const IUsers = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /><path d="M17.8 14.6A6.5 6.5 0 0 1 21.5 20" /></>);
export const ITrendUp = make(<><path d="m3.5 17 5.5-5.5 3.5 3.5 7.5-8" /><path d="M14.5 7h5.5v5.5" /></>);
export const ITrendDown = make(<><path d="m3.5 7 5.5 5.5 3.5-3.5 7.5 8" /><path d="M14.5 17h5.5v-5.5" /></>);
export const ICalendar = make(<><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /></>);
export const IArrowRight = make(<><path d="M4 12h15" /><path d="m13.5 6.5 5.5 5.5-5.5 5.5" /></>);
export const IBell = make(<><path d="M18 10a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>);
export const IReceipt = make(<><path d="M5 3h14v18l-2.4-1.6L14.2 21l-2.2-1.6L9.8 21l-2.4-1.6L5 21V3Z" /><path d="M9 8h6M9 12h6" /></>);
export const ITag = make(<><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0L3.8 13.3a1 1 0 0 1-.3-.7Z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></>);

export const LogoMark = ({ size = 30 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="19.5" cy="24" r="10" stroke="#C99B3F" strokeWidth="4" />
    <circle cx="28.5" cy="24" r="10" stroke="#8FBA9B" strokeWidth="4" />
  </svg>
);

// ---------- primitives ------------------------------------------------------

export const cls = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "soft" | "ghost" | "danger" | "outline";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-pine-700 text-pine-50 hover:bg-pine-800 active:bg-pine-900 shadow-sm",
    soft: "bg-pine-100 text-pine-800 hover:bg-pine-200 active:bg-pine-300/60",
    ghost: "text-inksoft hover:bg-linesoft hover:text-ink",
    danger: "bg-rust-600 text-white hover:bg-rust-700 active:bg-rust-700",
    outline: "border border-line bg-raise text-ink hover:border-pine-400 hover:text-pine-700",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cls(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "text-[12.5px] px-2.5 py-1.5" : "text-[13.5px] px-3.5 py-2",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  label,
  danger,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cls(
        "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
        danger ? "text-inkfaint hover:text-rust-600 hover:bg-rust-100" : "text-inkfaint hover:text-pine-700 hover:bg-pine-100",
        className
      )}
    >
      {children}
    </button>
  );
}

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "steel" | "gold";

export function Badge({ tone = "neutral", children, pulse }: { tone?: BadgeTone; children: ReactNode; pulse?: boolean }) {
  const tones: Record<BadgeTone, string> = {
    ok: "bg-pine-100 text-pine-800",
    warn: "bg-gold-100 text-gold-700",
    danger: "bg-rust-100 text-rust-700",
    neutral: "bg-linesoft text-inksoft",
    steel: "bg-steel-100 text-steel-700",
    gold: "bg-gold-100 text-gold-700",
  };
  return (
    <span className={cls("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold tracking-wide", tones[tone])}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />}
      {children}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cls(
        "relative h-[22px] w-10 rounded-full transition-colors duration-200 shrink-0",
        on ? "bg-pine-600" : "bg-line"
      )}
    >
      <span
        className={cls(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200",
          on ? "left-[21px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-[13.5px] text-ink placeholder:text-inkfaint/70 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-200 transition-shadow";

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string | null; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-inkfaint">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11.5px] text-inkfaint">{hint}</span>}
      {error && <span className="mt-1 block text-[11.5px] font-medium text-rust-600">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-linesoft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cls(
            "flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-semibold transition-all duration-150",
            value === o.value ? "bg-raise text-pine-800 shadow-sm" : "text-inksoft hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Amount field. Initializes once per mount (parents key it per dialog open)
 * and reports integer cents upward — never floats.
 */
export function AmountInput({
  initialCents,
  onChange,
  autoFocus,
}: {
  initialCents: number | null;
  onChange: (cents: number | null) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState<string>(initialCents === null ? "" : (initialCents / 100).toFixed(2));
  const parsed = text.trim() === "" ? null : parseAmountInput(text);
  const invalid = text.trim() !== "" && parsed === null;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-inkfaint">R$</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const p = e.target.value.trim() === "" ? null : parseAmountInput(e.target.value);
          onChange(p);
        }}
        placeholder="0.00"
        className={cls(
          inputCls,
          "num pl-10 text-[19px] font-semibold tracking-tight",
          invalid && "border-rust-600 focus:border-rust-600 focus:ring-rust-100"
        )}
      />
    </div>
  );
}

export function ProgressBar({ pct, tone = "ok", className }: { pct: number; tone?: "ok" | "warn" | "danger" | "steel" | "gold"; className?: string }) {
  const tones = { ok: "bg-pine-500", warn: "bg-gold-600", danger: "bg-rust-600", steel: "bg-steel-600", gold: "bg-gold-600" };
  return (
    <div className={cls("h-2 w-full overflow-hidden rounded-full bg-linesoft", className)}>
      <div
        className={cls("h-full rounded-full transition-all duration-700 ease-out", tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-pine-950/55 fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cls(
          "pop-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface shadow-2xl sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-linesoft bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-inkfaint">{subtitle}</p>}
          </div>
          <IconBtn label={t.common_close} onClick={onClose}>
            <IX size={18} />
          </IconBtn>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[13.5px] leading-relaxed text-inksoft">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
        {/* Resolved here, not as a parameter default, so every caller that omits
            it still gets a translated label. */}
        <Button variant="danger" onClick={onConfirm}>{confirmLabel ?? t.common_delete}</Button>
      </div>
    </Modal>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pine-100 text-pine-600">{icon}</div>
      <p className="font-display text-[15px] font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-inkfaint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cls("skeleton", className)} />;
}

// ---------- toasts ----------------------------------------------------------

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void }>({
  push: () => undefined,
});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setItems((s) => [...s.slice(-3), { id, kind, message }]);
    window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-5">
        {items.map((t) => (
          <div
            key={t.id}
            className={cls(
              "toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-raise px-3.5 py-3 shadow-lg",
              t.kind === "success" && "border-pine-200",
              t.kind === "error" && "border-rust-600/30",
              t.kind === "info" && "border-steel-600/25"
            )}
          >
            <span
              className={cls(
                "mt-0.5 shrink-0",
                t.kind === "success" && "text-pine-600",
                t.kind === "error" && "text-rust-600",
                t.kind === "info" && "text-steel-600"
              )}
            >
              {t.kind === "success" ? <ICheck size={16} /> : t.kind === "error" ? <IAlert size={16} /> : <IInfo size={16} />}
            </span>
            <p className="text-[13px] font-medium leading-snug text-ink">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- transaction row -------------------------------------------------

const kindBubble: Record<TxView["kind"], { cls: string; icon: ReactNode }> = {
  INCOME: { cls: "bg-pine-100 text-pine-700", icon: <ITrendDown size={15} /> },
  EXPENSE: { cls: "bg-rust-100 text-rust-600", icon: <ITrendUp size={15} /> },
  TRANSFER: { cls: "bg-steel-100 text-steel-700", icon: <ISwap size={15} /> },
  ADJUSTMENT: { cls: "bg-gold-100 text-gold-700", icon: <IInfo size={15} /> },
  CARD_PAYMENT: { cls: "bg-steel-100 text-steel-700", icon: <ICard size={15} /> },
};

export function amountDisplay(tx: TxView): { text: string; cls: string } {
  switch (tx.kind) {
    case "INCOME":
      return { text: `+${fmtCents(tx.amountCents)}`, cls: "text-pine-700" };
    case "EXPENSE":
      return { text: `−${fmtCents(tx.amountCents)}`, cls: "text-ink" };
    case "TRANSFER":
      return { text: fmtCents(tx.amountCents), cls: "text-inksoft" };
    case "CARD_PAYMENT":
      return { text: `−${fmtCents(tx.amountCents)}`, cls: "text-steel-700" };
    case "ADJUSTMENT":
      return tx.signedCents < 0
        ? { text: `−${fmtCents(tx.amountCents)}`, cls: "text-gold-700" }
        : { text: `+${fmtCents(tx.amountCents)}`, cls: "text-pine-700" };
  }
}

export function TxRow({
  tx,
  showDate,
  onEdit,
  onDelete,
}: {
  tx: TxView;
  showDate?: boolean;
  onEdit?: (tx: TxView) => void;
  onDelete?: (tx: TxView) => void;
}) {
  const { t } = useT();
  const bubble = kindBubble[tx.kind];
  const amount = amountDisplay(tx);
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-pine-50/70">
      <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bubble.cls)}>
        {bubble.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-ink">{tx.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-inkfaint">
          {tx.categoryName && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tx.categoryColor ?? "#8B968C" }} />
              {tx.categoryName}
            </span>
          )}
          {tx.kind === "TRANSFER" ? (
            <span className="font-medium text-steel-700">
              {tx.fromAccountName} → {tx.toAccountName}
            </span>
          ) : (
            <span>{tx.accountName}</span>
          )}
          {tx.cardLast4 && <span className="text-steel-700">card ••{tx.cardLast4}</span>}
          {tx.recurringDesc && (
            <span className="inline-flex items-center gap-0.5 text-pine-700">
              <IRepeat size={11} /> {t.common_planned}
            </span>
          )}
          <span>· {tx.memberName}</span>
          {showDate && <span className="num">· {fmtDate(tx.date)}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(onEdit || onDelete) && (
          <span className="hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
            {onEdit && (
              <IconBtn label="Edit" onClick={() => onEdit(tx)}>
                <IPencil size={14} />
              </IconBtn>
            )}
            {onDelete && (
              <IconBtn label="Delete" danger onClick={() => onDelete(tx)}>
                <ITrash size={14} />
              </IconBtn>
            )}
          </span>
        )}
        <span className={cls("num text-[13.5px] font-semibold", amount.cls)}>{amount.text}</span>
      </div>
    </div>
  );
}

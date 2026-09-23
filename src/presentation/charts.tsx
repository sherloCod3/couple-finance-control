/** SVG/CSS charts — presentation only; all numbers arrive pre-computed. */
import { useEffect, useState } from "react";
import { cls, fmtCents, fmtCompact } from "./ui";
import { useT } from "./i18n";

export interface BarPoint {
  label: string;
  income: number;
  expenses: number;
  highlight?: boolean;
}

export function BarsChart({ data }: { data: BarPoint[] }) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  return (
    <div>
      <div className="flex h-44 items-end gap-2 sm:gap-4">
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-raise px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block">
              <span className="num font-semibold text-pine-700">+{fmtCompact(d.income)}</span>
              <span className="mx-1 text-inkfaint">/</span>
              <span className="num font-semibold text-rust-600">−{fmtCompact(d.expenses)}</span>
            </div>
            <div className="flex h-[calc(100%-22px)] items-end justify-center gap-1 sm:gap-1.5">
              <div
                className="bar-anim w-3 rounded-t-[3px] bg-pine-500 sm:w-[18px]"
                style={{ height: ready ? `${Math.max(1.5, (d.income / max) * 100)}%` : "1.5%" }}
              />
              <div
                className="bar-anim w-3 rounded-t-[3px] bg-rust-600/80 sm:w-[18px]"
                style={{ height: ready ? `${Math.max(1.5, (d.expenses / max) * 100)}%` : "1.5%" }}
              />
            </div>
            <span
              className={cls(
                "num mt-2 text-center text-[10.5px]",
                d.highlight ? "font-bold text-ink" : "text-inkfaint"
              )}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-linesoft pt-3 text-[11.5px] text-inksoft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-pine-500" /> {t.common_income}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-rust-600/80" /> {t.common_expenses}
        </span>
        <span className="ml-auto hidden text-inkfaint sm:block">{t.dash_chartHint}</span>
      </div>
    </div>
  );
}

export interface DonutSlice {
  id: string | null;
  name: string;
  color: string;
  cents: number;
  sharePct: number;
}

export function Donut({ slices, totalCents }: { slices: DonutSlice[]; totalCents: number }) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const R = 46;
  const C = 2 * Math.PI * R;
  const total = Math.max(1, totalCents);
  // Arc lengths and cumulative offsets are derived up front. Building them with
  // a running accumulator inside the render map would mutate across renders.
  const lens = slices.map((s) => (s.cents / total) * C);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((sum, l) => sum + l, 0));
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[184px]">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-linesoft)" strokeWidth="15" />
      <g transform="rotate(-90 60 60)">
        {slices.map((s, i) => (
          <circle
            key={s.id ?? s.name}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="15"
            className="donut-seg"
            strokeDasharray={`${ready ? lens[i] : 0} ${C}`}
            strokeDashoffset={-offsets[i]}
          >
            <title>{`${s.name}: ${fmtCents(s.cents)}`}</title>
          </circle>
        ))}
      </g>
      <text
        x="60"
        y="58"
        textAnchor="middle"
        className="num"
        style={{ fontSize: 15, fontWeight: 700, fill: "var(--color-ink)" }}
      >
        {fmtCompact(totalCents)}
      </text>
      <text x="60" y="72" textAnchor="middle" style={{ fontSize: 8, fill: "var(--color-inkfaint)" }}>
        {t.dash_donutTotal}
      </text>
    </svg>
  );
}

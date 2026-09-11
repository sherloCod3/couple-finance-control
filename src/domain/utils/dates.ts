/** Pure date helpers. All domain dates are local ISO strings `YYYY-MM-DD`. */

const pad = (n: number): string => String(n).padStart(2, "0");

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (): string => toISO(new Date());

export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDaysISO = (iso: string, days: number): string => {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const currentMonthKey = (): string => monthKey(todayISO());

export const addMonthsKey = (ym: string, n: number): string => {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}`;
};

export const daysInMonthKey = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/** ISO date inside `ym` with the day clamped to the month length. */
export const isoWithDay = (ym: string, day: number): string =>
  `${ym}-${pad(Math.min(Math.max(day, 1), daysInMonthKey(ym)))}`;

export const dayOfMonth = (iso: string): number => Number(iso.slice(8, 10));

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const weekdayOf = (iso: string): number => {
  const js = parseISO(iso).getDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
};

export const daysBetween = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);

export const compareISO = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const shortMonthLabel = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
};

/**
 * Couple Finance Control — application shell.
 * Navigation, language, reminders, PWA install prompt, offline indicator,
 * quick add, backup export/import and demo reset.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDashboard, getHousehold } from "./application/queries";
import { exportBackup, importBackup } from "./application/backup";
import * as uc from "./application/useCases";
import {
  Button,
  Confirm,
  ICard,
  IBell,
  ICloudOff,
  IDownload,
  IGrid,
  IList,
  IPlus,
  IRepeat,
  IScale,
  IWallet,
  LogoMark,
  ToastProvider,
  cls,
  fmtCents,
  fmtDate,
  useOnline,
  useToast,
  type IconProps,
} from "./presentation/ui";
import { LangProvider, daysUntil, relDueT, useT, type Lang } from "./presentation/i18n";
import { TransactionModal } from "./presentation/actions";
import Dashboard from "./presentation/pages/Dashboard";
import Transactions from "./presentation/pages/Transactions";
import Accounts from "./presentation/pages/Accounts";
import CardsPage from "./presentation/pages/Cards";
import Recurring from "./presentation/pages/Recurring";
import Loans from "./presentation/pages/Loans";

type PageId = "overview" | "transactions" | "accounts" | "cards" | "recurring" | "loans";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const UploadIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V4" />
    <path d="m7.5 8 4.5-4.5L16.5 8" />
    <path d="M4 20h16" />
  </svg>
);

/** Declared at module scope: a component created inside render loses state on
 *  every pass and remounts its subtree (see react-hooks/static-components). */
function LangBtn({
  value,
  label,
  current,
  onSelect,
}: {
  value: Lang;
  label: string;
  current: Lang;
  onSelect: (lang: Lang) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={current === value}
      className={cls(
        "num rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
        current === value ? "bg-pine-700 text-pine-50" : "text-pine-300 hover:bg-pine-900 hover:text-pine-100"
      )}
    >
      {label}
    </button>
  );
}

function RemindersBell({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useT();
  const dash = useLiveQuery(() => getDashboard(), []);
  const [open, setOpen] = useState(false);
  const items = [...(dash?.position.overdue ?? []), ...(dash?.position.upcoming ?? [])].slice(0, 6);
  const count = (dash?.position.overdue.length ?? 0) + (dash?.position.upcoming.length ?? 0);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t.shell_reminders}
        title={t.shell_reminders}
        onClick={() => setOpen(!open)}
        className={cls(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
          open ? "border-pine-400 bg-pine-100 text-pine-800" : "border-line bg-raise text-inksoft hover:border-pine-400 hover:text-pine-700"
        )}
      >
        <IBell size={16} />
        {count > 0 && (
          <span
            className={cls(
              "num absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              (dash?.position.overdue.length ?? 0) > 0 ? "bg-rust-600" : "bg-gold-600"
            )}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop-in absolute right-0 top-11 z-50 w-[320px] rounded-xl border border-line bg-surface shadow-xl">
            <p className="border-b border-linesoft px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-inkfaint">
              {t.shell_reminders}
            </p>
            {items.length === 0 ? (
              <p className="px-4 py-4 text-[12.5px] text-inksoft">{t.shell_noReminders}</p>
            ) : (
              <ul className="max-h-[300px] divide-y divide-linesoft overflow-y-auto">
                {items.map((o) => (
                  <li key={o.key} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className={cls("h-1.5 w-1.5 shrink-0 rounded-full", o.status === "overdue" ? "bg-rust-600 pulse-dot" : "bg-gold-600")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{o.title}</p>
                      <p className={cls("text-[11px]", o.status === "overdue" ? "font-semibold text-rust-600" : "text-inkfaint")}>
                        {fmtDate(o.dueDate)} · {relDueT(daysUntil(o.dueDate), t)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-[12px] font-semibold text-ink">{fmtCents(o.amount.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
              className="w-full border-t border-linesoft px-4 py-2.5 text-left text-[12px] font-semibold text-pine-700 transition-colors hover:bg-pine-50"
            >
              {t.shell_openOverview} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Shell() {
  const toast = useToast();
  const { t, lang, setLang } = useT();
  const online = useOnline();
  const household = useLiveQuery(() => getHousehold(), []);
  const [page, setPage] = useState<PageId>("overview");
  const [quickAdd, setQuickAdd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const NAV: { id: PageId; label: string; Icon: (p: IconProps) => ReactElement }[] = [
    { id: "overview", label: t.nav_overview, Icon: IGrid },
    { id: "transactions", label: t.nav_activity, Icon: IList },
    { id: "accounts", label: t.nav_accounts, Icon: IWallet },
    { id: "cards", label: t.nav_cards, Icon: ICard },
    { id: "recurring", label: t.nav_plans, Icon: IRepeat },
    { id: "loans", label: t.nav_loans, Icon: IScale },
  ];

  const TITLES: Record<PageId, { title: string; sub: string }> = {
    overview: { title: t.nav_overview, sub: t.sub_overview },
    transactions: { title: t.nav_activity, sub: t.sub_activity },
    accounts: { title: t.nav_accounts, sub: t.sub_accounts },
    cards: { title: t.nav_cards, sub: t.sub_cards },
    recurring: { title: t.nav_plans, sub: t.sub_plans },
    loans: { title: t.nav_loans, sub: t.sub_loans },
  };

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const doInstall = async (): Promise<void> => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  const doReset = async (): Promise<void> => {
    setConfirmReset(false);
    await uc.resetDemoData();
    window.setTimeout(() => window.location.reload(), 400);
  };

  const doExport = async (): Promise<void> => {
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `couple-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push("success", t.shell_exportOk);
    } catch {
      toast.push("error", t.shell_importBad);
    }
  };

  const doImport = async (file: File | null): Promise<void> => {
    if (!file) return;
    try {
      await importBackup(await file.text());
      toast.push("success", t.shell_importOk);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      toast.push("error", t.shell_importBad);
    }
  };

  return (
    <div className="min-h-screen">
      {/* ---------- sidebar (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-pine-900 bg-pine-950 lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-7 pt-6">
          <LogoMark size={30} />
          <div>
            <p className="font-display text-[15px] font-bold leading-tight text-pine-50">Couple Finance</p>
            <p className="num text-[9px] uppercase tracking-[0.26em] text-pine-300">control</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={cls(
                "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-all duration-150",
                page === id
                  ? "bg-pine-800 text-pine-50 shadow-inner"
                  : "text-pine-200/80 hover:bg-pine-900 hover:text-pine-50"
              )}
            >
              <span className={cls("h-4 w-0.5 rounded-full transition-all", page === id ? "bg-gold-600" : "bg-transparent group-hover:bg-pine-700")} />
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-3 px-3 pb-4">
          {installEvt && (
            <button
              type="button"
              onClick={doInstall}
              className="flex w-full items-center gap-2 rounded-lg bg-gold-600/15 px-3 py-2 text-[12.5px] font-semibold text-gold-100 transition-colors hover:bg-gold-600/25"
            >
              <IDownload size={15} /> {t.shell_install}
            </button>
          )}
          <div className="rounded-lg bg-pine-900/80 px-3.5 py-3">
            <p className="text-[12.5px] font-bold text-pine-50">{household?.name ?? "Household"}</p>
            <div className="mt-1.5 flex items-center">
              {(household?.members ?? []).map((m, i) => (
                <span
                  key={m.id}
                  title={m.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-pine-900 text-[11px] font-bold text-white"
                  style={{ background: m.color, marginLeft: i === 0 ? 0 : -8 }}
                >
                  {m.name.slice(0, 1)}
                </span>
              ))}
              <span className="ml-2 text-[11px] text-pine-300">
                {(household?.members ?? []).map((m) => m.name).join(" & ") || "…"}
              </span>
            </div>
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-pine-300/90">{t.shell_demo}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-pine-900/60 px-2 py-1.5">
            <span className="px-1 text-[10.5px] font-bold uppercase tracking-wide text-pine-300">{t.shell_lang}</span>
            <div className="flex gap-1">
              <LangBtn value="en" label="EN" current={lang} onSelect={setLang} />
              <LangBtn value="pt-BR" label="PT" current={lang} onSelect={setLang} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <button type="button" onClick={doExport} className="inline-flex items-center gap-1 text-[11px] font-medium text-pine-300 underline decoration-pine-700 underline-offset-2 transition-colors hover:text-pine-50">
              <IDownload size={12} /> {t.shell_export}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-pine-300 underline decoration-pine-700 underline-offset-2 transition-colors hover:text-pine-50">
              <UploadIcon size={12} /> {t.shell_import}
            </button>
          </div>
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-[11px] font-medium text-pine-300 underline decoration-pine-700 underline-offset-2 transition-colors hover:text-pine-50"
            >
              {t.shell_resetDemo}
            </button>
            <span className="num text-[10px] text-pine-400/70">v1.0</span>
          </div>
        </div>
      </aside>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void doImport(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {/* ---------- main ---------- */}
      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 lg:px-8">
            <span className="lg:hidden">
              <LogoMark size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display truncate text-[17px] font-bold tracking-tight text-ink">
                {TITLES[page].title}
              </h1>
              <p className="hidden text-[11px] text-inkfaint sm:block">{TITLES[page].sub}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {!online && (
                <span className="hidden items-center gap-1.5 rounded-md bg-gold-100 px-2.5 py-1.5 text-[11.5px] font-semibold text-gold-700 sm:inline-flex">
                  <ICloudOff size={13} /> {t.shell_offline}
                </span>
              )}
              <div className="flex overflow-hidden rounded-lg border border-line lg:hidden">
                <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} className={cls("num px-2 py-1.5 text-[11px] font-bold transition-colors", lang === "en" ? "bg-pine-700 text-pine-50" : "bg-raise text-inksoft")}>EN</button>
                <button type="button" aria-pressed={lang === "pt-BR"} onClick={() => setLang("pt-BR")} className={cls("num px-2 py-1.5 text-[11px] font-bold transition-colors", lang === "pt-BR" ? "bg-pine-700 text-pine-50" : "bg-raise text-inksoft")}>PT</button>
              </div>
              <RemindersBell onNavigate={() => setPage("overview")} />
              <Button onClick={() => setQuickAdd(true)}>
                <IPlus size={15} /> <span className="hidden sm:inline">{t.shell_addEntry}</span>
                <span className="sm:hidden">{t.common_new}</span>
              </Button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className={cls(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  page === id ? "bg-pine-700 text-pine-50" : "text-inksoft hover:bg-linesoft"
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="page-bg">
          <div className="mx-auto max-w-[1180px] px-4 py-5 pb-16 lg:px-8 lg:py-7">
            {page === "overview" && <Dashboard onNavigate={(p) => setPage(p as PageId)} />}
            {page === "transactions" && <Transactions />}
            {page === "accounts" && <Accounts />}
            {page === "cards" && <CardsPage />}
            {page === "recurring" && <Recurring />}
            {page === "loans" && <Loans />}
          </div>
        </main>
      </div>

      <TransactionModal open={quickAdd} onClose={() => setQuickAdd(false)} />
      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        title={t.shell_resetTitle}
        message={t.shell_resetMsg}
        confirmLabel={t.shell_resetDemo}
      />
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </LangProvider>
  );
}



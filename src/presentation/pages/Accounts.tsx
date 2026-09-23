/** FIN-02 accounts + FIN-03 PIX keys (accounts and contacts). */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAccounts, getContacts, type AccountView, type ContactView } from "../../application/queries";
import * as uc from "../../application/useCases";
import { todayISO } from "../../domain/utils/dates";
import {
  AmountInput,
  Badge,
  Button,
  Confirm,
  Field,
  IKey,
  IPlus,
  IUsers,
  IWallet,
  IconBtn,
  Modal,
  Reveal,
  Segmented,
  Skeleton,
  fmtCents,
  fmtDate,
  inputCls,
  useToast,
} from "../ui";
import { fill, useT, type Dict } from "../i18n";

const TYPE_LABEL = (type: string, t: Dict): string => {
  switch (type) {
    case "checking": return t.acct_checking;
    case "savings": return t.acct_savings;
    case "wallet": return t.acct_wallet;
    default: return t.acct_other;
  }
};

const KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;

function AccountModal({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: AccountView | null;
}) {
  const toast = useToast();
  const { t } = useT();
  const [institution, setInstitution] = useState(preset?.institution ?? "");
  const [nickname, setNickname] = useState(preset?.nickname ?? "");
  const [type, setType] = useState<"checking" | "savings" | "wallet" | "other">(
    (preset?.type as "checking") ?? "checking"
  );
  const [last4, setLast4] = useState(preset?.last4 ?? "");
  const [opening, setOpening] = useState<number | null>(preset?.openingCents ?? null);
  const [openingDate, setOpeningDate] = useState(preset?.openingDate ?? todayISO());
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setInstitution(preset?.institution ?? "");
    setNickname(preset?.nickname ?? "");
    setType((preset?.type as "checking") ?? "checking");
    setLast4(preset?.last4 ?? "");
    setOpening(preset?.openingCents ?? null);
    setOpeningDate(preset?.openingDate ?? todayISO());
    setKey((k) => k + 1);
  }
  if (!open && seen) setSeen(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.saveAccount({
        id: preset?.id,
        institution,
        nickname,
        type,
        last4: last4 || null,
        openingCents: opening ?? 0,
        openingDate,
      });
      toast.push("success", preset ? t.acct_updated : t.acct_added);
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={preset ? t.acct_editAccount : t.acct_newAccount} subtitle={t.acct_balancesDerived}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.acct_institution}>
            <input className={inputCls} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Banco Demo" />
          </Field>
          <Field label={t.acct_nickname}>
            <input className={inputCls} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Checking" />
          </Field>
        </div>
        <Field label={t.acct_type}>
          <Segmented
            options={[
              { value: "checking", label: t.acct_checking },
              { value: "savings", label: t.acct_savings },
              { value: "wallet", label: t.acct_wallet },
              { value: "other", label: t.acct_other },
            ]}
            value={type}
            onChange={setType}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.acct_last4} hint={t.acct_last4Hint}>
            <input
              className={`${inputCls} num`}
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
              placeholder="1234"
            />
          </Field>
          <Field label={t.acct_openingDate}>
            <input type="date" className={inputCls} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t.acct_openingBalance} hint={t.acct_openingHint}>
          <AmountInput key={`amt-${key}`} initialCents={preset?.openingCents ?? null} onChange={setOpening} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.acct_saveAccount}</Button>
        </div>
      </div>
    </Modal>
  );
}

function PixKeyModal({
  open,
  onClose,
  accounts,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountView[];
  contacts: ContactView[];
}) {
  const toast = useToast();
  const { t } = useT();
  const [ownerKind, setOwnerKind] = useState<"account" | "contact">("account");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [keyType, setKeyType] = useState<(typeof KEY_TYPES)[number]>("email");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await uc.savePixKey({
        type: keyType,
        value,
        accountId: ownerKind === "account" ? accountId || accounts[0]?.id || null : null,
        contactId: ownerKind === "contact" ? contactId || contacts[0]?.id || null : null,
      });
      toast.push("success", t.acct_pixSaved);
      setValue("");
      onClose();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t.acct_newPixKey} subtitle={t.acct_pixHint}>
      <div className="space-y-4">
        <Field label={t.acct_owner}>
          <Segmented
            options={[
              { value: "account", label: t.acct_account },
              { value: "contact", label: t.acct_contact },
            ]}
            value={ownerKind}
            onChange={setOwnerKind}
          />
        </Field>
        {ownerKind === "account" ? (
          <Field label={t.acct_account}>
            <select className={inputCls} value={accountId || accounts[0]?.id || ""} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nickname}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={t.acct_contact}>
            <select className={inputCls} value={contactId || contacts[0]?.id || ""} onChange={(e) => setContactId(e.target.value)}>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label={t.acct_keyType}>
            <select className={inputCls} value={keyType} onChange={(e) => setKeyType(e.target.value as (typeof KEY_TYPES)[number])}>
              {KEY_TYPES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label={t.acct_keyValue}>
            <input className={`${inputCls} num`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="demo@example.com" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t.common_cancel}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t.common_saving : t.acct_saveKey}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Accounts() {
  const toast = useToast();
  const { t } = useT();
  const accounts = useLiveQuery(() => getAccounts(), []);
  const contacts = useLiveQuery(() => getContacts(), []);
  const [accountModal, setAccountModal] = useState<{ open: boolean; preset?: AccountView | null }>({ open: false });
  const [keyModal, setKeyModal] = useState(false);
  const [contactName, setContactName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AccountView | null>(null);

  const total = (accounts ?? []).reduce((a, x) => a + x.balanceCents, 0);

  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      toast.push("info", t.acct_copied);
    } catch {
      toast.push("error", t.acct_clipboardErr);
    }
  };

  const addContact = async (): Promise<void> => {
    try {
      await uc.saveContact({ name: contactName });
      setContactName("");
      toast.push("success", t.acct_contactAdded);
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
    }
  };

  if (!accounts || !contacts) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-inkfaint">{t.acct_totalCash}</p>
          <p className="num text-[28px] font-semibold tracking-tight text-ink">{fmtCents(total)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setKeyModal(true)}>
            <IKey size={15} /> {t.acct_pixKey}
          </Button>
          <Button onClick={() => setAccountModal({ open: true })}>
            <IPlus size={15} /> {t.acct_account}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a, i) => (
          <Reveal key={a.id} delay={i * 50}>
            <article className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-inksoft">
                  <IWallet size={15} className="text-pine-600" />
                  {a.institution}
                </span>
                <Badge tone="neutral">{TYPE_LABEL(a.type, t)}</Badge>
              </div>
              <h3 className="font-display mt-2 text-[16px] font-bold tracking-tight">
                {a.nickname}
                {a.last4 && <span className="num ml-1.5 text-[13px] font-medium text-inkfaint">••{a.last4}</span>}
              </h3>
              <p className={`num mt-1 text-[26px] font-semibold tracking-tight ${a.balanceCents < 0 ? "text-rust-600" : "text-ink"}`}>
                {fmtCents(a.balanceCents)}
              </p>
              <p className="text-[11.5px] text-inkfaint">
                {fill(t.acct_opened, { d: fmtDate(a.openingDate) })} · {fill(t.common_entries, { n: a.txCount })}
              </p>
              {a.pixKeys.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
                  {a.pixKeys.map((k) => (
                    <li key={k.id} className="flex items-center gap-2 text-[11.5px]">
                      <IKey size={12} className="shrink-0 text-gold-600" />
                      <Badge tone="gold">{k.type}</Badge>
                      <span className="num min-w-0 flex-1 truncate text-inksoft">{k.value}</span>
                      <IconBtn label={t.acct_copy} onClick={() => copy(k.value)} className="p-1">
                        <span className="text-[11px] font-bold">{t.acct_copy}</span>
                      </IconBtn>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex justify-end gap-1 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="sm" onClick={() => setAccountModal({ open: true, preset: a })}>
                  {t.common_edit}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(a)} className="!text-rust-600 hover:!bg-rust-100">
                  {t.common_delete}
                </Button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <section>
        <header className="mb-3 flex items-center gap-2">
          <IUsers size={16} className="text-pine-600" />
          <h2 className="font-display text-[16px] font-bold tracking-tight">{t.acct_contactsTitle}</h2>
        </header>
        {contacts.length === 0 ? (
          <p className="text-[12.5px] text-inkfaint">{t.acct_noContacts}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
                <p className="text-[13.5px] font-semibold text-ink">{c.name}</p>
                {c.keys.length === 0 ? (
                  <p className="mt-1 text-[11.5px] text-inkfaint">{t.acct_noKeys}</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {c.keys.map((k) => (
                      <li key={k.id} className="flex items-center gap-2 text-[11.5px]">
                        <Badge tone="gold">{k.type}</Badge>
                        <span className="num min-w-0 flex-1 truncate text-inksoft">{k.value}</span>
                        <IconBtn label={t.acct_copy} onClick={() => copy(k.value)} className="p-1">
                          <span className="text-[11px] font-bold">{t.acct_copy}</span>
                        </IconBtn>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex max-w-sm gap-2">
          <input
            className={inputCls}
            placeholder={t.acct_contactPh}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addContact()}
          />
          <Button variant="soft" onClick={addContact} disabled={!contactName.trim()}>{t.common_add}</Button>
        </div>
      </section>

      <AccountModal open={accountModal.open} onClose={() => setAccountModal({ open: false })} preset={accountModal.preset} />
      <PixKeyModal open={keyModal} onClose={() => setKeyModal(false)} accounts={accounts} contacts={contacts} />
      <Confirm
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t.acct_deleteTitle}
        message={fill(t.acct_deleteMsg, { name: pendingDelete?.nickname ?? "" })}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await uc.deleteAccount(pendingDelete.id);
            toast.push("success", t.acct_deleted);
          } catch (e) {
            toast.push("error", e instanceof Error ? e.message : t.common_couldNotSave);
          } finally {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}

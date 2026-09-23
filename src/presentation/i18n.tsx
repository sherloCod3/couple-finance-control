/**
 * Presentation-only i18n (pt-BR / en).
 * The domain and application layers contain zero user-facing strings, so
 * translation can never cause a financial-logic regression (ADR-001).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { daysBetween, todayISO } from "../domain/utils/dates";

export type Lang = "en" | "pt-BR";
const LS_KEY = "cfc-lang";

const en = {
  // shell / nav
  nav_overview: "Overview", nav_activity: "Activity", nav_accounts: "Accounts",
  nav_cards: "Cards", nav_plans: "Plans", nav_loans: "Loans",
  sub_overview: "The household's money at a glance",
  sub_activity: "Every real movement, grouped by day",
  sub_accounts: "Where the cash lives — and its PIX keys",
  sub_cards: "Statements, limits and payments",
  sub_plans: "Recurring forecasts — never real money by themselves",
  sub_loans: "What we owe, and what is owed to us",
  shell_tagline: "Household ledger", shell_demo: "Demo data · fictional",
  shell_online: "Online", shell_offline: "Offline · saved locally",
  shell_install: "Install app", shell_addEntry: "New entry",
  shell_resetDemo: "Reset demo data", shell_resetTitle: "Reset demo data?",
  shell_resetMsg: "All current entries will be replaced by the fictional demo household.",
  shell_export: "Export backup", shell_import: "Import backup",
  shell_exportOk: "Backup exported as JSON.", shell_importOk: "Backup imported — data restored.",
  shell_importBad: "Invalid backup file.",
  shell_reminders: "Reminders", shell_noReminders: "Nothing due in the next 30 days.",
  shell_openOverview: "Open overview", shell_lang: "Language",
  // common
  common_cancel: "Cancel", common_save: "Save", common_saving: "Saving…",
  common_delete: "Delete", common_edit: "Edit", common_close: "Close",
  common_add: "Add", common_new: "New", common_record: "Record",
  common_entries: "{n} entries", common_searchPh: "Search description, category, account…",
  common_allAccounts: "All accounts", common_allTime: "All time",
  common_income: "Income", common_expenses: "Expenses", common_transfers: "Transfers",
  common_adjustments: "Adjustments", common_net: "net", common_cashNet: "cash net",
  common_amount: "Amount",
  dash_includesCards: "includes {v} on cards",
  common_date: "Date", common_description: "Description", common_category: "Category",
  common_account: "Account", common_notes: "Notes (optional)", common_uncategorized: "Uncategorized",
  common_couldNotSave: "Could not save.", common_day: "day {n}", common_planned: "planned",
  // relative due dates
  due_today: "due today", due_tomorrow: "due tomorrow",
  due_inDays: "due in {n} days", due_overdue1: "1 day overdue", due_overdueDays: "{n} days overdue",
  // dashboard
  dash_cashPosition: "Cash position", dash_accountsCount: "{n} accounts",
  dash_thisMonth: "this month",
  dash_currentHint: "Money actually held across household accounts right now. Card balances and planned bills are tracked separately below.",
  dash_viewAccounts: "View accounts",
  dash_availableNow: "Available now", dash_availableHint: "current cash − committed this month",
  dash_committed: "Committed", dash_committedHint: "obligations already owed, not yet paid",
  dash_projected: "Projected · 30 days", dash_projectedHint: "after every known obligation in the horizon",
  dash_overdueCount: "{n} overdue", dash_bannerTail: "listed under “Needs attention”",
  dash_needsAttention: "Needs attention", dash_overdue: "overdue", dash_upcoming: "upcoming",
  dash_allClear: "All clear",
  dash_allClearBody: "No bills, statements or installments due in the next 30 days.",
  dash_incomeReceived: "Income received", dash_spending: "Spending",
  dash_savingsKeep: "The household is keeping {pct}% of this month's income.",
  dash_spendingAhead: "Spending is {pct}% ahead of income this month.",
  dash_noIncome: "No income recorded yet this month.",
  dash_cashFlow: "Cash flow · last 6 months", dash_allActivity: "All activity",
  dash_whereMoney: "Where the money went", dash_noSpending: "No spending yet",
  dash_noSpendingBody: "Expenses recorded this month will be broken down here by category.",
  dash_recent: "Recent activity", dash_viewAll: "View all",
  dash_cards: "Credit cards", dash_noCards: "No cards",
  dash_noCardsBody: "Register a card to track statements and available limit.",
  dash_manage: "Manage", dash_loans: "Loans", dash_details: "Details",
  dash_weOwe: "We owe", dash_owedToUs: "Owed to us", dash_loanCount: "{n} loan(s)",
  dash_settled: "statements settled", dash_pay: "Pay", dash_availableShort: "available",
  dash_pctLimit: "{pct}% of limit", dash_dueShort: "due {d}",
  dash_donutTotal: "spent this month", dash_chartHint: "hover a month for totals",
  // activity page
  tx_nothingMatches: "Nothing matches the filters",
  tx_tryClearing: "Try clearing the search or widening the period.",
  tx_noTx: "No transactions yet",
  tx_noTxBody: "Record the first income, expense or transfer to bring the household ledger to life.",
  tx_recordEntry: "Record entry",
  tx_deleted: "Transaction deleted.", tx_transferDeleted: "Transfer removed (both legs).",
  tx_deleteTitle: "Delete transaction?", tx_deleteTransferTitle: "Delete transfer?",
  tx_deleteTransferMsg: "Both legs of the transfer will be removed. Account balances will be recalculated.",
  tx_deleteMsg: "“{desc}” will be removed and balances recalculated. This cannot be undone.",
  // accounts page
  acct_totalCash: "Total cash", acct_pixKey: "PIX key", acct_account: "Account",
  acct_editAccount: "Edit account", acct_newAccount: "New account",
  acct_balancesDerived: "Balances are derived from the opening balance plus every transaction.",
  acct_institution: "Institution", acct_nickname: "Nickname", acct_type: "Type",
  acct_checking: "Checking", acct_savings: "Savings", acct_wallet: "Wallet", acct_other: "Other",
  acct_last4: "Last four digits", acct_last4Hint: "Never store full numbers (ADR-005).",
  acct_openingDate: "Opening date", acct_openingBalance: "Opening balance",
  acct_openingHint: "Balance at that date — can be negative.",
  acct_saveAccount: "Save account", acct_added: "Account added.", acct_updated: "Account updated.",
  acct_opened: "opened {d}", acct_contactsTitle: "Contacts & their PIX keys",
  acct_noContacts: "No contacts yet.", acct_noKeys: "No keys linked.",
  acct_contactPh: "New contact name (fictional)", acct_contactAdded: "Contact added.",
  acct_newPixKey: "New PIX key",
  acct_pixHint: "Only fictional keys belong in this repository (Section 07).",
  acct_owner: "Owner", acct_contact: "Contact", acct_keyType: "Type", acct_keyValue: "Key value",
  acct_saveKey: "Save key", acct_pixSaved: "PIX key saved (fictional demo key).",
  acct_copy: "copy", acct_copied: "Key copied to clipboard.", acct_clipboardErr: "Clipboard unavailable in this browser.",
  acct_deleteTitle: "Delete account?",
  acct_deleteMsg: "“{name}” can only be deleted when it has no transaction history or PIX keys.",
  acct_deleted: "Account deleted.",
  // cards page
  card_intro: "Purchases count as spending immediately but only touch bank cash when a statement is paid.",
  card_purchaseBtn: "Purchase", card_cardBtn: "Card", card_newCard: "New credit card",
  card_editCard: "Edit card", card_noCardsTitle: "No credit cards yet",
  card_noCardsBody: "Register a card with its limit, closing day and due day to start tracking statements.",
  card_addCard: "Add card", card_last4Only: "Only the last four digits are stored (ADR-005).",
  card_issuer: "Issuer", card_nickname: "Nickname", card_last4Label: "Last four digits",
  card_creditLimit: "Credit limit", card_closingDay: "Closing day",
  card_closingHint: "Purchases after this day roll into the next statement.",
  card_dueDay: "Due day", card_dueHint: "Statement is due on this day of the following month.",
  card_saveCard: "Save card", card_added: "Card added.", card_updated: "Card updated.",
  card_deleted: "Card deleted.",
  card_availableOf: "{a} of {l} available", card_pctUsed: "{pct}% used",
  card_noPurchases: "No purchases yet",
  card_noPurchasesBody: "Purchases made on {name} ••{last4} will be grouped into monthly statements here.",
  card_recordPurchase: "Record purchase", card_newPurchase: "New card purchase",
  card_purchaseSubtitle: "Counts as spending and reduces available credit — bank cash is untouched until the statement is paid.",
  card_purchaseDate: "Purchase date", card_booksInto: "Books into the {month} statement",
  card_closesDue: "(closes day {c}, due day {d})",
  card_purchaseBooked: "Purchase recorded — booked to the {month} statement.",
  card_purchaseSaved: "Purchase recorded.", card_purchaseDeleted: "Purchase deleted.",
  card_deletePurchaseTitle: "Delete purchase?",
  card_deletePurchaseMsg: "“{desc}” will be removed from the statement and totals will be recalculated.",
  card_paid: "paid", card_dueOn: "due {d}", card_overdueWas: "overdue · was due {d}",
  card_closedOn: "closed {d}", card_total: "Total", card_paidLabel: "Paid", card_remaining: "Remaining",
  card_payAmount: "Pay {v}", card_payTitle: "Pay {name} ••{last4}",
  card_paySubtitle: "Reduces account cash and settles the card obligation — not counted as new spending.",
  card_payFrom: "Pay from account", card_paymentRecorded: "Card payment recorded — {v} settled.",
  card_couldNotPay: "Could not record the payment.", card_statement: "Statement",
  card_deletePurchaseLabel: "Delete purchase",
  // plans page
  plan_intro: "Plans forecast upcoming bills. Record the real transaction and link it to a plan to mark the period as paid.",
  plan_newPlan: "New recurring plan", plan_editPlan: "Edit plan",
  plan_subtitle: "A plan is a forecast — it never moves money by itself.",
  plan_frequency: "Frequency", plan_monthly: "Monthly", plan_weekly: "Weekly", plan_yearly: "Yearly",
  plan_weekday: "Weekday", plan_dayOfMonth: "Day of month", plan_month: "Month",
  plan_amountStyle: "Amount style", plan_fixed: "Fixed", plan_range: "Range",
  plan_minimum: "Minimum (estimate)", plan_maximum: "Maximum (estimate)", plan_amount: "Amount",
  plan_active: "Active", plan_created: "Recurring plan created.", plan_updated: "Plan updated.",
  plan_pausedMsg: "“{name}” paused.", plan_resumedMsg: "“{name}” resumed.",
  plan_paidPeriod: "paid this period", plan_missedOn: "missed {d}", plan_dueOn: "due {d}",
  plan_scheduled: "scheduled", plan_paused: "paused", plan_recordPayment: "Record payment",
  plan_commitment: "Planned commitment ≈ {v} per month",
  plan_forecastsNever: "forecasts never move money on their own",
  plan_noPlans: "No recurring plans",
  plan_noPlansBody: "Add rent, subscriptions, utilities or estimated variable spending like groceries.",
  plan_createPlan: "Create plan", plan_deleteTitle: "Delete plan?",
  plan_deleteMsg: "“{name}” will be removed. Historical transactions linked to it are kept (FIN-08).",
  plan_deleted: "Plan deleted — history preserved.", plan_nextOn: "next {d}",
  plan_freqWeekly: "Weekly · {d}", plan_freqYearly: "Yearly · {m} {d}", plan_freqMonthly: "Monthly · day {d}",
  // loans page
  loan_intro: "Payments are immutable audit records; the outstanding balance is always derived from them.",
  loan_newLoan: "New loan", loan_subtitle: "Track what the household owes — or is owed.",
  loan_direction: "Direction", loan_weOwe: "We owe", loan_owedToUs: "Owed to us",
  loan_counterparty: "Counterparty", loan_counterpartyPh: "Banco Demo / Rafa",
  loan_description: "Description", loan_startDate: "Start date",
  loan_repaymentPlan: "Repayment plan", loan_monthlyInstallments: "Monthly installments",
  loan_noSchedule: "No schedule", loan_installments: "Installments",
  loan_monthlyAmount: "Monthly amount", loan_firstDue: "First due date",
  loan_noteOpt: "Note (optional)", loan_notePh: "e.g. PIX from wallet", loan_saved: "Loan saved.",
  loan_moneyWeOwe: "Money we owe", loan_moneyOwedToUs: "Money owed to us",
  loan_noDebts: "No debts tracked", loan_noDebtsBody: "Add financing or money borrowed from someone.",
  loan_nothingReceivable: "Nothing receivable",
  loan_nothingReceivableBody: "Track money lent to friends or family so it doesn't slip away.",
  loan_principal: "principal", loan_paid: "paid", loan_pctRepaid: "{pct}% repaid",
  loan_settled: "settled", loan_overdueBadge: "overdue",
  loan_upcomingSchedule: "Upcoming schedule", loan_allSettled: "All installments settled.",
  loan_paymentHistory: "Payment history", loan_immutable: "(immutable)",
  loan_noPayments: "No payments recorded yet.", loan_inLedger: "in ledger",
  loan_recordPayment: "Record payment", loan_recordReceipt: "Record receipt",
  loan_paymentTitle: "Payment — {name}", loan_receiptTitle: "Receipt from {name}",
  loan_outstandingIs: "Outstanding: {v}. Payments are immutable audit records.",
  loan_accountImpact: "Account impact", loan_accountImpactHint: "Optional cash entry on an account.",
  loan_paymentRecorded: "Loan payment recorded — {v}.", loan_receiptRecorded: "Receipt recorded — {v}.",
  loan_deleted: "Loan deleted.", loan_nextWord: "next",
  // entry modal
  entry_new: "New entry", entry_edit: "Edit entry",
  entry_transferSubtitle: "Stored as two linked legs — household wealth stays unchanged.",
  entry_income: "Income", entry_expense: "Expense", entry_transfer: "Transfer", entry_adjust: "Adjust",
  entry_direction: "Direction", entry_adjustHint: "Adjustments correct a balance (fees, interest, rounding).",
  entry_moneyOut: "Money left (−)", entry_moneyIn: "Money came in (+)",
  entry_fromAccount: "From account", entry_toAccount: "To account",
  entry_recordedBy: "Recorded by", entry_linkedPlan: "Linked plan",
  entry_linkedPlanHint: "Linking marks the matching forecast as paid this period.",
  entry_notLinked: "Not linked to a plan", entry_transferPh: "e.g. Monthly savings top-up",
  entry_expensePh: "e.g. Supermarket", entry_saveChanges: "Save changes",
  entry_recorded: "{kind} recorded — {v}.", entry_incomeWord: "Income",
  entry_expenseWord: "Expense", entry_adjustmentWord: "Adjustment",
  entry_updated: "Transaction updated.", entry_transferUpdated: "Transfer updated.",
  entry_transferRecorded: "Transfer recorded — {v}.", entry_couldNotSave: "Could not save the transaction.",
  entry_defaultTransfer: "Transfer",
};

const ptBR: typeof en = {
  nav_overview: "Visão geral", nav_activity: "Atividade", nav_accounts: "Contas",
  nav_cards: "Cartões", nav_plans: "Planos", nav_loans: "Empréstimos",
  sub_overview: "O dinheiro do casal em um relance",
  sub_activity: "Cada movimentação real, agrupada por dia",
  sub_accounts: "Onde o dinheiro está — e suas chaves PIX",
  sub_cards: "Faturas, limites e pagamentos",
  sub_plans: "Projeções recorrentes — nunca dinheiro real por si só",
  sub_loans: "O que devemos e o que temos a receber",
  shell_tagline: "Livro-razão do casal", shell_demo: "Dados demo · fictícios",
  shell_online: "Online", shell_offline: "Offline · salvo localmente",
  shell_install: "Instalar app", shell_addEntry: "Novo lançamento",
  shell_resetDemo: "Restaurar dados demo", shell_resetTitle: "Restaurar dados demo?",
  shell_resetMsg: "Todos os lançamentos atuais serão substituídos pela família fictícia de demonstração.",
  shell_export: "Exportar backup", shell_import: "Importar backup",
  shell_exportOk: "Backup exportado em JSON.", shell_importOk: "Backup importado — dados restaurados.",
  shell_importBad: "Arquivo de backup inválido.",
  shell_reminders: "Lembretes", shell_noReminders: "Nada vence nos próximos 30 dias.",
  shell_openOverview: "Abrir visão geral", shell_lang: "Idioma",
  common_cancel: "Cancelar", common_save: "Salvar", common_saving: "Salvando…",
  common_delete: "Excluir", common_edit: "Editar", common_close: "Fechar",
  common_add: "Adicionar", common_new: "Novo", common_record: "Registrar",
  common_entries: "{n} lançamentos", common_searchPh: "Buscar descrição, categoria, conta…",
  common_allAccounts: "Todas as contas", common_allTime: "Todo o período",
  common_income: "Receitas", common_expenses: "Despesas", common_transfers: "Transferências",
  common_adjustments: "Ajustes", common_net: "resultado", common_cashNet: "resultado de caixa",
  common_amount: "Valor",
  dash_includesCards: "inclui {v} no cartão",
  common_date: "Data", common_description: "Descrição", common_category: "Categoria",
  common_account: "Conta", common_notes: "Observações (opcional)", common_uncategorized: "Sem categoria",
  common_couldNotSave: "Não foi possível salvar.", common_day: "dia {n}", common_planned: "planejado",
  due_today: "vence hoje", due_tomorrow: "vence amanhã",
  due_inDays: "vence em {n} dias", due_overdue1: "1 dia de atraso", due_overdueDays: "{n} dias de atraso",
  dash_cashPosition: "Posição de caixa", dash_accountsCount: "{n} contas",
  dash_thisMonth: "este mês",
  dash_currentHint: "Dinheiro efetivamente nas contas do casal agora. Saldos de cartão e contas planejadas aparecem separados abaixo.",
  dash_viewAccounts: "Ver contas",
  dash_availableNow: "Disponível agora", dash_availableHint: "caixa atual − comprometido neste mês",
  dash_committed: "Comprometido", dash_committedHint: "obrigações já devidas, ainda não pagas",
  dash_projected: "Projetado · 30 dias", dash_projectedHint: "após todas as obrigações conhecidas no horizonte",
  dash_overdueCount: "{n} em atraso", dash_bannerTail: "listadas em “Precisa de atenção”",
  dash_needsAttention: "Precisa de atenção", dash_overdue: "em atraso", dash_upcoming: "a vencer",
  dash_allClear: "Tudo em dia",
  dash_allClearBody: "Nenhuma conta, fatura ou parcela vence nos próximos 30 dias.",
  dash_incomeReceived: "Receitas recebidas", dash_spending: "Gastos",
  dash_savingsKeep: "O casal está poupando {pct}% da renda deste mês.",
  dash_spendingAhead: "Os gastos estão {pct}% acima da renda deste mês.",
  dash_noIncome: "Nenhuma receita registrada neste mês ainda.",
  dash_cashFlow: "Fluxo de caixa · últimos 6 meses", dash_allActivity: "Toda a atividade",
  dash_whereMoney: "Para onde foi o dinheiro", dash_noSpending: "Nenhum gasto ainda",
  dash_noSpendingBody: "As despesas deste mês aparecerão aqui separadas por categoria.",
  dash_recent: "Atividade recente", dash_viewAll: "Ver tudo",
  dash_cards: "Cartões de crédito", dash_noCards: "Nenhum cartão",
  dash_noCardsBody: "Cadastre um cartão para acompanhar faturas e limite disponível.",
  dash_manage: "Gerenciar", dash_loans: "Empréstimos", dash_details: "Detalhes",
  dash_weOwe: "Devemos", dash_owedToUs: "A receber", dash_loanCount: "{n} empréstimo(s)",
  dash_settled: "faturas quitadas", dash_pay: "Pagar", dash_availableShort: "disponível",
  dash_pctLimit: "{pct}% do limite", dash_dueShort: "vence {d}",
  dash_donutTotal: "gasto neste mês", dash_chartHint: "passe o mouse para ver os totais",
  tx_nothingMatches: "Nada corresponde aos filtros",
  tx_tryClearing: "Limpe a busca ou amplie o período.",
  tx_noTx: "Nenhuma transação ainda",
  tx_noTxBody: "Registre a primeira receita, despesa ou transferência para dar vida ao livro do casal.",
  tx_recordEntry: "Registrar lançamento",
  tx_deleted: "Transação excluída.", tx_transferDeleted: "Transferência removida (ambas as partes).",
  tx_deleteTitle: "Excluir transação?", tx_deleteTransferTitle: "Excluir transferência?",
  tx_deleteTransferMsg: "As duas partes da transferência serão removidas e os saldos recalculados.",
  tx_deleteMsg: "“{desc}” será removida e os saldos recalculados. Não é possível desfazer.",
  acct_totalCash: "Caixa total", acct_pixKey: "Chave PIX", acct_account: "Conta",
  acct_editAccount: "Editar conta", acct_newAccount: "Nova conta",
  acct_balancesDerived: "Saldos são derivados do saldo inicial mais cada transação.",
  acct_institution: "Instituição", acct_nickname: "Apelido", acct_type: "Tipo",
  acct_checking: "Corrente", acct_savings: "Poupança", acct_wallet: "Carteira", acct_other: "Outra",
  acct_last4: "Últimos quatro dígitos", acct_last4Hint: "Nunca armazenamos números completos (ADR-005).",
  acct_openingDate: "Data de abertura", acct_openingBalance: "Saldo inicial",
  acct_openingHint: "Saldo naquela data — pode ser negativo.",
  acct_saveAccount: "Salvar conta", acct_added: "Conta adicionada.", acct_updated: "Conta atualizada.",
  acct_opened: "aberta em {d}", acct_contactsTitle: "Contatos e suas chaves PIX",
  acct_noContacts: "Nenhum contato ainda.", acct_noKeys: "Nenhuma chave vinculada.",
  acct_contactPh: "Nome do contato (fictício)", acct_contactAdded: "Contato adicionado.",
  acct_newPixKey: "Nova chave PIX",
  acct_pixHint: "Somente chaves fictícias neste repositório (Seção 07).",
  acct_owner: "Titular", acct_contact: "Contato", acct_keyType: "Tipo", acct_keyValue: "Valor da chave",
  acct_saveKey: "Salvar chave", acct_pixSaved: "Chave PIX salva (chave fictícia de demonstração).",
  acct_copy: "copiar", acct_copied: "Chave copiada.", acct_clipboardErr: "Área de transferência indisponível neste navegador.",
  acct_deleteTitle: "Excluir conta?",
  acct_deleteMsg: "“{name}” só pode ser excluída sem histórico de transações ou chaves PIX.",
  acct_deleted: "Conta excluída.",
  card_intro: "Compras contam como gasto na hora, mas só mexem no caixa do banco quando a fatura é paga.",
  card_purchaseBtn: "Compra", card_cardBtn: "Cartão", card_newCard: "Novo cartão de crédito",
  card_editCard: "Editar cartão", card_noCardsTitle: "Nenhum cartão de crédito ainda",
  card_noCardsBody: "Cadastre um cartão com limite, dia de fechamento e vencimento para acompanhar as faturas.",
  card_addCard: "Adicionar cartão", card_last4Only: "Somente os últimos quatro dígitos são armazenados (ADR-005).",
  card_issuer: "Emissor", card_nickname: "Apelido", card_last4Label: "Últimos quatro dígitos",
  card_creditLimit: "Limite de crédito", card_closingDay: "Dia de fechamento",
  card_closingHint: "Compras após este dia entram na próxima fatura.",
  card_dueDay: "Dia de vencimento", card_dueHint: "A fatura vence neste dia do mês seguinte.",
  card_saveCard: "Salvar cartão", card_added: "Cartão adicionado.", card_updated: "Cartão atualizado.",
  card_deleted: "Cartão excluído.",
  card_availableOf: "{a} de {l} disponível", card_pctUsed: "{pct}% usado",
  card_noPurchases: "Nenhuma compra ainda",
  card_noPurchasesBody: "Compras feitas no {name} ••{last4} aparecerão aqui agrupadas em faturas mensais.",
  card_recordPurchase: "Registrar compra", card_newPurchase: "Nova compra no cartão",
  card_purchaseSubtitle: "Conta como gasto e reduz o limite disponível — o caixa do banco só muda quando a fatura for paga.",
  card_purchaseDate: "Data da compra", card_booksInto: "Entra na fatura de {month}",
  card_closesDue: "(fecha dia {c}, vence dia {d})",
  card_purchaseBooked: "Compra registrada — lançada na fatura de {month}.",
  card_purchaseSaved: "Compra registrada.", card_purchaseDeleted: "Compra excluída.",
  card_deletePurchaseTitle: "Excluir compra?",
  card_deletePurchaseMsg: "“{desc}” será removida da fatura e os totais serão recalculados.",
  card_paid: "paga", card_dueOn: "vence {d}", card_overdueWas: "vencida · venceu {d}",
  card_closedOn: "fechou {d}", card_total: "Total", card_paidLabel: "Pago", card_remaining: "Restante",
  card_payAmount: "Pagar {v}", card_payTitle: "Pagar {name} ••{last4}",
  card_paySubtitle: "Reduz o caixa da conta e quita a obrigação do cartão — não conta como novo gasto.",
  card_payFrom: "Pagar da conta", card_paymentRecorded: "Pagamento da fatura registrado — {v} quitados.",
  card_couldNotPay: "Não foi possível registrar o pagamento.", card_statement: "Fatura",
  card_deletePurchaseLabel: "Excluir compra",
  plan_intro: "Planos projetam as próximas contas. Registre a transação real vinculada ao plano para marcar o período como pago.",
  plan_newPlan: "Novo plano recorrente", plan_editPlan: "Editar plano",
  plan_subtitle: "Um plano é uma projeção — nunca movimenta dinheiro sozinho.",
  plan_frequency: "Frequência", plan_monthly: "Mensal", plan_weekly: "Semanal", plan_yearly: "Anual",
  plan_weekday: "Dia da semana", plan_dayOfMonth: "Dia do mês", plan_month: "Mês",
  plan_amountStyle: "Tipo de valor", plan_fixed: "Fixo", plan_range: "Faixa",
  plan_minimum: "Mínimo (estimado)", plan_maximum: "Máximo (estimado)", plan_amount: "Valor",
  plan_active: "Ativo", plan_created: "Plano recorrente criado.", plan_updated: "Plano atualizado.",
  plan_pausedMsg: "“{name}” pausado.", plan_resumedMsg: "“{name}” retomado.",
  plan_paidPeriod: "pago neste período", plan_missedOn: "perdido {d}", plan_dueOn: "vence {d}",
  plan_scheduled: "programado", plan_paused: "pausado", plan_recordPayment: "Registrar pagamento",
  plan_commitment: "Compromisso planejado ≈ {v} por mês",
  plan_forecastsNever: "projeções nunca movimentam dinheiro sozinhas",
  plan_noPlans: "Nenhum plano recorrente",
  plan_noPlansBody: "Adicione aluguel, assinaturas, contas ou gastos variáveis estimados, como mercado.",
  plan_createPlan: "Criar plano", plan_deleteTitle: "Excluir plano?",
  plan_deleteMsg: "“{name}” será removido. Transações históricas vinculadas serão mantidas (FIN-08).",
  plan_deleted: "Plano excluído — histórico preservado.", plan_nextOn: "próximo {d}",
  plan_freqWeekly: "Semanal · {d}", plan_freqYearly: "Anual · {d} de {m}", plan_freqMonthly: "Mensal · dia {d}",
  loan_intro: "Pagamentos são registros imutáveis; o saldo devedor é sempre derivado deles.",
  loan_newLoan: "Novo empréstimo", loan_subtitle: "Acompanhe o que o casal deve — ou tem a receber.",
  loan_direction: "Direção", loan_weOwe: "Devemos", loan_owedToUs: "A receber",
  loan_counterparty: "Contraparte", loan_counterpartyPh: "Banco Demo / Rafa",
  loan_description: "Descrição", loan_startDate: "Data inicial",
  loan_repaymentPlan: "Plano de pagamento", loan_monthlyInstallments: "Parcelas mensais",
  loan_noSchedule: "Sem cronograma", loan_installments: "Parcelas",
  loan_monthlyAmount: "Valor mensal", loan_firstDue: "Primeiro vencimento",
  loan_noteOpt: "Observação (opcional)", loan_notePh: "ex.: PIX da carteira", loan_saved: "Empréstimo salvo.",
  loan_moneyWeOwe: "Dinheiro que devemos", loan_moneyOwedToUs: "Dinheiro a receber",
  loan_noDebts: "Nenhuma dívida registrada", loan_noDebtsBody: "Adicione um financiamento ou dinheiro emprestado.",
  loan_nothingReceivable: "Nada a receber",
  loan_nothingReceivableBody: "Registre dinheiro emprestado a amigos ou familiares para não esquecer.",
  loan_principal: "principal", loan_paid: "pago", loan_pctRepaid: "{pct}% pago",
  loan_settled: "quitado", loan_overdueBadge: "em atraso",
  loan_upcomingSchedule: "Próximas parcelas", loan_allSettled: "Todas as parcelas quitadas.",
  loan_paymentHistory: "Histórico de pagamentos", loan_immutable: "(imutável)",
  loan_noPayments: "Nenhum pagamento registrado.", loan_inLedger: "no extrato",
  loan_recordPayment: "Registrar pagamento", loan_recordReceipt: "Registrar recebimento",
  loan_paymentTitle: "Pagamento — {name}", loan_receiptTitle: "Recebimento de {name}",
  loan_outstandingIs: "Saldo devedor: {v}. Pagamentos são registros imutáveis.",
  loan_accountImpact: "Impacto na conta", loan_accountImpactHint: "Lançamento opcional em uma conta.",
  loan_paymentRecorded: "Pagamento registrado — {v}.", loan_receiptRecorded: "Recebimento registrado — {v}.",
  loan_deleted: "Empréstimo excluído.", loan_nextWord: "próxima",
  entry_new: "Novo lançamento", entry_edit: "Editar lançamento",
  entry_transferSubtitle: "Salvo como duas partes vinculadas — o patrimônio do casal não muda.",
  entry_income: "Receita", entry_expense: "Despesa", entry_transfer: "Transferência", entry_adjust: "Ajuste",
  entry_direction: "Direção", entry_adjustHint: "Ajustes corrigem um saldo (tarifas, juros, arredondamento).",
  entry_moneyOut: "Dinheiro saiu (−)", entry_moneyIn: "Dinheiro entrou (+)",
  entry_fromAccount: "Conta de origem", entry_toAccount: "Conta de destino",
  entry_recordedBy: "Registrado por", entry_linkedPlan: "Plano vinculado",
  entry_linkedPlanHint: "Vincular marca a projeção correspondente como paga neste período.",
  entry_notLinked: "Não vinculado a um plano", entry_transferPh: "ex.: Reforço mensal da poupança",
  entry_expensePh: "ex.: Supermercado", entry_saveChanges: "Salvar alterações",
  entry_recorded: "{kind} registrado — {v}.", entry_incomeWord: "Receita",
  entry_expenseWord: "Despesa", entry_adjustmentWord: "Ajuste",
  entry_updated: "Transação atualizada.", entry_transferUpdated: "Transferência atualizada.",
  entry_transferRecorded: "Transferência registrada — {v}.", entry_couldNotSave: "Não foi possível salvar a transação.",
  entry_defaultTransfer: "Transferência",
};

export type Dict = typeof en;
const dicts: Record<Lang, Dict> = { en, "pt-BR": ptBR };

/** Interpolate `{placeholders}` inside a dictionary string. */
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

// ---- display locale (dates & numbers) -------------------------------------

let uiLocale = "en-US";
export const uiLocaleCode = (): string => uiLocale;

const nfCache = new Map<string, Intl.NumberFormat>();
export const moneyFormatter = (): Intl.NumberFormat => {
  const cached = nfCache.get(uiLocale);
  if (cached) return cached;
  const nf = new Intl.NumberFormat(uiLocale, { style: "currency", currency: "BRL" });
  nfCache.set(uiLocale, nf);
  return nf;
};

export const weekdayNames = (): string[] =>
  Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 is a Monday
    return new Date(2024, 0, 1 + i).toLocaleDateString(uiLocale, { weekday: "short" });
  });

export const monthNames = (): string[] =>
  Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(uiLocale, { month: "long" }));

export const monthNameOf = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(uiLocale, { month: "long", year: "numeric" });
};

export const monthShortOf = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(uiLocale, { month: "short" });
};

export const daysUntil = (iso: string, today: string = todayISO()): number =>
  daysBetween(today, iso);

/** Localized relative due-date label. */
export const relDueT = (n: number, t: Dict): string => {
  if (n === 0) return t.due_today;
  if (n === 1) return t.due_tomorrow;
  if (n > 1) return fill(t.due_inDays, { n });
  if (n === -1) return t.due_overdue1;
  return fill(t.due_overdueDays, { n: -n });
};

// ---- provider --------------------------------------------------------------

interface LangCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LangCtx = createContext<LangCtxValue>({ lang: "en", setLang: () => undefined, t: en });

export const useT = (): LangCtxValue => useContext(LangCtx);

const detectLang = (): Lang =>
  typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")
    ? "pt-BR"
    : "en";

/** The persisted choice when present, otherwise the browser preference. */
const initialLang = (): Lang => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "en" || saved === "pt-BR") return saved;
  } catch {
    /* private mode */
  }
  return detectLang();
};

// Resolve the Intl locale at module evaluation, i.e. before the first paint.
// Writing it during LangProvider's render would be a side effect in render.
uiLocale = initialLang() === "pt-BR" ? "pt-BR" : "en-US";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    uiLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: dicts[lang] }), [lang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

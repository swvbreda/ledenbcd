import { useState, useMemo, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useBankStatement, useBudgetCategories, useBudgetBalance, useBudgetMutations, useBudgetNotes, useBudgetYearSettings, useBudgetYearSettingsMutation } from "@/hooks/useBudget";
import { useAuth } from "@/hooks/useAuth";
import { useInternalDeclarations, useInternalDeclarationMutations } from "@/hooks/useInternalDeclarations";
import { useContributions, useUpsertContribution, useContributionInvoices } from "@/hooks/useContributions";
import { useMembers } from "@/hooks/useMembers";
import { useMembersData } from "@/contexts/MembersDataContext";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import BudgetCategoryTable from "@/components/budget/BudgetCategoryTable";
import BalancePanel from "@/components/budget/BalancePanel";
import ExpenseDialog from "@/components/budget/ExpenseDialog";
import InternalDeclarationsView from "@/components/budget/InternalDeclarationsView";
import ContributieTab from "@/components/budget/ContributieTab";
import PdfImportDialog from "@/components/budget/PdfImportDialog";
import BoekingenOverzicht from "@/components/budget/BoekingenOverzicht";
import DuplicatesDialog from "@/components/budget/DuplicatesDialog";
import DossierOverzichtTab from "@/components/budget/DossierOverzichtTab";
import FinancieelTodoTab from "@/components/budget/FinancieelTodoTab";
import InformerSyncTab from "@/components/budget/InformerSyncTab";
import BankBalancesCard from "@/components/budget/BankBalancesCard";
import BudgetVsActualTable from "@/components/budget/BudgetVsActualTable";

import BankboekingenTab from "@/components/budget/BankboekingenTab";
import ContributiesBreakdownDialog, { type BreakdownMode } from "@/components/budget/ContributiesBreakdownDialog";
import HardeCheckTab from "@/components/budget/HardeCheckTab";

import { CurrencyCell } from "@/components/budget/CurrencyAmount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function FinancienPage() {
  const [year, setYear] = useState(currentYear);
  const { user, isAdmin } = useAuth();
  const { data: yearSettings } = useBudgetYearSettings(year);
  const yearSettingsMutation = useBudgetYearSettingsMutation(year);
  const expenseSourcePreference = yearSettings?.expense_source_preference === "pdf_import" ? "pdf_import" : "manual";
  const { data: categories, isLoading } = useBudgetCategories(year, expenseSourcePreference);
  const { data: balanceItems } = useBudgetBalance(year);
  const { data: bankStatement } = useBankStatement(year);
  const { data: budgetNotes } = useBudgetNotes(year);
  const mutations = useBudgetMutations(year);
  const { data: internalDeclarations } = useInternalDeclarations(year);
  const internalMutations = useInternalDeclarationMutations(year);
  const { data: contributions } = useContributions(year);
  const { data: contributionInvoices } = useContributionInvoices(year);
  const upsertContribution = useUpsertContribution();
  const { effectiveMembers } = useMembers();
  const { rawOldMembers } = useMembersData();
  const allMembersForLookup = useMemo(
    () => [...effectiveMembers, ...rawOldMembers],
    [effectiveMembers, rawOldMembers]
  );

  // Auto-categoriseer inkomende banktransacties als contributie. Match volgorde:
  // 1) Factuurnummer in omschrijving/REMI → contribution_invoices → lid
  // 2) Tegenpartij matcht bedrijfsnaam/naam van een lid
  // 3) Bedrag = contributiebedrag → markeer als Contributie (zonder lid)
  // Bij match op lid wordt member_contributions bijgewerkt naar "betaald".
  const autoMatchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    if (!bankStatement?.transactions?.length) return;

    const normalize = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|n\.?v\.?|c\.?v\.?|coffeeshop|coffeshop|the)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const stopwords = new Set([
      "van", "de", "der", "den", "het", "en", "the", "of", "aan", "bij",
      "voor", "met", "in", "op", "tot", "uit",
    ]);
    const distinctiveTokens = (s: string) =>
      normalize(s)
        .split(" ")
        .filter((t) => t.length >= 4 && !stopwords.has(t));

    const memberIndex = allMembersForLookup
      .map((m) => {
        const contactNames = [
          (m as any).contactpersoon,
          (m as any).contactpersoon2,
          ...((m as any).contacten || []).map((c: any) => c?.naam),
        ].filter(Boolean) as string[];
        const rawKeys = [
          m.bedrijfsnaam,
          m.naam,
          (m as any).factuurBedrijfsnaam,
          ...contactNames,
        ];
        const keys = rawKeys.map((v) => normalize(v || "")).filter((v) => v.length >= 3);
        const tokenSet = new Set<string>();
        for (const v of rawKeys) for (const t of distinctiveTokens(v || "")) tokenSet.add(t);
        return { id: m.id, naam: m.naam, keys, tokens: tokenSet };
      })
      .filter((m) => m.keys.length > 0);

    const memberById = new Map(allMembersForLookup.map((m) => [m.id, m]));
    const invoiceByNumber = new Map<string, number>();
    for (const inv of contributionInvoices || []) {
      const num = (inv.invoice_number || "").trim();
      if (num) invoiceByNumber.set(num, inv.member_id);
    }

    const extractInvoiceNumbers = (text: string): string[] => {
      const out = new Set<string>();
      const t = text || "";
      // Expliciet na REMI/Factuurnummer/EREF
      const re = /(?:REMI|Factuurnummer|EREF)[/:]+([A-Za-z0-9-]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        if (m[1] && m[1].toUpperCase() !== "NOTPROVIDED") out.add(m[1]);
      }
      // Losse nummers die op factuur kunnen lijken (bv. 2026012)
      const yearPrefix = String(year);
      const reYear = new RegExp(`\\b${yearPrefix}\\d{2,4}\\b`, "g");
      let m2: RegExpExecArray | null;
      while ((m2 = reYear.exec(t)) !== null) out.add(m2[0]);
      return Array.from(out);
    };

    const findMember = (counterparty: string | null) => {
      const n = normalize(counterparty || "");
      if (!n) return null;
      // 1) Exact / contained match op één van de keys
      for (const m of memberIndex) {
        if (m.keys.some((k) => n === k || n.includes(k) || k.includes(n))) {
          return m;
        }
      }
      // 2) Token-overlap match op onderscheidende tokens (achternaam, bedrijfsnaam)
      const cpTokens = distinctiveTokens(counterparty || "");
      if (cpTokens.length === 0) return null;
      let best: { m: typeof memberIndex[number]; score: number } | null = null;
      for (const m of memberIndex) {
        let score = 0;
        for (const t of cpTokens) if (m.tokens.has(t)) score++;
        if (score > 0 && (!best || score > best.score)) best = { m, score };
      }
      // Vereis minstens 1 onderscheidende match, en uniek (geen tie met andere leden)
      if (best && best.score >= 1) {
        const ties = memberIndex.filter((m) => {
          if (m.id === best!.m.id) return false;
          let s = 0;
          for (const t of cpTokens) if (m.tokens.has(t)) s++;
          return s >= best!.score;
        });
        if (ties.length === 0) return best.m;
      }
      return null;
    };

    const contribByMember = new Map<number, boolean>();
    for (const c of contributions || []) contribByMember.set(c.member_id, c.paid);

    for (const tx of bankStatement.transactions) {
      if (tx.direction !== "in") continue;
      if (tx.line_item_id) continue;
      if ((tx.dossier || "").toLowerCase().startsWith("contributie")) continue;
      if (autoMatchedRef.current.has(tx.id)) continue;

      // 1) Invoice-number match via REMI/EREF/description
      let matchedMemberId: number | null = null;
      let matchedName: string | null = null;
      const haystack = `${tx.description || ""} ${tx.invoice_reference || ""}`;
      const invNumbers = extractInvoiceNumbers(haystack);
      for (const num of invNumbers) {
        const mid = invoiceByNumber.get(num);
        if (mid) {
          matchedMemberId = mid;
          matchedName = memberById.get(mid)?.naam || `Lid #${mid}`;
          break;
        }
      }

      // 2) Counterparty match op bedrijfsnaam/naam
      if (!matchedMemberId) {
        const m = findMember(tx.counterparty);
        if (m) {
          matchedMemberId = m.id;
          matchedName = m.naam;
        }
      }

      // 3) Fallback: bedrag = contributiebedrag → categoriseer als Contributie zonder lid
      const isContribAmount = Math.abs(tx.amount - contributionAmount) < 0.005;
      if (!matchedMemberId && !isContribAmount) continue;

      autoMatchedRef.current.add(tx.id);

      const dossier = matchedMemberId
        ? `Contributie · ${matchedName} (#${matchedMemberId})`
        : `Contributie · ${tx.counterparty || "onbekend"}`;
      mutations.updateBankTransaction.mutate({
        id: tx.id,
        dossier,
        line_item_id: null,
        applyToSimilar: false,
      });

      if (matchedMemberId && !contribByMember.get(matchedMemberId)) {
        upsertContribution.mutate({
          member_id: matchedMemberId,
          year,
          amount: tx.amount || contributionAmount,
          paid: true,
          paid_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankStatement?.transactions, allMembersForLookup, contributions, contributionInvoices, user, year]);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<{ lineItemId: string; lineItemName: string } | null>(null);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [contributieBreakdown, setContributieBreakdown] = useState<BreakdownMode | null>(null);
  

  const contributionAmount = yearSettings?.contribution_amount ?? 3000;
  const contributionStats = useMemo(() => {
    const contribs = contributions ?? [];
    const totalMembers = yearSettings?.budgeted_member_count
      ? yearSettings.budgeted_member_count
      : contribs.length > 0 ? contribs.length : effectiveMembers.length;
    const paidCount = contribs.filter((c) => c.paid).length;
    const unpaidCount = totalMembers - paidCount;
    const totalReceived = contribs.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0);
    return { totalMembers, paidCount, unpaidCount, totalReceived, contributionAmount };
  }, [effectiveMembers, contributions, yearSettings, contributionAmount]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const totalBudgeted = (categories || []).reduce(
    (s, c) => s + c.line_items.reduce((ls, li) => ls + li.budgeted_amount, 0), 0
  );
  const totalSpent = (categories || []).reduce(
    (s, c) => s + c.line_items.reduce(
      (ls, li) => ls + li.expenses.reduce((es, e) => es + (e.direction === "in" ? -e.amount : e.amount), 0),
      0
    ), 0
  );

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    mutations.addCategory.mutate(newCatName.trim(), {
      onSuccess: () => { setNewCatName(""); setAddingCategory(false); toast.success("Categorie toegevoegd"); },
    });
  };

  const selectedLineItemExpenses = expenseDialog
    ? (categories || []).flatMap((c) => c.line_items).find((li) => li.id === expenseDialog.lineItemId)?.expenses || []
    : [];

  const fmt = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <BcdHeroBanner
        title="Financieel Beheer"
        subtitle="Begroting, contributie, declaraties en uitgaven beheren"
      />

      {/* Year selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Uitgaven bron:</span>
            <Select
              value={expenseSourcePreference}
              onValueChange={(v) =>
                yearSettingsMutation.mutate(
                  { expense_source_preference: v as "manual" | "pdf_import" },
                  { onSuccess: () => toast.success("Bronvoorkeur opgeslagen") }
                )
              }
            >
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Alleen handmatig</SelectItem>
                <SelectItem value="pdf_import">Alleen PDF-import</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Financiële gegevens laden..." />
      ) : (
        <>

        <Tabs defaultValue="dashboard" className="space-y-1">
          <TabsList className="bg-muted/60 h-10">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="intern" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Declaraties
            </TabsTrigger>
            <TabsTrigger value="contributie" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Contributie
            </TabsTrigger>
            <TabsTrigger value="boekingen" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Inkomsten / Uitgaven
            </TabsTrigger>
            <TabsTrigger value="dossiers" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Dossiers
            </TabsTrigger>
            <TabsTrigger value="todo" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              To Do
            </TabsTrigger>
            <TabsTrigger value="informer" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Informer
            </TabsTrigger>
            <TabsTrigger value="check" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Harde check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <BankBalancesCard />
            <div className="mt-4">
              <BudgetVsActualTable categories={categories || []} year={year} />
            </div>
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">

              {/* Left: Budget categories */}
              <div className="space-y-3">
                {(categories || []).map((cat) => (
                  <BudgetCategoryTable
                    key={cat.id}
                    category={cat}
                    onAddLineItem={(catId, name, amount) =>
                      mutations.addLineItem.mutate({ categoryId: catId, name, amount }, {
                        onSuccess: () => toast.success("Post toegevoegd"),
                      })
                    }
                    onUpdateLineItem={(id, name, amount) => mutations.updateLineItem.mutate({ id, name, amount })}
                    onDeleteLineItem={(id) => mutations.deleteLineItem.mutate(id, { onSuccess: () => toast.success("Post verwijderd") })}
                    onDeleteCategory={(id) => mutations.deleteCategory.mutate(id, { onSuccess: () => toast.success("Categorie verwijderd") })}
                    onOpenExpenses={(lineItemId, lineItemName) => setExpenseDialog({ lineItemId, lineItemName })}
                    getCellClicks={(li) => {
                      if (li.name.toLowerCase().includes("contribut")) {
                        return {
                          budgeted: () => setContributieBreakdown("invoices"),
                          spent: () => setContributieBreakdown("paid"),
                          remaining: () => setContributieBreakdown("unpaid"),
                        };
                      }
                      return null;
                    }}
                  />
                ))}

                {(categories || []).length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-primary/5">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col className="w-[30%]" />
                        <col className="w-[20%]" />
                        <col className="w-[20%]" />
                        <col className="w-[20%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <tbody>
                        <tr className="font-bold">
                          <td className="px-3 py-2">Totalen</td>
                          <td className="px-3 py-2"><CurrencyCell value={totalBudgeted} /></td>
                          <td className="px-3 py-2"><CurrencyCell value={totalSpent} /></td>
                          <td className={`px-3 py-2 ${totalBudgeted - totalSpent < 0 ? "text-destructive" : "text-green-600"}`}>
                            <CurrencyCell value={totalBudgeted - totalSpent} />
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {addingCategory ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Categorie naam (bijv. Advieskosten)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    />
                    <Button size="sm" variant="default" className="h-8" onClick={handleAddCategory}>Toevoegen</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingCategory(false)}>Annuleer</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAddingCategory(true)}>
                    <Plus size={14} className="mr-1" /> Categorie toevoegen
                  </Button>
                )}
              </div>

              {/* Right: Balance panel */}
              <div>
                <BalancePanel
                  items={balanceItems || []}
                  totalBudgeted={totalBudgeted}
                  totalSpent={totalSpent}
                  bankStatement={bankStatement}
                  contributionStats={contributionStats}
                  notes={budgetNotes}
                  year={year}
                  onAdd={(name, amount, section, side) =>
                    mutations.addBalanceItem.mutate({ name, amount, section, side }, { onSuccess: () => toast.success("Post toegevoegd") })
                  }
                  onUpdate={(id, name, amount) => mutations.updateBalanceItem.mutate({ id, name, amount })}
                  onDelete={(id) => mutations.deleteBalanceItem.mutate(id, { onSuccess: () => toast.success("Post verwijderd") })}
                  onAddNote={(note) => user && mutations.addNote.mutate({ note, userId: user.id }, { onSuccess: () => toast.success("Notitie opgeslagen") })}
                  onDeleteNote={(id) => mutations.deleteNote.mutate(id, { onSuccess: () => toast.success("Notitie verwijderd") })}
                  onUpdateYearSettings={(settings) => yearSettingsMutation.mutate(settings, { onSuccess: () => toast.success("Jaarinstellingen opgeslagen") })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contributie">
            <ContributieTab year={year} />
          </TabsContent>


          <TabsContent value="boekingen">
            <BankBalancesCard />
            <div className="mt-4" />
            <BankboekingenTab year={year} />
            <BoekingenOverzicht
              categories={categories || []}
              contributions={contributions || []}
              bankStatement={bankStatement}
              members={allMembersForLookup.map((m) => ({ id: m.id, naam: m.naam }))}
              year={year}
              onDeleteExpense={(id) => mutations.deleteExpense.mutate(id, { onSuccess: () => toast.success("Uitgave verwijderd") })}
              onUpdateExpense={(id, fields) => mutations.updateExpense.mutate({ id, ...fields }, { onSuccess: () => toast.success("Boeking bijgewerkt") })}
              onUpdateBankTransaction={(id, fields) => mutations.updateBankTransaction.mutate(
                { id, applyToSimilar: true, ...fields },
                {
                  onSuccess: (result) => {
                    const extra = result?.similarUpdated ?? 0;
                    toast.success(
                      extra > 0
                        ? `Banktransactie bijgewerkt — ook ${extra} vergelijkbare boeking${extra === 1 ? "" : "en"} aangepast`
                        : "Banktransactie bijgewerkt"
                    );
                  },
                }
              )}
              onOpenPdfImport={() => setPdfImportOpen(true)}
              onOpenDuplicates={() => setDuplicatesOpen(true)}
            />
          </TabsContent>

          <TabsContent value="intern">
            <div className="mt-4">
              <InternalDeclarationsView
                declarations={internalDeclarations || []}
                year={year}
                isAdmin={isAdmin}
                userId={user?.id || ""}
                onAdd={(decl) => internalMutations.add.mutate(decl, { onSuccess: () => toast.success("Declaratie ingediend") })}
                onDelete={(id) => internalMutations.remove.mutate(id, { onSuccess: () => toast.success("Declaratie verwijderd") })}
                onApprove={(id) => internalMutations.approve.mutate({ id, reviewerId: user!.id }, { onSuccess: () => toast.success("Declaratie goedgekeurd") })}
                onReject={(id) => internalMutations.reject.mutate({ id, reviewerId: user!.id }, { onSuccess: () => toast.success("Declaratie afgewezen") })}
              />
            </div>
          </TabsContent>

          <TabsContent value="dossiers">
            <DossierOverzichtTab
              categories={categories || []}
              year={year}
              onUpdateExpense={(id, fields) => mutations.updateExpense.mutate({ id, ...fields }, { onSuccess: () => toast.success("Dossier bijgewerkt") })}
              onUpdateBankTransaction={(id, fields) => mutations.updateBankTransaction.mutate({ id, ...fields }, { onSuccess: () => toast.success("Dossier bijgewerkt") })}
            />
          </TabsContent>

          <TabsContent value="todo">
            <FinancieelTodoTab year={year} />
          </TabsContent>

          <TabsContent value="informer">
            <InformerSyncTab />
          </TabsContent>
        </Tabs>
        </>
      )}

      {expenseDialog && user && (
        <ExpenseDialog
          open={!!expenseDialog}
          onOpenChange={(open) => !open && setExpenseDialog(null)}
          lineItemName={expenseDialog.lineItemName}
          lineItemId={expenseDialog.lineItemId}
          expenses={selectedLineItemExpenses}
          onAddExpense={(expense) => mutations.addExpense.mutate(expense, { onSuccess: () => toast.success("Uitgave toegevoegd") })}
          onDeleteExpense={(id) => mutations.deleteExpense.mutate(id, { onSuccess: () => toast.success("Uitgave verwijderd") })}
          onUpdateExpense={(id, fields) => mutations.updateExpense.mutate({ id, ...fields }, { onSuccess: () => toast.success("Boeking verplaatst") })}
          categories={categories || []}
          userId={user.id}
        />
      )}

      {user && (
        <PdfImportDialog
          open={pdfImportOpen}
          onOpenChange={setPdfImportOpen}
          categories={categories || []}
          members={allMembersForLookup.map((m) => ({ id: m.id, naam: m.naam }))}
          contributions={contributions || []}
          onImport={async (expenses) => {
            for (const exp of expenses) {
              await mutations.addExpense.mutateAsync({ ...exp, direction: "out" });
            }
          }}
          onImportIncome={async (incomes) => {
            for (const inc of incomes) {
              await upsertContribution.mutateAsync({
                member_id: inc.member_id,
                year,
                amount: inc.amount,
                paid: true,
                paid_date: inc.paid_date,
              });
            }
          }}
          onReplaceBankStatement={async ({ fileName, openingBalance, closingBalance, transactions }) => {
            await mutations.replaceBankStatement.mutateAsync({
              fileName,
              openingBalance,
              closingBalance,
              transactions,
              userId: user.id,
            });
          }}
          userId={user.id}
          year={year}
        />
      )}

      <DuplicatesDialog
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        categories={categories || []}
        onDeleteExpense={(id) => mutations.deleteExpense.mutateAsync(id)}
      />

      <ContributiesBreakdownDialog
        open={contributieBreakdown !== null}
        onOpenChange={(o) => !o && setContributieBreakdown(null)}
        mode={contributieBreakdown ?? "invoices"}
        year={year}
        budgetedMemberCount={yearSettings?.budgeted_member_count ?? contributionStats.totalMembers}
        invoices={contributionInvoices ?? []}
        contributions={contributions ?? []}
        members={allMembersForLookup.map((m) => ({ id: m.id, naam: m.naam, bedrijfsnaam: (m as any).bedrijfsnaam }))}
      />
    </div>
  );
}

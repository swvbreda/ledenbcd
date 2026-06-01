import { useState, useMemo, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useBankStatement, useBudgetCategories, useBudgetBalance, useBudgetMutations, useBudgetNotes, useBudgetYearSettings, useBudgetYearSettingsMutation } from "@/hooks/useBudget";
import { useAuth } from "@/hooks/useAuth";
import { useInternalDeclarations, useInternalDeclarationMutations } from "@/hooks/useInternalDeclarations";
import { useContributions, useUpsertContribution } from "@/hooks/useContributions";
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
  const upsertContribution = useUpsertContribution();
  const { effectiveMembers } = useMembers();
  const { rawOldMembers } = useMembersData();
  const allMembersForLookup = useMemo(
    () => [...effectiveMembers, ...rawOldMembers],
    [effectiveMembers, rawOldMembers]
  );

  // Auto-categoriseer inkomende banktransacties als contributie wanneer de
  // tegenpartij overeenkomt met een lid (bedrijfsnaam of naam). Werkt ook het
  // ledenbestand (member_contributions) bij naar "betaald".
  const autoMatchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    if (!bankStatement?.transactions?.length) return;
    if (!allMembersForLookup.length) return;

    const normalize = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|n\.?v\.?|c\.?v\.?|coffeeshop|coffeshop|the)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const memberIndex = allMembersForLookup
      .map((m) => ({
        id: m.id,
        naam: m.naam,
        keys: [m.bedrijfsnaam, m.naam, m.factuurBedrijfsnaam]
          .map((v) => normalize(v || ""))
          .filter((v) => v.length >= 3),
      }))
      .filter((m) => m.keys.length > 0);

    const findMember = (counterparty: string | null) => {
      const n = normalize(counterparty || "");
      if (!n) return null;
      // Exact / contained match op één van de keys
      for (const m of memberIndex) {
        if (m.keys.some((k) => n === k || n.includes(k) || k.includes(n))) {
          return m;
        }
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

      const match = findMember(tx.counterparty);
      if (!match) continue;

      autoMatchedRef.current.add(tx.id);

      const dossier = `Contributie · ${match.naam} (#${match.id})`;
      mutations.updateBankTransaction.mutate({
        id: tx.id,
        dossier,
        line_item_id: null,
        applyToSimilar: false,
      });

      if (!contribByMember.get(match.id)) {
        upsertContribution.mutate({
          member_id: match.id,
          year,
          amount: tx.amount || contributionAmount,
          paid: true,
          paid_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankStatement?.transactions, allMembersForLookup, contributions, user, year]);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<{ lineItemId: string; lineItemName: string } | null>(null);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  

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
      (ls, li) => ls + li.expenses.reduce((es, e) => es + (e.direction === "in" ? 0 : e.amount), 0),
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
          </TabsList>

          <TabsContent value="dashboard">
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
            />
          </TabsContent>

          <TabsContent value="todo">
            <FinancieelTodoTab year={year} />
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
    </div>
  );
}

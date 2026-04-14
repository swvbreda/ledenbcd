import { useState, useMemo } from "react";
import { Plus, Upload } from "lucide-react";
import { useBudgetCategories, useBudgetBalance, useBudgetMutations, useBudgetNotes } from "@/hooks/useBudget";
import { useAuth } from "@/hooks/useAuth";
import { useInternalDeclarations, useInternalDeclarationMutations } from "@/hooks/useInternalDeclarations";
import { useContributions } from "@/hooks/useContributions";
import { useMembers } from "@/hooks/useMembers";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import BudgetCategoryTable from "@/components/budget/BudgetCategoryTable";
import BalancePanel from "@/components/budget/BalancePanel";
import ExpenseDialog from "@/components/budget/ExpenseDialog";
import ExpenseListView from "@/components/budget/ExpenseListView";
import InternalDeclarationsView from "@/components/budget/InternalDeclarationsView";
import ContributieTab from "@/components/budget/ContributieTab";
import PdfImportDialog from "@/components/budget/PdfImportDialog";
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
  const { data: categories, isLoading } = useBudgetCategories(year);
  const { data: balanceItems } = useBudgetBalance(year);
  const mutations = useBudgetMutations(year);
  const { data: internalDeclarations } = useInternalDeclarations(year);
  const internalMutations = useInternalDeclarationMutations(year);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<{ lineItemId: string; lineItemName: string } | null>(null);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  const totalBudgeted = (categories || []).reduce(
    (s, c) => s + c.line_items.reduce((ls, li) => ls + li.budgeted_amount, 0), 0
  );
  const totalSpent = (categories || []).reduce(
    (s, c) => s + c.line_items.reduce((ls, li) => ls + li.expenses.reduce((es, e) => es + e.amount, 0), 0), 0
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
      <div className="flex items-center justify-between">
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
      </div>

      {isLoading ? (
        <LoadingSpinner message="Financiële gegevens laden..." />
      ) : (
        <Tabs defaultValue="contributie" className="space-y-1">
          <TabsList className="bg-muted/60 h-10">
            <TabsTrigger value="contributie" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Contributie
            </TabsTrigger>
            <TabsTrigger value="begroting" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Begroting
            </TabsTrigger>
            <TabsTrigger value="declaraties" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Declaraties
            </TabsTrigger>
            <TabsTrigger value="intern" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Interne declaraties
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contributie">
            <ContributieTab year={year} />
          </TabsContent>

          <TabsContent value="begroting">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mt-4">
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
                      <tbody>
                        <tr className="font-bold">
                          <td className="px-3 py-2 w-[40%]">Totalen</td>
                          <td className="text-right px-3 py-2 tabular-nums w-[18%]">{fmt(totalBudgeted)}</td>
                          <td className="text-right px-3 py-2 tabular-nums w-[18%]">{fmt(totalSpent)}</td>
                          <td className={`text-right px-3 py-2 tabular-nums w-[18%] ${totalBudgeted - totalSpent < 0 ? "text-destructive" : "text-green-600"}`}>
                            {fmt(totalBudgeted - totalSpent)}
                          </td>
                          <td className="w-[6%]" />
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

              <div>
                <BalancePanel
                  items={balanceItems || []}
                  totalBudgeted={totalBudgeted}
                  totalSpent={totalSpent}
                  onAdd={(name, amount, section) =>
                    mutations.addBalanceItem.mutate({ name, amount, section }, { onSuccess: () => toast.success("Post toegevoegd") })
                  }
                  onUpdate={(id, name, amount) => mutations.updateBalanceItem.mutate({ id, name, amount })}
                  onDelete={(id) => mutations.deleteBalanceItem.mutate(id, { onSuccess: () => toast.success("Post verwijderd") })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="declaraties">
            <div className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setPdfImportOpen(true)}>
                  <Upload size={14} className="mr-1" /> PDF importeren
                </Button>
              </div>
              <ExpenseListView
                categories={categories || []}
                onDeleteExpense={(id) => mutations.deleteExpense.mutate(id, { onSuccess: () => toast.success("Uitgave verwijderd") })}
              />
            </div>
          </TabsContent>

          <TabsContent value="intern">
            <div className="mt-4">
              <InternalDeclarationsView
                declarations={internalDeclarations || []}
                year={year}
                onAdd={(decl) => internalMutations.add.mutate(decl, { onSuccess: () => toast.success("Declaratie toegevoegd") })}
                onDelete={(id) => internalMutations.remove.mutate(id, { onSuccess: () => toast.success("Declaratie verwijderd") })}
              />
            </div>
          </TabsContent>
        </Tabs>
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
          userId={user.id}
        />
      )}

      {user && (
        <PdfImportDialog
          open={pdfImportOpen}
          onOpenChange={setPdfImportOpen}
          categories={categories || []}
          onImport={async (expenses) => {
            for (const exp of expenses) {
              await mutations.addExpense.mutateAsync(exp);
            }
          }}
          userId={user.id}
        />
      )}
    </div>
  );
}

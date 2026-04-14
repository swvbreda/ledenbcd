import { useState } from "react";
import { Plus } from "lucide-react";
import { useBudgetCategories, useBudgetBalance, useBudgetMutations } from "@/hooks/useBudget";
import { useAuth } from "@/hooks/useAuth";
import { useInternalDeclarations, useInternalDeclarationMutations } from "@/hooks/useInternalDeclarations";
import BudgetCategoryTable from "@/components/budget/BudgetCategoryTable";
import BalancePanel from "@/components/budget/BalancePanel";
import ExpenseDialog from "@/components/budget/ExpenseDialog";
import ExpenseListView from "@/components/budget/ExpenseListView";
import InternalDeclarationsView from "@/components/budget/InternalDeclarationsView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function FinancienPage() {
  const [year, setYear] = useState(currentYear);
  const { user } = useAuth();
  const { data: categories, isLoading } = useBudgetCategories(year);
  const { data: balanceItems } = useBudgetBalance(year);
  const mutations = useBudgetMutations(year);
  const { data: internalDeclarations } = useInternalDeclarations(year);
  const internalMutations = useInternalDeclarationMutations(year);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<{ lineItemId: string; lineItemName: string } | null>(null);

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
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display">Financieel Overzicht</h1>
          <p className="text-sm text-muted-foreground">Begrotingen en uitgaven beheren</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 h-8">
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
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : (
        <Tabs defaultValue="begroting">
          <TabsList>
            <TabsTrigger value="begroting">Begroting</TabsTrigger>
            <TabsTrigger value="declaraties">Declaraties</TabsTrigger>
            <TabsTrigger value="intern">Interne declaraties</TabsTrigger>
          </TabsList>

          <TabsContent value="begroting">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mt-4">
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

              {/* Right: Balance panel */}
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
            <div className="mt-4">
              <ExpenseListView
                categories={categories || []}
                onDeleteExpense={(id) => mutations.deleteExpense.mutate(id, { onSuccess: () => toast.success("Uitgave verwijderd") })}
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
    </div>
  );
}

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { BudgetCategory } from "@/hooks/useBudget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";

interface Props {
  category: BudgetCategory;
  onAddLineItem: (categoryId: string, name: string, amount: number) => void;
  onUpdateLineItem: (id: string, name?: string, amount?: number) => void;
  onDeleteLineItem: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onOpenExpenses: (lineItemId: string, lineItemName: string) => void;
  getCellClicks?: (li: BudgetCategory["line_items"][number]) => {
    budgeted?: () => void;
    spent?: () => void;
    remaining?: () => void;
    spentValue?: number;
    remainingValue?: number;
    remainingLabel?: string;
    remainingHint?: string;
  } | null;
}

export default function BudgetCategoryTable({
  category,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onDeleteCategory,
  onOpenExpenses,
  getCellClicks,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const totalBudgeted = category.line_items.reduce((s, li) => s + li.budgeted_amount, 0);
  const isIncome = category.name.toLowerCase() === "inkomsten";
  const expenseSign = (e: BudgetCategory["line_items"][number]["expenses"][number]) =>
    // Voor inkomstenposten tellen ontvangen bedragen (direction=in) als
    // "gerealiseerd"; uitgaande boekingen zijn correcties (negatief).
    // Voor kostenposten is het andersom: uit=gerealiseerd, in=refund.
    e.direction === "in" ? (isIncome ? 1 : -1) : (isIncome ? -1 : 1);
  // Alleen daadwerkelijk betaalde boekingen tellen mee in Uitgaven.
  const sumExpenses = (li: typeof category.line_items[number]) =>
    li.expenses.reduce((es, e) => (e.paid === false ? es : es + expenseSign(e) * e.amount), 0);
  const sumUnpaid = (li: typeof category.line_items[number]) =>
    li.expenses.reduce((es, e) => (e.paid === false ? es + expenseSign(e) * e.amount : es), 0);
  const totalSpent = category.line_items.reduce((s, li) => {
    const clicks = getCellClicks ? getCellClicks(li) : null;
    return s + (clicks?.spentValue ?? sumExpenses(li));
  }, 0);
  const totalUnpaid = category.line_items.reduce((s, li) => s + sumUnpaid(li), 0);
  const remainingOf = (li: typeof category.line_items[number]) => {
    const clicks = getCellClicks ? getCellClicks(li) : null;
    const spentValue = clicks?.spentValue ?? sumExpenses(li);
    return clicks?.remainingValue ?? (li.budgeted_amount - spentValue);
  };
  // Netto per categorie: begroot − uitgegeven.
  const totalRemaining = category.line_items.reduce((s, li) => s + remainingOf(li), 0);

  const spentLabel = isIncome ? "Ontvangen" : "Uitgaven";
  const remainingLabel = isIncome ? "Nog te ontvangen" : "Beschikbaar";
  const remainingClass = (v: number) =>
    isIncome
      ? (v <= 0 ? "text-green-600" : "")
      : (v < 0 ? "text-destructive" : "");
  const totalRemainingClass = isIncome
    ? (totalRemaining <= 0 ? "text-green-600" : "text-foreground")
    : (totalRemaining < 0 ? "text-destructive" : "text-green-600");


  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddLineItem(category.id, newName.trim(), parseFloat(newAmount) || 0);
    setNewName("");
    setNewAmount("");
    setAdding(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr
            className="bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <h3 className="text-sm font-semibold">{category.name}</h3>
              </div>
            </td>
            <td className="text-right px-3 py-2 text-sm">
              {!expanded && <><span className="text-muted-foreground text-xs">Begroot: </span><strong className="text-foreground"><CurrencyText value={totalBudgeted} className="justify-end" /></strong></>}
            </td>
            <td className="text-right px-3 py-2 text-sm">
              {!expanded && <><span className="text-muted-foreground text-xs">{spentLabel}: </span><strong className="text-foreground"><CurrencyText value={totalSpent} className="justify-end" /></strong></>}
            </td>
            <td className="text-right px-3 py-2 text-sm">
              {!expanded && (
                <>
                  <span className="text-muted-foreground text-xs">{remainingLabel}: </span>
                  <strong className={totalRemainingClass}>
                    <CurrencyText value={totalRemaining} className="justify-end" />
                  </strong>
                  {!isIncome && totalRemaining < 0 && (
                    <span className="text-destructive text-xs ml-1">(overschreden)</span>
                  )}
                </>
              )}
            </td>

            <td />
          </tr>
        </thead>
        {expanded && (
          <tbody>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Post</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Begroot</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">{spentLabel}</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">{remainingLabel}</th>
              <th />
            </tr>
            {category.line_items.map((li) => {
              const spent = sumExpenses(li);
              const clicks = getCellClicks ? getCellClicks(li) : null;
              const spentValue = clicks?.spentValue ?? spent;
              const remaining = clicks?.remainingValue ?? (li.budgeted_amount - spentValue);
              const rowRemainingLabel = clicks?.remainingLabel;
              const cellBtn = (fn?: () => void) =>
                fn
                  ? (e: React.MouseEvent) => { e.stopPropagation(); fn(); }
                  : undefined;
              const clickableClass = (fn?: () => void) =>
                fn ? "cursor-pointer hover:underline underline-offset-2 decoration-dotted" : "";
              return (
                <tr
                  key={li.id}
                  className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => onOpenExpenses(li.id, li.name)}
                >
                  <td className="px-3 py-1.5">
                    {li.name}
                    {clicks?.remainingHint && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{clicks.remainingHint}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5" onClick={cellBtn(clicks?.budgeted)}>
                    <CurrencyCell value={li.budgeted_amount} className={clickableClass(clicks?.budgeted)} />
                  </td>
                  <td className="px-3 py-1.5" onClick={cellBtn(clicks?.spent)}>
                    {spentValue !== 0 ? <CurrencyCell value={spentValue} className={clickableClass(clicks?.spent)} /> : ""}
                  </td>
                  <td className="px-3 py-1.5" onClick={cellBtn(clicks?.remaining)}>
                    <div className="flex flex-col items-end">
                      <CurrencyCell value={remaining} className={`${remainingClass(remaining)} ${clickableClass(clicks?.remaining)}`} />
                      {rowRemainingLabel && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rowRemainingLabel}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteLineItem(li.id); }}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/30 font-medium">
              <td className="px-3 py-1.5">Subtotaal</td>
              <td className="px-3 py-1.5 font-semibold"><CurrencyCell value={totalBudgeted} /></td>
              <td className="px-3 py-1.5 font-semibold"><CurrencyCell value={totalSpent} /></td>
              <td className="px-3 py-1.5 font-semibold">
                <CurrencyCell value={totalRemaining} className={totalRemainingClass} />
              </td>
              <td />
            </tr>
            {totalUnpaid !== 0 && (
              <tr className="bg-muted/10 text-muted-foreground">
                <td className="px-3 py-1.5 text-xs">Nog te betalen (niet in Uitgaven)</td>
                <td />
                <td className="px-3 py-1.5 text-xs"><CurrencyCell value={totalUnpaid} className="text-xs" /></td>
                <td />
                <td />
              </tr>
            )}

          </tbody>
        )}
      </table>

      {expanded && (
        <>
          {adding ? (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
              <Input
                placeholder="Naam post"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Input
                placeholder="Bedrag"
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="h-7 text-sm w-28"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleAdd}>Toevoegen</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Annuleer</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50">
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={12} /> Post toevoegen
              </button>
              <button
                onClick={() => onDeleteCategory(category.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Categorie verwijderen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

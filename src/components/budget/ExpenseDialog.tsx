import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import type { BudgetExpense } from "@/hooks/useBudget";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItemName: string;
  lineItemId: string;
  expenses: BudgetExpense[];
  onAddExpense: (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }) => void;
  onDeleteExpense: (id: string) => void;
  userId: string;
}

export default function ExpenseDialog({ open, onOpenChange, lineItemName, lineItemId, expenses, onAddExpense, onDeleteExpense, userId }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [creditor, setCreditor] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [dossier, setDossier] = useState("");

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleAdd = () => {
    if (!amount) return;
    onAddExpense({
      line_item_id: lineItemId,
      description: description || undefined,
      amount: parseFloat(amount),
      expense_date: date || undefined,
      creditor_name: creditor || undefined,
      invoice_reference: invoiceRef || undefined,
      dossier: dossier || undefined,
      created_by: userId,
    });
    setDescription("");
    setAmount("");
    setDate("");
    setCreditor("");
    setInvoiceRef("");
    setDossier("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uitgaven – {lineItemName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {expenses.length > 0 ? (
            <div className="overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Datum</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Omschrijving</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Dossier</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Leverancier</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Factuurnr.</th>
                    <th className="text-right px-2 py-1 text-muted-foreground font-medium">Bedrag</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-2 py-1 whitespace-nowrap">{e.expense_date || "–"}</td>
                      <td className="px-2 py-1">{e.description || "–"}</td>
                      <td className="px-2 py-1">{e.dossier || "–"}</td>
                      <td className="px-2 py-1">{e.creditor_name || "–"}</td>
                      <td className="px-2 py-1 tabular-nums">{e.invoice_reference || "–"}</td>
                      <td className="text-right px-2 py-1"><CurrencyCell value={e.amount} /></td>
                      <td className="px-1">
                        <button onClick={() => onDeleteExpense(e.id)} className="p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium bg-muted/30">
                    <td className="px-2 py-1" colSpan={5}>Totaal</td>
                    <td className="text-right px-2 py-1"><CurrencyCell value={total} /></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen uitgaven geregistreerd.</p>
          )}

          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Nieuwe uitgave toevoegen</p>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Omschrijving" value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Dossier" value={dossier} onChange={(e) => setDossier(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Leverancier" value={creditor} onChange={(e) => setCreditor(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Factuurnummer" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} className="h-8 text-sm" />
              <Input type="number" placeholder="Bedrag (€)" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" />
            </div>
            <Button size="sm" className="mt-2" onClick={handleAdd} disabled={!amount}>
              <Plus size={14} className="mr-1" /> Toevoegen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

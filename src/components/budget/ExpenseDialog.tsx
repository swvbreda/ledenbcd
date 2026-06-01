import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BudgetExpense, BudgetCategory } from "@/hooks/useBudget";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItemName: string;
  lineItemId: string;
  expenses: BudgetExpense[];
  onAddExpense: (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense?: (id: string, fields: { line_item_id?: string; dossier?: string | null }) => void;
  categories?: BudgetCategory[];
  userId: string;
}

export default function ExpenseDialog({ open, onOpenChange, lineItemName, lineItemId, expenses, onAddExpense, onDeleteExpense, onUpdateExpense, categories, userId }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [creditor, setCreditor] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [dossier, setDossier] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLineItemId, setEditLineItemId] = useState<string>("");

  const allLineItems = (categories || []).flatMap((c) =>
    c.line_items.map((li) => ({ id: li.id, label: `${c.name} → ${li.name}` }))
  );

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
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-2 py-1 whitespace-nowrap">{e.expense_date || ""}</td>
                      <td className="px-2 py-1">
                        {editingId === e.id && onUpdateExpense ? (
                          <Select value={editLineItemId} onValueChange={setEditLineItemId}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Kies post..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allLineItems.map((li) => (
                                <SelectItem key={li.id} value={li.id} className="text-xs">{li.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          e.description || ""
                        )}
                      </td>
                      <td className="px-2 py-1">{e.dossier || ""}</td>
                      <td className="px-2 py-1">{e.creditor_name || ""}</td>
                      <td className="px-2 py-1 tabular-nums">{e.invoice_reference || ""}</td>
                      <td className="text-right px-2 py-1"><CurrencyCell value={e.amount} /></td>
                      <td className="px-1">
                        <div className="flex items-center gap-0.5">
                          {onUpdateExpense && editingId !== e.id && (
                            <button
                              onClick={() => { setEditingId(e.id); setEditLineItemId(e.line_item_id); }}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              title="Verplaats naar andere post"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {editingId === e.id && onUpdateExpense && (
                            <>
                              <button
                                onClick={() => {
                                  if (editLineItemId && editLineItemId !== e.line_item_id) {
                                    onUpdateExpense(e.id, { line_item_id: editLineItemId });
                                  }
                                  setEditingId(null);
                                }}
                                className="p-1 text-green-600 hover:text-green-700"
                                title="Opslaan"
                              >
                                <Check size={12} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-destructive" title="Annuleren">
                                <X size={12} />
                              </button>
                            </>
                          )}
                          <button onClick={() => onDeleteExpense(e.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Verwijderen">
                            <Trash2 size={12} />
                          </button>
                        </div>
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

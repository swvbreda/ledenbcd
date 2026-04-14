import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { BudgetBalanceItem } from "@/hooks/useBudget";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  items: BudgetBalanceItem[];
  totalBudgeted: number;
  totalSpent: number;
  onAdd: (name: string, amount: number, section: string) => void;
  onUpdate: (id: string, name?: string, amount?: number) => void;
  onDelete: (id: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

export default function BalancePanel({ items, totalBudgeted, totalSpent, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const middelenItems = items.filter((i) => i.section === "middelen");
  const resultaatItems = items.filter((i) => i.section === "resultaat");

  const middelenTotal = middelenItems.reduce((s, i) => s + i.amount, 0);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), parseFloat(newAmount) || 0, "middelen");
    setNewName("");
    setNewAmount("");
    setAdding(false);
  };

  const handleSaveEdit = (id: string) => {
    onUpdate(id, undefined, parseFloat(editAmount) || 0);
    setEditId(null);
  };

  return (
    <div className="space-y-4">
      {/* Middelen balans */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Middelen balans</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {middelenItems.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-1.5">{item.name}</td>
                <td className="text-right px-3 py-1.5 tabular-nums w-32">
                  {editId === item.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="h-6 text-xs w-24 text-right"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)}
                      />
                      <button onClick={() => handleSaveEdit(item.id)} className="text-green-600"><Check size={12} /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground"><X size={12} /></button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => { setEditId(item.id); setEditAmount(String(item.amount)); }}
                    >
                      {fmt(item.amount)}
                    </span>
                  )}
                </td>
                <td className="w-8 px-1">
                  <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-medium border-t border-border">
              <td className="px-3 py-1.5">Totaal middelen</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(middelenTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        {adding ? (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
            <Input placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
            <Input placeholder="Bedrag" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-7 text-sm w-28" />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleAdd}>Toevoegen</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Annuleer</Button>
          </div>
        ) : (
          <div className="px-3 py-1.5 border-t border-border/50">
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus size={12} /> Post toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Resultaat */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Resultaat</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {resultaatItems.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-1.5">{item.name}</td>
                <td className="text-right px-3 py-1.5 tabular-nums w-32">
                  <span
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => { setEditId(item.id); setEditAmount(String(item.amount)); }}
                  >
                    {fmt(item.amount)}
                  </span>
                </td>
                <td className="w-8 px-1">
                  <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5 text-muted-foreground">Begrote uitgaven</td>
              <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">{fmt(totalBudgeted)}</td>
              <td />
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5 text-muted-foreground">Werkelijke uitgaven</td>
              <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">{fmt(totalSpent)}</td>
              <td />
            </tr>
            <tr className="bg-muted/30 font-medium border-t border-border">
              <td className="px-3 py-1.5">Verschil</td>
              <td className={`text-right px-3 py-1.5 tabular-nums ${totalBudgeted - totalSpent < 0 ? "text-destructive" : "text-green-600"}`}>
                {fmt(totalBudgeted - totalSpent)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Samenvatting */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-primary/10">
          <h3 className="text-sm font-semibold">Totaaloverzicht</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5">Totaal begroot</td>
              <td className="text-right px-3 py-1.5 tabular-nums font-medium">{fmt(totalBudgeted)}</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5">Totaal uitgegeven</td>
              <td className="text-right px-3 py-1.5 tabular-nums font-medium">{fmt(totalSpent)}</td>
            </tr>
            <tr className="bg-muted/30 font-semibold">
              <td className="px-3 py-1.5">Beschikbaar budget</td>
              <td className={`text-right px-3 py-1.5 tabular-nums ${totalBudgeted - totalSpent < 0 ? "text-destructive" : "text-green-600"}`}>
                {fmt(totalBudgeted - totalSpent)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

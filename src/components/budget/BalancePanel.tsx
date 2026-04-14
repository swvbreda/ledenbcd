import { useState } from "react";
import { Plus, Trash2, Check, X, StickyNote } from "lucide-react";
import type { BudgetBalanceItem } from "@/hooks/useBudget";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ContributionStats {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  totalReceived: number;
  contributionAmount: number;
}

interface Props {
  items: BudgetBalanceItem[];
  totalBudgeted: number;
  totalSpent: number;
  contributionStats?: ContributionStats;
  notes?: { id: string; note: string; created_at: string }[];
  onAdd: (name: string, amount: number, section: string) => void;
  onUpdate: (id: string, name?: string, amount?: number) => void;
  onDelete: (id: string) => void;
  onAddNote?: (note: string) => void;
  onDeleteNote?: (id: string) => void;
  year: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

export default function BalancePanel({
  items, totalBudgeted, totalSpent, contributionStats, notes,
  onAdd, onUpdate, onDelete, onAddNote, onDeleteNote, year,
}: Props) {
  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [newNote, setNewNote] = useState("");

  const middelenItems = items.filter((i) => i.section === "middelen");
  const resultaatItems = items.filter((i) => i.section === "resultaat");

  const middelenTotal = middelenItems.reduce((s, i) => s + i.amount, 0);

  // Resultaat calculation
  const resultaatTotal = resultaatItems.reduce((s, i) => s + i.amount, 0);
  const netResult = resultaatTotal - totalSpent;

  const handleAdd = (section: string) => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), parseFloat(newAmount) || 0, section);
    setNewName(""); setNewAmount(""); setAdding(null);
  };

  const handleSaveEdit = (id: string) => {
    onUpdate(id, undefined, parseFloat(editAmount) || 0);
    setEditId(null);
  };

  const renderAmount = (item: BudgetBalanceItem) => {
    if (editId === item.id) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <Input
            type="number" value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            className="h-6 text-xs w-24 text-right" autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)}
          />
          <button onClick={() => handleSaveEdit(item.id)} className="text-green-600"><Check size={12} /></button>
          <button onClick={() => setEditId(null)} className="text-muted-foreground"><X size={12} /></button>
        </div>
      );
    }
    return (
      <span
        className="cursor-pointer hover:text-primary transition-colors"
        onClick={() => { setEditId(item.id); setEditAmount(String(item.amount)); }}
      >
        {fmt(item.amount)}
      </span>
    );
  };

  const renderAddRow = (section: string) => {
    if (adding === section) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
          <Input placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
          <Input placeholder="Bedrag" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-7 text-sm w-28" onKeyDown={(e) => e.key === "Enter" && handleAdd(section)} />
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAdd(section)}>Toevoegen</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>Annuleer</Button>
        </div>
      );
    }
    return (
      <div className="px-3 py-1.5 border-t border-border/50">
        <button onClick={() => { setAdding(section); setNewName(""); setNewAmount(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={12} /> Post toevoegen
        </button>
      </div>
    );
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
                <td className="text-right px-3 py-1.5 tabular-nums w-32">{renderAmount(item)}</td>
                <td className="w-8 px-1">
                  <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {/* Auto-computed rows */}
            <tr className="border-b border-border/50 text-muted-foreground">
              <td className="px-3 py-1.5">Begrote contributie ({contributionStats?.totalMembers ?? 0})</td>
              <td className="text-right px-3 py-1.5 tabular-nums w-32">
                {fmt((contributionStats?.totalMembers ?? 0) * (contributionStats?.contributionAmount ?? 3000))}
              </td>
              <td className="w-8" />
            </tr>
            <tr className="border-b border-border/50 text-muted-foreground">
              <td className="px-3 py-1.5">Begrote uitgaven</td>
              <td className="text-right px-3 py-1.5 tabular-nums w-32">{fmt(totalBudgeted)}</td>
              <td className="w-8" />
            </tr>
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-1.5">Totaal middelen</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(middelenTotal + (contributionStats?.totalMembers ?? 0) * (contributionStats?.contributionAmount ?? 3000))}</td>
              <td className="w-8">
                <span className="text-right tabular-nums text-xs text-muted-foreground px-1">{fmt(middelenTotal + (contributionStats?.totalMembers ?? 0) * (contributionStats?.contributionAmount ?? 3000))}</span>
              </td>
            </tr>
          </tbody>
        </table>
        {renderAddRow("middelen")}
      </div>

      {/* Resultaat */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Resultaat</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-1 font-medium text-muted-foreground text-xs"></th>
              <th className="text-right px-3 py-1 font-medium text-muted-foreground text-xs w-28"></th>
              <th className="text-right px-3 py-1 font-medium text-muted-foreground text-xs w-28">Verschil</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {resultaatItems.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-1.5">{item.name}</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{renderAmount(item)}</td>
                <td className="text-right px-3 py-1.5 tabular-nums" />
                <td className="w-8 px-1">
                  <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {/* Contribution received */}
            {contributionStats && (
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Ontvangen contributie</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{fmt(contributionStats.totalReceived)}</td>
                <td className="text-right px-3 py-1.5 tabular-nums text-destructive">
                  {fmt(contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount)}
                </td>
                <td className="px-1">
                  <span className="text-[10px] text-muted-foreground leading-tight block">
                    {contributionStats.unpaidCount} nog te betalen
                  </span>
                </td>
              </tr>
            )}
            {/* Expenses */}
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5">Uitgaven {year}</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(totalSpent)}</td>
              <td className="text-right px-3 py-1.5 tabular-nums" />
              <td className="w-8" />
            </tr>
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-2">Totaal</td>
              <td className={`text-right px-3 py-2 tabular-nums ${netResult < 0 ? "text-destructive" : ""}`}>
                {fmt(resultaatTotal + (contributionStats?.totalReceived ?? 0) - totalSpent)}
              </td>
              <td className={`text-right px-3 py-2 tabular-nums ${(contributionStats ? contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount : 0) < 0 ? "text-destructive" : ""}`}>
                {contributionStats && fmt(contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        {renderAddRow("resultaat")}
      </div>

      {/* Contributie samenvatting */}
      {contributionStats && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50">
            <h3 className="text-sm font-semibold">Contributie overzicht</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5 font-medium">Aantal leden</td>
                <td className="text-right px-3 py-1.5 tabular-nums font-semibold">{contributionStats.totalMembers}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Contributie per lid</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{fmt(contributionStats.contributionAmount)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Betaald</td>
                <td className="text-right px-3 py-1.5 tabular-nums text-green-600">{contributionStats.paidCount} leden</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Nog te betalen</td>
                <td className="text-right px-3 py-1.5 tabular-nums text-destructive">{contributionStats.unpaidCount} leden</td>
              </tr>
              <tr className="bg-primary/5 font-semibold">
                <td className="px-3 py-1.5">Inkomsten {year}</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{fmt(contributionStats.totalMembers * contributionStats.contributionAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Maximale vrijwilligersvergoeding */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Maximale vrijwilligersvergoeding</h3>
        </div>
        <table className="w-full text-sm text-muted-foreground">
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Maximaal per uur</td>
              <td className="text-right px-3 py-1 tabular-nums">€ 5,50</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Maximaal per maand</td>
              <td className="text-right px-3 py-1 tabular-nums">€ 210</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Maximaal per jaar</td>
              <td className="text-right px-3 py-1 tabular-nums">€ 2.100</td>
            </tr>
            <tr>
              <td className="px-3 py-1">Reiskosten</td>
              <td className="text-right px-3 py-1 tabular-nums">€ 0,23 per km</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notities */}
      {onAddNote && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
            <StickyNote size={14} />
            <h3 className="text-sm font-semibold">Notities</h3>
          </div>
          <div className="p-3 space-y-2">
            {(notes || []).map((n) => (
              <div key={n.id} className="flex items-start gap-2 text-sm">
                <p className="flex-1 whitespace-pre-wrap text-muted-foreground">{n.note}</p>
                {onDeleteNote && (
                  <button onClick={() => onDeleteNote(n.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Textarea
                placeholder="Notitie toevoegen..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              disabled={!newNote.trim()}
              onClick={() => { onAddNote(newNote.trim()); setNewNote(""); }}
            >
              Notitie opslaan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

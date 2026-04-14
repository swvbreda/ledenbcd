import { useState } from "react";
import { Plus, Trash2, Check, X, StickyNote } from "lucide-react";
import type { BudgetBalanceItem } from "@/hooks/useBudget";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  onAdd: (name: string, amount: number, section: string, side?: string) => void;
  onUpdate: (id: string, name?: string, amount?: number) => void;
  onDelete: (id: string) => void;
  onAddNote?: (note: string) => void;
  onDeleteNote?: (id: string) => void;
  year: number;
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const CurrencyCell = ({ value, className = "" }: { value: number; className?: string }) => (
  <span className={`tabular-nums text-right block ${className}`}>
    € {fmtNum(value)}
  </span>
);

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

export default function BalancePanel({
  items, totalBudgeted, totalSpent, contributionStats, notes,
  onAdd, onUpdate, onDelete, onAddNote, onDeleteNote, year,
}: Props) {
  const [adding, setAdding] = useState<string | null>(null);
  const [addSide, setAddSide] = useState<string>("right");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [newNote, setNewNote] = useState("");

  const middelenLeft = items.filter((i) => i.section === "middelen" && i.side === "left");
  const middelenRight = items.filter((i) => i.section === "middelen" && i.side === "right");
  const resultaatItems = items.filter((i) => i.section === "resultaat");

  const leftTotal = middelenLeft.reduce((s, i) => s + i.amount, 0);
  const rightTotal = middelenRight.reduce((s, i) => s + i.amount, 0);

  const handleAdd = (section: string) => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), parseFloat(newAmount) || 0, section, addSide);
    setNewName(""); setNewAmount(""); setAdding(null); setAddSide("right");
  };

  const handleSaveEdit = (id: string) => {
    onUpdate(id, undefined, parseFloat(editAmount) || 0);
    setEditId(null);
  };

  const renderAmount = (item: BudgetBalanceItem) => {
    if (editId === item.id) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
            className="h-6 text-xs w-24 text-right" autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)} />
          <button onClick={() => handleSaveEdit(item.id)} className="text-green-600"><Check size={12} /></button>
          <button onClick={() => setEditId(null)} className="text-muted-foreground"><X size={12} /></button>
        </div>
      );
    }
    return (
      <span className="cursor-pointer hover:text-primary transition-colors block text-right tabular-nums"
        onClick={() => { setEditId(item.id); setEditAmount(String(item.amount)); }}>
        € {fmtNum(item.amount)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Middelen balans - two column */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Middelen balans</h3>
        </div>
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[25%]" />
            <col className="w-[25%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-1 font-medium text-muted-foreground text-xs">Bestedingen</th>
              <th className="text-right px-3 py-1 font-medium text-muted-foreground text-xs"></th>
              <th className="text-left px-3 py-1 font-medium text-muted-foreground text-xs">Middelen</th>
              <th className="text-right px-3 py-1 font-medium text-muted-foreground text-xs"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(middelenLeft.length + 1, middelenRight.length) }).map((_, i) => {
              const left = middelenLeft[i];
              // For right side, we use actual items; the extra auto-computed row (Begrote uitgaven) goes on left
              const right = middelenRight[i];
              // Show "Begrote uitgaven" as last left item (auto-computed)
              const isAutoLeft = !left && i === middelenLeft.length;
              return (
                <tr key={i} className="border-b border-border/50">
                  {/* Left cell */}
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {left ? left.name : isAutoLeft ? "Begrote uitgaven" : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums">
                    {left ? (
                      <div className="flex items-center justify-end gap-1">
                        {renderAmount(left)}
                        <button onClick={() => onDelete(left.id)} className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : isAutoLeft ? (
                      <span className="text-muted-foreground">{fmt(totalBudgeted)}</span>
                    ) : ""}
                  </td>
                  {/* Right cell */}
                  <td className="px-3 py-1.5">
                    {right ? right.name : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums">
                    {right ? (
                      <div className="flex items-center justify-end gap-1">
                        {renderAmount(right)}
                        <button onClick={() => onDelete(right.id)} className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : ""}
                  </td>
                </tr>
              );
            })}
            {/* Totaal row */}
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-1.5"></td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(leftTotal + totalBudgeted)}</td>
              <td className="px-3 py-1.5"></td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(rightTotal)}</td>
            </tr>
          </tbody>
        </table>
        {adding === "middelen" ? (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
            <Select value={addSide} onValueChange={setAddSide}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Bestedingen</SelectItem>
                <SelectItem value="right">Middelen</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
            <Input placeholder="Bedrag" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-7 text-sm w-24" onKeyDown={(e) => e.key === "Enter" && handleAdd("middelen")} />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAdd("middelen")}>OK</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>✕</Button>
          </div>
        ) : (
          <div className="px-3 py-1.5 border-t border-border/50">
            <button onClick={() => { setAdding("middelen"); setAddSide("right"); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus size={12} /> Post toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Resultaat */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Resultaat</h3>
          <span className="text-xs text-muted-foreground">Verschil</span>
        </div>
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[10%]" />
          </colgroup>
          <tbody>
            {resultaatItems.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-1.5">{item.name}</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{renderAmount(item)}</td>
                <td className="text-right px-3 py-1.5 tabular-nums" />
                <td className="px-1">
                  <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {/* Ontvangen contributie */}
            {contributionStats && (
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Ontvangen contributie</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{fmt(contributionStats.totalReceived)}</td>
                <td className="text-right px-3 py-1.5 tabular-nums text-destructive">
                  {fmt(contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount)}
                </td>
                <td />
              </tr>
            )}
            {/* Uitgaven */}
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5">Uitgaven {year}</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt(totalSpent)}</td>
              <td className="px-2">
                {contributionStats && (
                  <div className="text-[10px] text-muted-foreground leading-tight space-y-0.5">
                    <div>{contributionStats.unpaidCount} leden nog betalen</div>
                    <div>{contributionStats.paidCount} hebben betaald</div>
                  </div>
                )}
              </td>
              <td />
            </tr>
            {/* Totaal */}
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-2">Totaal</td>
              <td className={`text-right px-3 py-2 tabular-nums`}>
                {fmt(resultaatItems.reduce((s, i) => s + i.amount, 0) + (contributionStats?.totalReceived ?? 0) - totalSpent)}
              </td>
              <td className={`text-right px-3 py-2 tabular-nums ${(contributionStats ? contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount : 0) < 0 ? "text-destructive" : ""}`}>
                {contributionStats && fmt(contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        {adding === "resultaat" ? (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
            <Input placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
            <Input placeholder="Bedrag" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-7 text-sm w-24" onKeyDown={(e) => e.key === "Enter" && handleAdd("resultaat")} />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAdd("resultaat")}>OK</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>✕</Button>
          </div>
        ) : (
          <div className="px-3 py-1.5 border-t border-border/50">
            <button onClick={() => setAdding("resultaat")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus size={12} /> Post toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Contributie & Leden overzicht */}
      {contributionStats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-1.5 font-semibold">Aantal leden</td>
                  <td className="text-right px-3 py-1.5 tabular-nums font-semibold">{contributionStats.totalMembers}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-1.5">Contributie</td>
                  <td className="text-right px-3 py-1.5 tabular-nums">{fmt(contributionStats.contributionAmount)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-medium">Inkomsten {year}</td>
                  <td className="text-right px-3 py-1.5 tabular-nums font-medium">{fmt(contributionStats.totalMembers * contributionStats.contributionAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/50">
              <h3 className="text-xs font-semibold">Max. vrijwilligersvergoeding</h3>
            </div>
            <table className="w-full text-xs text-muted-foreground">
              <tbody>
                <tr className="border-b border-border/50"><td className="px-3 py-1">Per uur</td><td className="text-right px-3 py-1">€ 5,50</td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1">Per maand</td><td className="text-right px-3 py-1">€ 210</td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1">Per jaar</td><td className="text-right px-3 py-1">€ 2.100</td></tr>
                <tr><td className="px-3 py-1">Reiskosten</td><td className="text-right px-3 py-1">€ 0,23/km</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <button onClick={() => onDeleteNote(n.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={12} /></button>
                )}
              </div>
            ))}
            <Textarea placeholder="Notitie toevoegen..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="text-sm min-h-[60px]" />
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!newNote.trim()}
              onClick={() => { onAddNote(newNote.trim()); setNewNote(""); }}>
              Notitie opslaan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

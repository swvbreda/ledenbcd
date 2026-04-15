import { useState } from "react";
import { Plus, Trash2, Check, X, StickyNote } from "lucide-react";
import type { BudgetBalanceItem } from "@/hooks/useBudget";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyCell, formatEuro } from "@/components/budget/CurrencyAmount";

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
  onUpdateYearSettings?: (settings: { budgeted_member_count: number; contribution_amount: number }) => void;
  year: number;
}

export default function BalancePanel({
  items, totalBudgeted, totalSpent, contributionStats, notes,
  onAdd, onUpdate, onDelete, onAddNote, onDeleteNote, onUpdateYearSettings, year,
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
  const hasManualBudgetedExpenses = middelenLeft.some(
    (item) => item.name.trim().toLowerCase() === "begrote uitgaven",
  );

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
            className="h-7 text-sm w-28 text-right" autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)} />
          <button onClick={() => handleSaveEdit(item.id)} className="text-green-600"><Check size={12} /></button>
          <button onClick={() => setEditId(null)} className="text-muted-foreground"><X size={12} /></button>
        </div>
      );
    }
    return (
      <span className="cursor-pointer hover:text-primary transition-colors block"
        onClick={() => { setEditId(item.id); setEditAmount(String(item.amount)); }}>
        <CurrencyCell value={item.amount} />
      </span>
    );
  };

  const renderItemCell = (item: BudgetBalanceItem | undefined, isAuto = false, autoValue = 0) => {
    if (item) {
      return (
        <div className="relative group">
          {renderAmount(item)}
          <button onClick={() => onDelete(item.id)} className="absolute -right-4 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100">
            <Trash2 size={10} />
          </button>
        </div>
      );
    }
    if (isAuto) {
      return <CurrencyCell value={autoValue} className="text-muted-foreground" />;
    }
    return null;
  };

  const renderAddForm = (section: string, showSideSelect = false) => {
    if (adding === section) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
          {showSideSelect && (
            <Select value={addSide} onValueChange={setAddSide}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Debet</SelectItem>
                <SelectItem value="right">Credit</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
          <Input placeholder="Bedrag" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-7 text-sm w-28" onKeyDown={(e) => e.key === "Enter" && handleAdd(section)} />
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAdd(section)}>OK</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>✕</Button>
        </div>
      );
    }
    return (
      <div className="px-3 py-1.5 border-t border-border/50">
        <button onClick={() => { setAdding(section); if (showSideSelect) setAddSide("right"); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs w-[35%]">Debet</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground text-xs w-[15%]"></th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-xs w-[35%]">Credit</th>
              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground text-xs w-[15%]"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(middelenLeft.length + (hasManualBudgetedExpenses ? 0 : 1), middelenRight.length) }).map((_, i) => {
              const left = middelenLeft[i];
              const right = middelenRight[i];
              const isAutoLeft = !hasManualBudgetedExpenses && !left && i === middelenLeft.length;
              return (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-3 py-1.5">
                    {left ? left.name : isAutoLeft ? "Begrote uitgaven" : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums whitespace-nowrap pr-7">
                    {renderItemCell(left, isAutoLeft, totalBudgeted)}
                  </td>
                  <td className="px-3 py-1.5">
                    {right ? right.name : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 tabular-nums whitespace-nowrap pr-7">
                    {renderItemCell(right)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-2"></td>
              <td className="text-right px-3 py-2 whitespace-nowrap pr-7"><CurrencyCell value={leftTotal + (hasManualBudgetedExpenses ? 0 : totalBudgeted)} /></td>
              <td className="px-3 py-2"></td>
              <td className="text-right px-3 py-2 whitespace-nowrap pr-7"><CurrencyCell value={rightTotal} /></td>
            </tr>
          </tbody>
        </table>
        {renderAddForm("middelen", true)}
      </div>

      {/* Resultaat */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Resultaat</h3>
          <span className="text-xs text-muted-foreground">Verschil</span>
        </div>
        <table className="w-full text-sm">
           <colgroup>
            <col className="w-[35%]" />
            <col className="w-[20%]" />
            <col />
          </colgroup>
          <tbody>
            {resultaatItems.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-3 py-1.5">{item.name}</td>
                <td className="text-right px-3 py-1.5 tabular-nums whitespace-nowrap pr-7">
                  {renderItemCell(item)}
                </td>
                <td />
              </tr>
            ))}
            {contributionStats && (
              <tr className="border-b border-border/50">
                <td className="px-3 py-1.5">Ontvangen contributie</td>
                <td className="text-right px-3 py-1.5 whitespace-nowrap pr-7"><CurrencyCell value={contributionStats.totalReceived} /></td>
                <td className="text-right px-3 py-1.5 whitespace-nowrap">
                  <CurrencyCell value={contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount} className="text-destructive" />
                </td>
              </tr>
            )}
            <tr className="border-b border-border/50">
              <td className="px-3 py-1.5">Uitgaven {year}</td>
              <td className="text-right px-3 py-1.5 whitespace-nowrap pr-7"><CurrencyCell value={totalSpent} /></td>
              <td className="px-3 py-1.5">
                {contributionStats && (
                  <div className="text-xs text-muted-foreground leading-tight space-y-0.5">
                    <div>{contributionStats.unpaidCount} leden nog betalen</div>
                    <div>{contributionStats.paidCount} hebben betaald</div>
                  </div>
                )}
              </td>
            </tr>
            <tr className="bg-primary/5 font-semibold border-t border-border">
              <td className="px-3 py-2">Totaal</td>
              <td className="text-right px-3 py-2 whitespace-nowrap pr-7">
                <CurrencyCell value={resultaatItems.reduce((s, i) => s + i.amount, 0) + (contributionStats?.totalReceived ?? 0) - totalSpent} />
              </td>
              <td className="text-right px-3 py-2 whitespace-nowrap">
                {contributionStats && <CurrencyCell value={contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount} className={(contributionStats.totalReceived - contributionStats.totalMembers * contributionStats.contributionAmount) < 0 ? "text-destructive" : ""} />}
              </td>
            </tr>
          </tbody>
        </table>
        {renderAddForm("resultaat")}
      </div>

      {/* Contributie & Vrijwilligersvergoeding */}
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
                  <td className="text-right px-3 py-1.5 whitespace-nowrap"><CurrencyCell value={contributionStats.contributionAmount} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-semibold">Inkomsten {year}</td>
                  <td className="text-right px-3 py-1.5 font-semibold whitespace-nowrap"><CurrencyCell value={contributionStats.totalMembers * contributionStats.contributionAmount} /></td>
                </tr>
                {onUpdateYearSettings && (
                  <tr>
                    <td colSpan={2} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Leden"
                          defaultValue={contributionStats.totalMembers || ""}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val > 0 && val !== contributionStats.totalMembers) {
                              onUpdateYearSettings({ budgeted_member_count: val, contribution_amount: contributionStats.contributionAmount });
                            }
                          }}
                          className="h-6 w-16 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">leden ×</span>
                        <Input
                          type="number"
                          placeholder="Bedrag"
                          defaultValue={contributionStats.contributionAmount || ""}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val > 0 && val !== contributionStats.contributionAmount) {
                              onUpdateYearSettings({ budgeted_member_count: contributionStats.totalMembers, contribution_amount: val });
                            }
                          }}
                          className="h-6 w-20 text-xs"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/50">
              <h3 className="text-xs font-semibold">Max. vrijwilligersvergoeding</h3>
            </div>
            <table className="w-full text-sm text-muted-foreground">
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-1">Per uur</td>
                  <td className="text-right px-3 py-1 whitespace-nowrap"><CurrencyCell value="5,50" /></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-1">Per maand</td>
                  <td className="text-right px-3 py-1 whitespace-nowrap"><CurrencyCell value="210" /></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-1">Per jaar</td>
                  <td className="text-right px-3 py-1 whitespace-nowrap"><CurrencyCell value="2.100" /></td>
                </tr>
                <tr>
                  <td className="px-3 py-1">Reiskosten</td>
                  <td className="text-right px-3 py-1 whitespace-nowrap"><CurrencyCell value="0,23/km" /></td>
                </tr>
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

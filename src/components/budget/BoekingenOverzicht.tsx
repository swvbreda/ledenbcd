import { useState, useMemo } from "react";
import { Trash2, ArrowUpDown, Search, Download, Upload, Pencil, Check, X } from "lucide-react";
import type { BudgetCategory, BudgetExpense } from "@/hooks/useBudget";
import type { Contribution } from "@/hooks/useContributions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import { Badge } from "@/components/ui/badge";

interface MemberOption { id: number; naam: string }

interface FlatExpense extends BudgetExpense {
  categoryName: string;
  lineItemName: string;
}

type LedgerRow =
  | { type: "expense"; data: FlatExpense }
  | { type: "income"; data: { id: string; memberName: string; amount: number; paid: boolean; paid_date: string | null; invoice_number: string | null; invoice_date: string | null } };

interface Props {
  categories: BudgetCategory[];
  contributions: Contribution[];
  members: MemberOption[];
  year: number;
  contributionAmount: number;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (id: string, fields: { dossier?: string | null; line_item_id?: string; paid?: boolean; paid_date?: string | null }) => void;
  onOpenPdfImport: () => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
};

type SortKey = "date" | "type" | "name" | "dossier" | "category" | "invoice" | "amount" | "paid";

export default function BoekingenOverzicht({ categories, contributions, members, year, contributionAmount, onDeleteExpense, onUpdateExpense, onOpenPdfImport }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDossier, setEditDossier] = useState("");
  const [editLineItemId, setEditLineItemId] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");

  const allLineItems = useMemo(() =>
    categories.flatMap((c) => c.line_items.map((li) => ({ id: li.id, label: `${c.name} → ${li.name}`, catName: c.name, liName: li.name }))),
    [categories]
  );

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.naam])), [members]);

  const rows: LedgerRow[] = useMemo(() => {
    const result: LedgerRow[] = [];

    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          result.push({
            type: "expense",
            data: { ...exp, categoryName: cat.name, lineItemName: li.name },
          });
        }
      }
    }

    for (const c of contributions || []) {
      result.push({
        type: "income",
        data: {
          id: c.id,
          memberName: memberMap.get(c.member_id) || `Lid #${c.member_id}`,
          amount: c.amount || contributionAmount,
          paid: c.paid,
          paid_date: c.paid_date,
          invoice_number: c.invoice_number,
        },
      });
    }

    return result;
  }, [categories, contributions, memberMap, contributionAmount]);

  const getRowValues = (row: LedgerRow) => {
    if (row.type === "expense") {
      const e = row.data;
      return {
        date: e.expense_date || "",
        type: "Uitgave",
        name: e.creditor_name || e.description || "–",
        dossier: e.dossier || "",
        category: `${e.categoryName} → ${e.lineItemName}`,
        invoice: e.invoice_reference || "",
        amount: -e.amount,
        paid: e.paid,
        id: e.id,
      };
    } else {
      const c = row.data;
      return {
        date: c.paid_date || "",
        type: "Inkomst",
        name: c.memberName,
        dossier: "",
        category: "Contributie",
        invoice: c.invoice_number || "",
        amount: c.amount,
        paid: c.paid,
        id: c.id,
      };
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = rows;

    if (filterType !== "all") {
      list = list.filter((r) => r.type === filterType);
    }
    if (filterPaid !== "all") {
      list = list.filter((r) => {
        const v = getRowValues(r);
        return filterPaid === "paid" ? v.paid : !v.paid;
      });
    }
    if (q) {
      list = list.filter((r) => {
        const v = getRowValues(r);
        return [v.name, v.dossier, v.category, v.invoice, v.type].some((s) => s.toLowerCase().includes(q));
      });
    }

    list.sort((a, b) => {
      const va = getRowValues(a);
      const vb = getRowValues(b);
      let valA: any = va[sortKey] ?? "";
      let valB: any = vb[sortKey] ?? "";
      if (sortKey === "amount") { valA = va.amount; valB = vb.amount; }
      if (sortKey === "paid") { valA = va.paid ? 1 : 0; valB = vb.paid ? 1 : 0; }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [rows, search, sortKey, sortAsc, filterType, filterPaid]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const r of filtered) {
      const v = getRowValues(r);
      if (v.amount > 0) income += v.amount;
      else expense += Math.abs(v.amount);
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const startEdit = (row: LedgerRow) => {
    if (row.type !== "expense") return;
    const e = row.data;
    setEditingId(e.id);
    setEditDossier(e.dossier || "");
    setEditLineItemId(e.line_item_id);
  };

  const saveEdit = () => {
    if (!editingId) return;
    onUpdateExpense(editingId, {
      dossier: editDossier || null,
      line_item_id: editLineItemId,
    });
    setEditingId(null);
  };

  const handleExport = () => {
    const headers = ["Type", "Datum", "Naam", "Dossier", "Categorie", "Factuurnummer", "Bedrag", "Betaald"];
    const csvRows = filtered.map((r) => {
      const v = getRowValues(r);
      return [v.type, v.date, v.name, v.dossier, v.category, v.invoice, v.amount, v.paid ? "Ja" : "Nee"];
    });
    const csv = [headers, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boekingen-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => (
    <th
      className={`px-2 py-1.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none text-xs ${className}`}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={sortKey === field ? "text-foreground" : "text-muted-foreground/40"} />
      </span>
    </th>
  );

  return (
    <div className="mt-4 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, dossier, categorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alles</SelectItem>
            <SelectItem value="expense" className="text-xs">Uitgaven</SelectItem>
            <SelectItem value="income" className="text-xs">Inkomsten</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPaid} onValueChange={(v) => setFilterPaid(v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle status</SelectItem>
            <SelectItem value="paid" className="text-xs">Betaald</SelectItem>
            <SelectItem value="unpaid" className="text-xs">Openstaand</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenPdfImport}>
          <Upload size={12} className="mr-1" /> PDF importeren
        </Button>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent transition-colors"
        >
          <Download size={12} /> CSV
        </button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} regels</span>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-xs">
        <span className="text-green-600 font-medium">Inkomsten: <CurrencyText value={totals.income} /></span>
        <span className="text-destructive font-medium">Uitgaven: <CurrencyText value={totals.expense} /></span>
        <span className={`font-semibold ${totals.net >= 0 ? "text-green-600" : "text-destructive"}`}>
          Saldo: <CurrencyText value={totals.net} />
        </span>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-auto max-h-[65vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <tr className="border-b border-border">
              <SortHeader label="Type" field="type" className="text-left w-[70px]" />
              <SortHeader label="Datum" field="date" className="text-left" />
              <SortHeader label="Naam" field="name" className="text-left" />
              <SortHeader label="Dossier" field="dossier" className="text-left" />
              <SortHeader label="Categorie" field="category" className="text-left" />
              <SortHeader label="Factuurnr" field="invoice" className="text-left" />
              <SortHeader label="Bedrag" field="amount" className="text-right" />
              <SortHeader label="Status" field="paid" className="text-center w-[80px]" />
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const v = getRowValues(row);
              const isEditing = editingId === v.id;
              const isExpense = row.type === "expense";

              return (
                <tr key={`${row.type}-${v.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-1">
                    <Badge variant={isExpense ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                      {isExpense ? "Uit" : "In"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 tabular-nums whitespace-nowrap">{fmtDate(v.date) || "–"}</td>
                  <td className="px-2 py-1">{v.name}</td>
                  <td className="px-2 py-1">
                    {isEditing ? (
                      <Input
                        value={editDossier}
                        onChange={(e) => setEditDossier(e.target.value)}
                        className="h-6 text-xs"
                        placeholder="Dossier..."
                      />
                    ) : (
                      v.dossier || "–"
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {isEditing ? (
                      <Select value={editLineItemId} onValueChange={setEditLineItemId}>
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue placeholder="Kies..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allLineItems.map((li) => (
                            <SelectItem key={li.id} value={li.id} className="text-xs">{li.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">{v.category}</span>
                    )}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{v.invoice || "–"}</td>
                  <td className={`px-2 py-1 text-right tabular-nums font-medium ${v.amount >= 0 ? "text-green-600" : "text-destructive"}`}>
                    <CurrencyCell value={Math.abs(v.amount)} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {isExpense ? (
                      <Checkbox
                        checked={v.paid}
                        onCheckedChange={(checked) => {
                          onUpdateExpense(v.id, {
                            paid: !!checked,
                            paid_date: checked ? new Date().toISOString().slice(0, 10) : null,
                          });
                        }}
                      />
                    ) : (
                      <span className={`text-[10px] font-medium ${v.paid ? "text-green-600" : "text-amber-500"}`}>
                        {v.paid ? "Betaald" : "Open"}
                      </span>
                    )}
                  </td>
                  <td className="px-1 flex items-center gap-0.5 py-1">
                    {isExpense && !isEditing && (
                      <>
                        <button onClick={() => startEdit(row)} className="p-1 text-muted-foreground hover:text-foreground" title="Bewerken">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => onDeleteExpense(v.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Verwijderen">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                    {isEditing && (
                      <>
                        <button onClick={saveEdit} className="p-1 text-green-600 hover:text-green-700" title="Opslaan">
                          <Check size={12} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-destructive" title="Annuleren">
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">Geen boekingen gevonden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Trash2, ArrowUpDown, Search, Download } from "lucide-react";
import type { BudgetCategory, BudgetExpense } from "@/hooks/useBudget";
import { Input } from "@/components/ui/input";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface FlatExpense extends BudgetExpense {
  categoryName: string;
  lineItemName: string;
}

interface Props {
  categories: BudgetCategory[];
  onDeleteExpense: (id: string) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
};

type SortKey = "expense_date" | "categoryName" | "lineItemName" | "dossier" | "creditor_name" | "invoice_reference" | "amount";

export default function ExpenseListView({ categories, onDeleteExpense }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expense_date");
  const [sortAsc, setSortAsc] = useState(false);

  const allExpenses: FlatExpense[] = useMemo(() => {
    const result: FlatExpense[] = [];
    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          if (exp.direction === "in") continue;
          result.push({
            ...exp,
            categoryName: cat.name,
            lineItemName: li.name,
          });
        }
      }
    }
    return result;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = allExpenses;
    if (q) {
      list = list.filter(
        (e) =>
          e.categoryName.toLowerCase().includes(q) ||
          e.lineItemName.toLowerCase().includes(q) ||
          (e.creditor_name || "").toLowerCase().includes(q) ||
          (e.dossier || "").toLowerCase().includes(q) ||
          (e.invoice_reference || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let valA: any = a[sortKey] ?? "";
      let valB: any = b[sortKey] ?? "";
      if (sortKey === "amount") {
        valA = a.amount;
        valB = b.amount;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [allExpenses, search, sortKey, sortAsc]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleExport = () => {
    const headers = ["Betaaldatum", "Categorie", "Onderdeel", "Dossier", "Leverancier", "Factuurnummer", "Bedrag"];
    const rows = filtered.map((e) => [
      e.expense_date || "",
      e.categoryName,
      e.lineItemName,
      e.dossier || "",
      e.creditor_name || "",
      e.invoice_reference || "",
      e.amount,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `declaraties-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => (
    <th
      className={`px-2 py-1.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none ${className}`}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={sortKey === field ? "text-foreground" : "text-muted-foreground/40"} />
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op leverancier, categorie, dossier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm pl-8"
          />
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent transition-colors"
        >
          <Download size={12} /> CSV
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} regels</span>
      </div>

      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <SortHeader label="Betaaldatum" field="expense_date" className="text-left" />
              <SortHeader label="Categorie" field="categoryName" className="text-left" />
              <SortHeader label="Onderdeel" field="lineItemName" className="text-left" />
              <SortHeader label="Dossier" field="dossier" className="text-left" />
              <SortHeader label="Leverancier" field="creditor_name" className="text-left" />
              <SortHeader label="Factuurnummer" field="invoice_reference" className="text-left" />
              <SortHeader label="Bedrag" field="amount" className="text-right" />
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                <td className="px-2 py-1.5">{e.categoryName}</td>
                <td className="px-2 py-1.5">{e.lineItemName}</td>
                <td className="px-2 py-1.5">{e.dossier || ""}</td>
                <td className="px-2 py-1.5">{e.creditor_name || ""}</td>
                <td className="px-2 py-1.5 tabular-nums">{e.invoice_reference || ""}</td>
                <td className="px-2 py-1.5 text-right"><CurrencyCell value={e.amount} /></td>
                <td className="px-1">
                  <button onClick={() => onDeleteExpense(e.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">Geen uitgaven gevonden</td>
              </tr>
            )}
            {filtered.length > 0 && (
              <tr className="bg-muted/30 font-semibold">
                <td colSpan={6} className="px-2 py-1.5">Totaal</td>
                <td className="px-2 py-1.5 text-right"><CurrencyCell value={total} /></td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

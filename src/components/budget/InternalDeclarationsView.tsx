import { useState, useMemo } from "react";
import { Trash2, Plus, Search, Download, ArrowUpDown, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { InternalDeclaration } from "@/hooks/useInternalDeclarations";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface Props {
  declarations: InternalDeclaration[];
  year: number;
  isAdmin: boolean;
  userId: string;
  onAdd: (decl: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
};

const statusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge variant="default" className="bg-green-600 text-xs">Goedgekeurd</Badge>;
    case "rejected": return <Badge variant="destructive" className="text-xs">Afgewezen</Badge>;
    default: return <Badge variant="secondary" className="text-xs">In afwachting</Badge>;
  }
};

type SortKey = "expense_date" | "board_member_name" | "appointment" | "trajectory" | "amount" | "declaration_type" | "status";

export default function InternalDeclarationsView({ declarations, year, isAdmin, userId, onAdd, onDelete, onApprove, onReject }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expense_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [adding, setAdding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [form, setForm] = useState({
    board_member_name: "",
    declaration_type: "reiskosten",
    appointment: "",
    trajectory: "",
    km_single: "",
    km_return: "",
    expense_date: "",
    bank_account: "",
    account_holder: "",
    max_allowance_note: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = [...declarations];
    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (q) {
      list = list.filter(
        (d) =>
          d.board_member_name.toLowerCase().includes(q) ||
          (d.appointment || "").toLowerCase().includes(q) ||
          (d.trajectory || "").toLowerCase().includes(q) ||
          (d.declaration_type || "").toLowerCase().includes(q) ||
          (d.account_holder || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let valA: any = a[sortKey] ?? "";
      let valB: any = b[sortKey] ?? "";
      if (sortKey === "amount") { valA = a.amount; valB = b.amount; }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [declarations, search, sortKey, sortAsc, statusFilter]);

  const total = filtered.reduce((s, d) => s + d.amount, 0);
  const pendingCount = declarations.filter((d) => d.status === "pending").length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const getMonthlyAllowanceCount = (name: string, type: string) => {
    return declarations.filter(
      (d) => d.board_member_name === name && d.declaration_type === type && d.year === year
    ).length;
  };

  const handleAdd = () => {
    if (!form.board_member_name || !form.expense_date) {
      toast.error("Naam en datum zijn verplicht");
      return;
    }
    // Max 10 maandelijkse vergoedingen per jaar voor woordvoering/penningmeester
    if (form.declaration_type === "woordvoering" || form.declaration_type === "penningmeester") {
      const count = getMonthlyAllowanceCount(form.board_member_name, form.declaration_type);
      if (count >= 10) {
        toast.error(`${form.board_member_name} heeft al ${count} van max 10 maandvergoedingen (${form.declaration_type}) voor ${year}`);
        return;
      }
    }
    const kmSingle = form.km_single ? parseFloat(form.km_single) : null;
    const kmReturn = form.km_return ? parseFloat(form.km_return) : null;
    const kmRate = 0.23;
    let amount = 0;
    if (form.declaration_type === "reiskosten" && kmSingle != null) {
      amount = (kmReturn ?? kmSingle * 2) * kmRate;
    } else if (form.declaration_type === "woordvoering" || form.declaration_type === "penningmeester") {
      amount = 210;
    }

    onAdd({
      year,
      board_member_name: form.board_member_name,
      declaration_type: form.declaration_type,
      appointment: form.appointment || null,
      trajectory: form.trajectory || null,
      km_single: kmSingle,
      km_return: kmReturn,
      km_rate: kmRate,
      amount: Math.round(amount * 100) / 100,
      expense_date: form.expense_date,
      bank_account: form.bank_account || null,
      account_holder: form.account_holder || null,
      max_allowance_note: form.max_allowance_note || null,
      status: "pending",
      submitted_by: userId,
    });
    setForm({
      board_member_name: form.board_member_name,
      declaration_type: form.declaration_type,
      appointment: "",
      trajectory: "",
      km_single: "",
      km_return: "",
      expense_date: "",
      bank_account: form.bank_account,
      account_holder: form.account_holder,
      max_allowance_note: "",
    });
  };

  const handleExport = () => {
    const headers = ["Datum", "Wie", "Omschrijving", "Traject", "Km enkel", "Km retour", "Bedrag", "Rekeningnummer", "Rekeninghouder", "Status"];
    const rows = filtered.map((d) => [
      d.expense_date || "",
      d.board_member_name,
      d.appointment || "",
      d.trajectory || "",
      d.km_single || "",
      d.km_return || "",
      d.amount,
      d.bank_account || "",
      d.account_holder || "",
      d.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interne-declaraties-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => (
    <th className={`px-2 py-1.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none ${className}`} onClick={() => toggleSort(field)}>
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
          <Input placeholder="Zoek op naam, omschrijving, traject..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm pl-8" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2">
          <option value="all">Alle statussen</option>
          <option value="pending">In afwachting{pendingCount > 0 ? ` (${pendingCount})` : ""}</option>
          <option value="approved">Goedgekeurd</option>
          <option value="rejected">Afgewezen</option>
        </select>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent transition-colors">
          <Download size={12} /> CSV
        </button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(!adding)}>
          <Plus size={14} className="mr-1" /> Declaratie
        </Button>
        <span className="text-xs text-muted-foreground">{filtered.length} regels</span>
      </div>

      {adding && (
        <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Nieuwe declaratie</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input placeholder="Naam bestuurslid" value={form.board_member_name} onChange={(e) => setForm({ ...form, board_member_name: e.target.value })} className="h-8 text-sm" />
            <select value={form.declaration_type} onChange={(e) => setForm({ ...form, declaration_type: e.target.value })} className="h-8 text-sm rounded-md border border-input bg-background px-2">
              <option value="reiskosten">Reiskosten</option>
              <option value="woordvoering">Woordvoering</option>
              <option value="penningmeester">Penningmeester</option>
            </select>
            <Input placeholder="Omschrijving" value={form.appointment} onChange={(e) => setForm({ ...form, appointment: e.target.value })} className="h-8 text-sm" />
            <Input placeholder="Traject (bijv. A'veen – Utrecht)" value={form.trajectory} onChange={(e) => setForm({ ...form, trajectory: e.target.value })} className="h-8 text-sm" />
            <Input type="number" placeholder="Km enkel" value={form.km_single} onChange={(e) => setForm({ ...form, km_single: e.target.value })} className="h-8 text-sm" />
            <Input type="number" placeholder="Km retour" value={form.km_return} onChange={(e) => setForm({ ...form, km_return: e.target.value })} className="h-8 text-sm" />
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="h-8 text-sm" />
            <Input placeholder="Rekeningnummer" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="h-8 text-sm" />
            <Input placeholder="Rekeninghouder" value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} className="h-8 text-sm" />
            <Input placeholder="Max vergoeding notitie" value={form.max_allowance_note} onChange={(e) => setForm({ ...form, max_allowance_note: e.target.value })} className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8" onClick={handleAdd}>Toevoegen</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>Annuleer</Button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <SortHeader label="Datum" field="expense_date" className="text-left" />
              <SortHeader label="Wie" field="board_member_name" className="text-left" />
              <SortHeader label="Omschrijving" field="appointment" className="text-left" />
              <th className="px-2 py-1.5 font-medium text-muted-foreground text-left">Traject</th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground text-right">Km</th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground text-right">Retour</th>
              <SortHeader label="Bedrag" field="amount" className="text-right" />
              <th className="px-2 py-1.5 font-medium text-muted-foreground text-left">Rekening</th>
              <th className="px-2 py-1.5 font-medium text-muted-foreground text-left">Houder</th>
              <SortHeader label="Status" field="status" className="text-center" />
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtDate(d.expense_date)}</td>
                <td className="px-2 py-1.5">{d.board_member_name}</td>
                <td className="px-2 py-1.5">{d.appointment || ""}</td>
                <td className="px-2 py-1.5">{d.trajectory || ""}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{d.km_single ?? "–"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{d.km_return ?? "–"}</td>
                <td className="px-2 py-1.5 text-right"><CurrencyCell value={d.amount} /></td>
                <td className="px-2 py-1.5 text-xs">{d.bank_account || ""}</td>
                <td className="px-2 py-1.5">{d.account_holder || ""}</td>
                <td className="px-2 py-1.5 text-center">{statusBadge(d.status)}</td>
                <td className="px-1 whitespace-nowrap">
                  {isAdmin && (
                    <span className="inline-flex gap-0.5">
                      {d.status !== "approved" && (
                        <button onClick={() => onApprove(d.id)} className="p-1 text-muted-foreground hover:text-green-600" title="Goedkeuren">
                          <Check size={14} />
                        </button>
                      )}
                      {d.status !== "rejected" && (
                        <button onClick={() => onReject(d.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Afwijzen">
                          <X size={14} />
                        </button>
                      )}
                      <button onClick={() => onDelete(d.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Verwijderen">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="px-2 py-4 text-center text-muted-foreground">Geen declaraties gevonden</td></tr>
            )}
            {filtered.length > 0 && (
              <tr className="bg-muted/30 font-semibold">
                <td colSpan={6} className="px-2 py-1.5">Totaal</td>
                <td className="px-2 py-1.5 text-right"><CurrencyCell value={total} /></td>
                <td colSpan={5} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Max. vrijwilligersvergoeding */}
      <div className="border border-border rounded-lg overflow-hidden max-w-sm">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-xs font-semibold">Max. vrijwilligersvergoeding</h3>
        </div>
        <table className="w-full text-sm text-muted-foreground">
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Per uur</td>
              <td className="text-right px-3 py-1">€</td>
              <td className="text-right px-3 py-1 tabular-nums">5,50</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Per maand</td>
              <td className="text-right px-3 py-1">€</td>
              <td className="text-right px-3 py-1 tabular-nums">210</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-3 py-1">Per jaar</td>
              <td className="text-right px-3 py-1">€</td>
              <td className="text-right px-3 py-1 tabular-nums">2.100</td>
            </tr>
            <tr>
              <td className="px-3 py-1">Reiskosten</td>
              <td className="text-right px-3 py-1">€</td>
              <td className="text-right px-3 py-1 tabular-nums">0,23/km</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

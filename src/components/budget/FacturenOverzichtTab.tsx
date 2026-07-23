import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, CheckCircle2, AlertCircle, Search, Download } from "lucide-react";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useContributions, useContributionInvoices, type Contribution, type ContributionInvoice } from "@/hooks/useContributions";
import { useMembers } from "@/hooks/useMembers";
import { useBudgetYearSettings } from "@/hooks/useBudget";

type StatusFilter = "all" | "todo" | "sent" | "paid";
type RowStatus = "todo" | "sent" | "paid";

interface Props {
  year: number;
}

export default function FacturenOverzichtTab({ year }: Props) {
  const navigate = useNavigate();
  const { effectiveMembers } = useMembers();
  const { data: contributions, isLoading } = useContributions(year);
  const { data: invoicesData, isLoading: invoicesLoading } = useContributionInvoices(year);
  const { data: yearSettings } = useBudgetYearSettings(year);
  const amount = yearSettings?.contribution_amount ?? 3000;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const contribMap = useMemo(() => {
    const map = new Map<number, Contribution>();
    (contributions ?? []).forEach((c) => map.set(c.member_id, c));
    return map;
  }, [contributions]);

  const invoicesMap = useMemo(() => {
    const map = new Map<number, ContributionInvoice[]>();
    (invoicesData ?? []).forEach((inv) => {
      const list = map.get(inv.member_id) ?? [];
      list.push(inv);
      map.set(inv.member_id, list);
    });
    return map;
  }, [invoicesData]);

  const rows = useMemo(() => {
    return [...effectiveMembers]
      .sort((a, b) => a.id - b.id)
      .map((m) => {
        const invs = invoicesMap.get(m.id) ?? [];
        const contrib = contribMap.get(m.id);
        const paid = !!contrib?.paid;
        const status: RowStatus = paid ? "paid" : invs.length > 0 ? "sent" : "todo";
        return {
          member: m,
          invoices: invs,
          contrib,
          status,
        };
      });
  }, [effectiveMembers, invoicesMap, contribMap]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.member.naam.toLowerCase().includes(q) ||
          r.member.bedrijfsnaam.toLowerCase().includes(q) ||
          r.member.plaats.toLowerCase().includes(q) ||
          String(r.member.id).includes(q) ||
          r.invoices.some((i) => (i.invoice_number ?? "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const totals = useMemo(() => {
    const source = filteredRows;
    const todo = source.filter((r) => r.status === "todo").length;
    const sent = source.filter((r) => r.status === "sent").length;
    const paid = source.filter((r) => r.status === "paid").length;
    return {
      todo,
      sent,
      paid,
      todoAmount: todo * amount,
      sentAmount: sent * amount,
      paidAmount: paid * amount,
      openAmount: sent * amount,
      totalInvoiced: (sent + paid) * amount,
    };
  }, [filteredRows, amount]);

  const handleExportCSV = () => {
    const header = ["Lidnr", "Naam", "Plaats", "Status", "Factuurnummer(s)", "Bedrag", "Betaald op"];
    const rowsCsv = filteredRows.map((r) => {
      const nums = r.invoices.map((i) => i.invoice_number ?? "").filter(Boolean).join("; ");
      const label = r.status === "paid" ? "Betaald" : r.status === "sent" ? "Verstuurd" : "Nog te versturen";
      return [
        r.member.id,
        `"${r.member.naam}"`,
        `"${r.member.plaats}"`,
        label,
        `"${nums}"`,
        amount,
        r.contrib?.paid_date ?? "",
      ].join(",");
    });
    const csv = [header.join(","), ...rowsCsv].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facturen_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || invoicesLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Facturen laden...</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <AlertCircle size={12} className="text-amber-500" />
              Nog te versturen
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums">
              {totals.todo}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                <CurrencyText value={totals.todoAmount} />
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Send size={12} className="text-blue-500" />
              Verstuurd (openstaand)
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums text-amber-600">
              <CurrencyText value={totals.openAmount} />
            </p>
            <p className="text-xs text-muted-foreground">{totals.sent} facturen</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Betaald
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums text-emerald-600">
              <CurrencyText value={totals.paidAmount} />
            </p>
            <p className="text-xs text-muted-foreground">{totals.paid} facturen</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <FileText size={12} />
              Totaal gefactureerd
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums">
              <CurrencyText value={totals.totalInvoiced} />
            </p>
            <p className="text-xs text-muted-foreground">{totals.sent + totals.paid} facturen</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="todo">Nog te versturen</SelectItem>
            <SelectItem value="sent">Verstuurd</SelectItem>
            <SelectItem value="paid">Betaald</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, plaats, lidnr, factuurnr..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 ml-auto" onClick={handleExportCSV}>
          <Download size={12} /> CSV
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Nr</TableHead>
                <TableHead>Naam</TableHead>
                <TableHead className="hidden sm:table-cell">Plaats</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="hidden md:table-cell">Factuurnummer</TableHead>
                <TableHead className="w-28 text-right">Bedrag</TableHead>
                <TableHead className="hidden md:table-cell w-32">Betaald op</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow
                  key={r.member.id}
                  className={`cursor-pointer hover:bg-muted/70 ${r.status === "paid" ? "bg-emerald-50/40" : ""}`}
                  onClick={() => navigate(`/leden/${r.member.id}`)}
                >
                  <TableCell className="text-sm text-muted-foreground">{r.member.id}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.member.naam}</div>
                    <div className="text-sm text-muted-foreground sm:hidden">{r.member.plaats}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.member.plaats}</TableCell>
                  <TableCell>
                    {r.status === "paid" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1">
                        <CheckCircle2 size={12} /> Betaald
                      </Badge>
                    ) : r.status === "sent" ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1">
                        <Send size={12} /> Verstuurd
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1">
                        <AlertCircle size={12} /> Nog te versturen
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.invoices.length === 0 ? "—" : r.invoices.map((i) => i.invoice_number ?? "—").join(", ")}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <CurrencyText value={amount} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.contrib?.paid_date ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Geen facturen gevonden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
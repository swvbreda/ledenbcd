import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, CheckCircle2, AlertCircle, Search, Download } from "lucide-react";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useContributions, useContributionInvoices, useContributionPayments, type Contribution, type ContributionInvoice } from "@/hooks/useContributions";
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
  const { data: paymentsData, isLoading: paymentsLoading } = useContributionPayments(year);
  const { data: yearSettings } = useBudgetYearSettings(year);
  const defaultAmount = yearSettings?.contribution_amount ?? 3000;

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

  const paymentsMap = useMemo(() => {
    const map = new Map<number, { amount: number; paidDate: string | null }>();
    (paymentsData ?? []).forEach((p) => {
      const current = map.get(p.member_id) ?? { amount: 0, paidDate: null };
      const paidDate = p.paid_at
        ? (!current.paidDate || p.paid_at > current.paidDate ? p.paid_at : current.paidDate)
        : current.paidDate;
      map.set(p.member_id, { amount: current.amount + (Number(p.amount) || 0), paidDate });
    });
    return map;
  }, [paymentsData]);

  const rows = useMemo(() => {
    const rowsBase = [...effectiveMembers].map((m) => {
      const invs = invoicesMap.get(m.id) ?? [];
      const contrib = contribMap.get(m.id);
      const paidInfo = paymentsMap.get(m.id);
      const invoicedAmount = invs.length > 0
        ? invs.reduce((s, i) => s + (Number(i.amount ?? defaultAmount) || 0), 0)
        : defaultAmount;
      const paidAmount = paidInfo?.amount ?? (contrib?.paid ? Number(contrib.amount) || 0 : 0);
      const openAmount = Math.max(0, invoicedAmount - paidAmount);
      const paid = invs.length > 0 && openAmount <= 0.01;
      const status: RowStatus = paid ? "paid" : invs.length > 0 ? "sent" : "todo";
      return {
        member: m,
        invoices: invs,
        contrib,
        status,
        amount: invoicedAmount,
        paidAmount,
        openAmount,
        paidDate: paidInfo?.paidDate ?? contrib?.paid_date ?? null,
      };
    });

    return rowsBase.sort((a, b) => {
      const dateOf = (r: typeof rowsBase[0]) => {
        if (r.status === "paid" && r.contrib?.paid_date) return new Date(r.contrib.paid_date).getTime();
        if (r.status === "sent" && r.contrib?.invoice_date) return new Date(r.contrib.invoice_date).getTime();
        const latestInvoice = r.invoices[0]
          ? Math.max(...r.invoices.map((i) => new Date(i.invoice_date ?? i.created_at).getTime()))
          : 0;
        return latestInvoice || 0;
      };
      return dateOf(b) - dateOf(a);
    });
  }, [effectiveMembers, invoicesMap, contribMap, paymentsMap, defaultAmount]);

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
    const paid = source.filter((r) => r.paidAmount > 0).length;
    const sum = (s: RowStatus) => source.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);
    return {
      todo,
      sent,
      paid,
      todoAmount: sum("todo"),
      sentAmount: sum("sent"),
      paidAmount: source.reduce((a, r) => a + r.paidAmount, 0),
      openAmount: source.reduce((a, r) => a + r.openAmount, 0),
      totalInvoiced: sum("sent") + sum("paid"),
    };
  }, [filteredRows]);

  const handleExportCSV = () => {
    const header = ["Lidnr", "Naam", "Plaats", "Status", "Factuurnummer(s)", "Factuurdatum", "Gefactureerd", "Ontvangen", "Openstaand", "Betaald op"];
    const rowsCsv = filteredRows.map((r) => {
      const nums = r.invoices.map((i) => i.invoice_number ?? "").filter(Boolean).join("; ");
      const label = r.status === "paid" ? "Betaald" : r.status === "sent" ? "Verstuurd" : "Nog te versturen";
      return [
        r.member.id,
        `"${r.member.naam}"`,
        `"${r.member.plaats}"`,
        label,
        `"${nums}"`,
        r.invoices[0]?.invoice_date ?? r.contrib?.invoice_date ?? "",
        r.amount,
        r.paidAmount,
        r.openAmount,
        r.paidDate ?? "",
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

  if (isLoading || invoicesLoading || paymentsLoading) {
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
              Ontvangen
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums text-emerald-600">
              <CurrencyText value={totals.paidAmount} />
            </p>
            <p className="text-xs text-muted-foreground">{totals.paid} betalende leden</p>
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
                <TableHead className="hidden md:table-cell w-32">Factuurdatum</TableHead>
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
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular-nums">
                    {(() => {
                      const d = r.invoices[0]?.invoice_date ?? r.contrib?.invoice_date ?? r.invoices[0]?.created_at ?? null;
                      if (!d) return "—";
                      const dt = new Date(d);
                      return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
                    })()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <CurrencyText value={r.amount} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.paidDate ? (() => {
                      const dt = new Date(r.paidDate);
                      return isNaN(dt.getTime()) ? r.paidDate : dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
                    })() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
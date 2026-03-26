import { useState, useMemo } from "react";
import { useContributions, useUpsertContribution, useContributionInvoices, type Contribution, type ContributionInvoice } from "@/hooks/useContributions";
import { supabase } from "@/integrations/supabase/client";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Euro, CheckCircle2, AlertCircle, Search, MapPin, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
const FIXED_AMOUNT = 3000;

const ContributiePage = () => {
  const { isAdmin } = useAuth();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "no_invoice">("all");
  const { effectiveMembers } = useMembers();
  const { data: contributions, isLoading } = useContributions(selectedYear);
  const { data: invoicesData, isLoading: invoicesLoading } = useContributionInvoices(selectedYear);
  const upsert = useUpsertContribution();

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

  const filteredMembers = useMemo(() => {
    let list = [...effectiveMembers].sort((a, b) => a.id - b.id);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.naam.toLowerCase().includes(q) ||
          m.bedrijfsnaam.toLowerCase().includes(q) ||
          String(m.id).includes(q) ||
          m.plaats.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "paid") {
      list = list.filter((m) => contribMap.get(m.id)?.paid);
    } else if (statusFilter === "unpaid") {
      list = list.filter((m) => (invoicesMap.get(m.id) ?? []).length > 0 && !contribMap.get(m.id)?.paid);
    } else if (statusFilter === "no_invoice") {
      list = list.filter((m) => (invoicesMap.get(m.id) ?? []).length === 0);
    }
    return list;
  }, [effectiveMembers, search, statusFilter, contribMap, invoicesMap]);

  const totalLocaties = useMemo(
    () => effectiveMembers.reduce((sum, m) => sum + (m.locaties?.length || m.aantalLocaties || 1), 0),
    [effectiveMembers]
  );

  const stats = useMemo(() => {
    const total = effectiveMembers.length;
    // Only count members who have at least one invoice for this year
    const invoiced = effectiveMembers.filter((m) => (invoicesMap.get(m.id) ?? []).length > 0).length;
    let paid = 0;
    effectiveMembers.forEach((m) => {
      if (contribMap.get(m.id)?.paid) paid++;
    });
    const expectedAmount = invoiced * FIXED_AMOUNT;
    const paidAmount = paid * FIXED_AMOUNT;
    return { total, invoiced, paid, expectedAmount, paidAmount, openAmount: expectedAmount - paidAmount };
  }, [effectiveMembers, contribMap, invoicesMap]);

  const handleTogglePaid = async (memberId: number, currentlyPaid: boolean) => {
    const existing = contribMap.get(memberId);
    try {
      await upsert.mutateAsync({
        member_id: memberId,
        year: selectedYear,
        amount: FIXED_AMOUNT,
        paid: !currentlyPaid,
        paid_date: !currentlyPaid ? new Date().toISOString().split("T")[0] : null,
        notes: existing?.notes ?? null,
      });
    } catch (e: any) {
      toast.error("Fout bij opslaan: " + e.message);
    }
  };

  const handleExportCSV = () => {
    const today = new Date().toISOString().split("T")[0];
    const header = ["Lidnr", "Naam", "Plaats", "Locaties", "Factuurnummer", "Bedrag", "Betaald", "Datum"];
    const rows = filteredMembers.map((m) => {
      const c = contribMap.get(m.id);
      const invs = invoicesMap.get(m.id) ?? [];
      const invoiceNrs = invs.map((i) => i.invoice_number ?? "").join("; ");
      return [
        m.id,
        `"${m.naam}"`,
        `"${m.plaats}"`,
        m.locaties?.length || m.aantalLocaties || 1,
        `"${invoiceNrs}"`,
        FIXED_AMOUNT,
        c?.paid ? "Ja" : "Nee",
        c?.paid_date ?? "",
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contributie_${selectedYear}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredMembers.length} rijen geëxporteerd`);
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || invoicesLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSpinner message="Contributie laden..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Contributie</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Contributie-administratie per lid per jaar — € {FIXED_AMOUNT.toLocaleString("nl-NL")} per lid
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Euro size={14} />
              Gefactureerd
            </div>
            <p className="text-lg font-bold mt-1">€ {stats.expectedAmount.toLocaleString("nl-NL")}</p>
            <p className="text-xs text-muted-foreground">{stats.invoiced} / {stats.total} leden</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Ontvangen
            </div>
            <p className="text-lg font-bold mt-1 text-emerald-600">€ {stats.paidAmount.toLocaleString("nl-NL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle size={14} className="text-amber-500" />
              Openstaand
            </div>
            <p className="text-lg font-bold mt-1 text-amber-600">€ {stats.openAmount.toLocaleString("nl-NL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Betaald</div>
            <p className="text-lg font-bold mt-1">
              {stats.paid} / {stats.invoiced}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({stats.invoiced > 0 ? Math.round((stats.paid / stats.invoiced) * 100) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={14} />
              Locaties
            </div>
            <p className="text-lg font-bold mt-1">{totalLocaties}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle leden</SelectItem>
            <SelectItem value="paid">Betaald</SelectItem>
            <SelectItem value="unpaid">Niet betaald</SelectItem>
            <SelectItem value="no_invoice">Geen factuur</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, bedrijf, lidnummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nr</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead className="hidden sm:table-cell">Plaats</TableHead>
                  <TableHead className="hidden lg:table-cell w-28">Factuur</TableHead>
                  <TableHead className="w-20 text-center">Locaties</TableHead>
                  <TableHead className="w-28 text-right">Bedrag</TableHead>
                  <TableHead className="w-24 text-center">Betaald</TableHead>
                  <TableHead className="hidden md:table-cell w-32">Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => {
                  const c = contribMap.get(m.id);
                  const isPaid = c?.paid ?? false;
                  const memberInvoices = invoicesMap.get(m.id) ?? [];
                  return (
                    <TableRow key={m.id} className={isPaid ? "bg-emerald-50/50" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{m.naam}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{m.plaats}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {m.plaats}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono text-muted-foreground">
                        {memberInvoices.length === 0 ? (
                          <span>—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {memberInvoices.map((inv) => (
                              <div key={inv.id} className="flex items-center gap-1.5">
                                <span>{inv.invoice_number ?? "—"}</span>
                                {inv.invoice_file_path && (
                                  <button
                                    onClick={async () => {
                                      const { data } = await supabase.storage
                                        .from("contribution-invoices")
                                        .createSignedUrl(inv.invoice_file_path!, 300);
                                      if (!data?.signedUrl) {
                                        toast.error("Factuur kon niet worden geopend");
                                        return;
                                      }
                                      const url = data.signedUrl.startsWith("http")
                                        ? data.signedUrl
                                        : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${data.signedUrl}`;
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.target = "_blank";
                                      a.rel = "noopener noreferrer";
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                    className="text-primary hover:text-primary/80 transition-colors"
                                    title="Factuur PDF openen"
                                  >
                                    <FileText size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {m.locaties?.length || m.aantalLocaties || 1}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        € {FIXED_AMOUNT.toLocaleString("nl-NL")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isPaid}
                          onCheckedChange={() => handleTogglePaid(m.id, isPaid)}
                          className="mx-auto"
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {c?.paid_date ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Geen leden gevonden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContributiePage;

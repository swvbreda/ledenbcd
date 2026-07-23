import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useContributions,
  useUpsertContribution,
  useContributionInvoices,
  useCreateContributionInvoice,
  type Contribution,
  type ContributionInvoice,
} from "@/hooks/useContributions";
import { supabase } from "@/integrations/supabase/client";
import { useMembers } from "@/hooks/useMembers";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Euro, CheckCircle2, AlertCircle, Search, FileText, Download, Upload, ListTodo, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CsvImportDialog from "@/components/CsvImportDialog";
import ContributionPdfUploadDialog from "@/components/budget/ContributionPdfUploadDialog";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import { useBankStatement } from "@/hooks/useBudget";

const FIXED_AMOUNT = 3000;

interface Props {
  year: number;
}

export default function ContributieTab({ year }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "no_invoice">("all");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const { effectiveMembers } = useMembers();
  const { data: contributions, isLoading } = useContributions(year);
  const { data: invoicesData, isLoading: invoicesLoading } = useContributionInvoices(year);
  const upsert = useUpsertContribution();
  const createInvoice = useCreateContributionInvoice();
  const { data: bankData } = useBankStatement(year);

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

  // Sum of invoice amounts per member (falls back to FIXED_AMOUNT per invoice
  // when the row has no amount yet — e.g. legacy imports).
  const invoicedAmountByMember = useMemo(() => {
    const map = new Map<number, number>();
    (invoicesData ?? []).forEach((inv) => {
      const amt = Number(inv.amount ?? FIXED_AMOUNT) || 0;
      map.set(inv.member_id, (map.get(inv.member_id) ?? 0) + amt);
    });
    return map;
  }, [invoicesData]);

  // Bank is leidend: match incoming bank transactions to members via
  // invoice number reference or counterparty/description containing the
  // member's name or company name. Yields a derived "paid" status that
  // reflects what's actually on the bank.
  const bankPaidMap = useMemo(() => {
    const map = new Map<number, { date: string | null; amount: number; ref: string }>();
    const txs = (bankData?.transactions ?? []).filter((t) => t.direction === "in");
    if (txs.length === 0) return map;

    const norm = (s: string | null | undefined) =>
      (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

    // Index invoices by normalized number for quick lookup
    const invByNumber = new Map<string, number>();
    (invoicesData ?? []).forEach((inv) => {
      if (inv.invoice_number) invByNumber.set(norm(inv.invoice_number), inv.member_id);
    });

    for (const tx of txs) {
      const haystack = `${norm(tx.invoice_reference)} ${norm(tx.description)} ${norm(tx.counterparty)}`;
      let matchedMember: number | null = null;

      // 1) Invoice number match
      for (const [num, mid] of invByNumber) {
        if (num && haystack.includes(num)) {
          matchedMember = mid;
          break;
        }
      }

      // 2) Fallback: member name / bedrijfsnaam match in counterparty
      if (matchedMember === null) {
        const cp = norm(tx.counterparty);
        if (cp) {
          for (const m of effectiveMembers) {
            const candidates = [m.bedrijfsnaam, m.naam].map(norm).filter((x) => x && x.length >= 4);
            if (candidates.some((c) => cp.includes(c) || c.includes(cp))) {
              matchedMember = m.id;
              break;
            }
          }
        }
      }

      if (matchedMember !== null) {
        const existing = map.get(matchedMember);
        // Prefer earliest payment date
        if (!existing || (tx.transaction_date && (!existing.date || tx.transaction_date < existing.date))) {
          map.set(matchedMember, {
            date: tx.transaction_date,
            amount: tx.amount,
            ref: tx.invoice_reference || tx.description || tx.counterparty || "",
          });
        }
      }
    }
    return map;
  }, [bankData, invoicesData, effectiveMembers]);

  // Effective paid: bank-leidend, falls back to manual contribution.paid
  const isPaidEffective = useCallback(
    (memberId: number) => {
      if (bankPaidMap.has(memberId)) return true;
      return contribMap.get(memberId)?.paid ?? false;
    },
    [bankPaidMap, contribMap]
  );
  const paidDateEffective = useCallback(
    (memberId: number) => {
      const bank = bankPaidMap.get(memberId);
      if (bank) return bank.date;
      return contribMap.get(memberId)?.paid_date ?? null;
    },
    [bankPaidMap, contribMap]
  );

  // Auto-register an invoice row when a bank payment matched a member that
  // doesn't have any invoice in this year yet — keeps totals in balance and
  // removes the member from "Nog geen factuur verstuurd".
  const autoRegistered = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!invoicesData) return;
    bankPaidMap.forEach((hit, memberId) => {
      const key = `${memberId}-${year}`;
      if (autoRegistered.current.has(key)) return;
      const hasInvoice = (invoicesMap.get(memberId) ?? []).length > 0;
      if (hasInvoice) return;
      autoRegistered.current.add(key);
      const invNumber = (hit.ref || "").trim().slice(0, 60) || `AUTO-${memberId}-${year}`;
      createInvoice
        .mutateAsync({
          member_id: memberId,
          year,
          invoice_number: invNumber,
          invoice_file_path: null,
          amount: Math.abs(hit.amount) || FIXED_AMOUNT,
        })
        .catch(() => {
          autoRegistered.current.delete(key);
        });
    });
  }, [bankPaidMap, invoicesData, invoicesMap, year, createInvoice]);

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
      list = list.filter((m) => isPaidEffective(m.id));
    } else if (statusFilter === "unpaid") {
      list = list.filter((m) => (invoicesMap.get(m.id) ?? []).length > 0 && !isPaidEffective(m.id));
    } else if (statusFilter === "no_invoice") {
      list = list.filter((m) => (invoicesMap.get(m.id) ?? []).length === 0);
    }
    return list;
  }, [effectiveMembers, search, statusFilter, isPaidEffective, invoicesMap]);

  const stats = useMemo(() => {
    const total = effectiveMembers.length;
    // Invoiced = sum over ALL invoice rows in the year (also from ex-members),
    // paid = sum per member capped at what was invoiced to that member so a
    // late/duplicate bank hit can never push "received" above "invoiced".
    let expectedAmount = 0;
    (invoicesData ?? []).forEach((inv) => {
      expectedAmount += Number(inv.amount ?? FIXED_AMOUNT) || 0;
    });
    const invoiceCount = (invoicesData ?? []).length;
    const membersWithInvoice = new Set((invoicesData ?? []).map((i) => i.member_id));
    const invoicedMembers = membersWithInvoice.size;
    let paidAmount = 0;
    let paidMembers = 0;
    membersWithInvoice.forEach((mid) => {
      if (!isPaidEffective(mid)) return;
      paidMembers++;
      paidAmount += invoicedAmountByMember.get(mid) ?? 0;
    });
    return {
      total,
      invoiced: invoicedMembers,
      invoiceCount,
      paid: paidMembers,
      expectedAmount,
      paidAmount,
      openAmount: Math.max(0, expectedAmount - paidAmount),
    };
  }, [effectiveMembers, invoicesData, invoicedAmountByMember, isPaidEffective]);

  const membersWithoutInvoice = useMemo(() => {
    return effectiveMembers
      .filter((m) => (invoicesMap.get(m.id) ?? []).length === 0)
      .sort((a, b) => a.id - b.id);
  }, [effectiveMembers, invoicesMap]);

  const handleTogglePaid = async (memberId: number, currentlyPaid: boolean) => {
    const existing = contribMap.get(memberId);
    try {
      await upsert.mutateAsync({
        member_id: memberId,
        year,
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
    a.download = `contributie_${year}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredMembers.length} rijen geëxporteerd`);
  };

  if (isLoading || invoicesLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Contributiegegevens laden...</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <Euro size={12} />
              Gefactureerd
            </div>
            <p className="text-lg font-bold mt-1 tabular-nums"><CurrencyText value={stats.expectedAmount} /></p>
            <p className="text-xs text-muted-foreground">{stats.invoiceCount} facturen · {stats.invoiced}/{stats.total} leden</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Ontvangen
            </div>
            <p className="text-lg font-bold mt-1 text-emerald-600 tabular-nums"><CurrencyText value={stats.paidAmount} /></p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <AlertCircle size={12} className="text-amber-500" />
              Openstaand
            </div>
            <p className="text-lg font-bold mt-1 text-amber-600 tabular-nums"><CurrencyText value={stats.openAmount} /></p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Betaald</div>
            <p className="text-lg font-bold mt-1 tabular-nums">
              {stats.paid} / {stats.invoiced}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({stats.invoiced > 0 ? Math.round((stats.paid / stats.invoiced) * 100) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {membersWithoutInvoice.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-900">
                  Nog geen factuur verstuurd ({membersWithoutInvoice.length})
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter("no_invoice")}
              >
                Toon in lijst
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {membersWithoutInvoice.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/leden/${m.id}`)}
                  className="text-xs px-2 py-1 rounded border border-amber-300 bg-white hover:bg-amber-100 transition-colors"
                  title={`${m.naam} — ${m.plaats}`}
                >
                  <span className="text-muted-foreground mr-1">#{m.id}</span>
                  {m.naam}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
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
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, bedrijf, lidnummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExportCSV}>
            <Download size={12} /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setPdfDialogOpen(true)}>
            <FileText size={12} /> PDF uploaden
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setCsvDialogOpen(true)}>
            <Upload size={12} /> CSV importeren
          </Button>
        </div>
      </div>

      <ContributionPdfUploadDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        year={year}
        members={effectiveMembers.map((m) => ({ id: m.id, naam: m.naam }))}
        existingInvoices={(invoicesData ?? []).map(inv => ({ invoice_number: inv.invoice_number, member_id: inv.member_id }))}
        onImport={async (entries) => {
          for (const entry of entries) {
            // Create invoice record
            await createInvoice.mutateAsync({
              member_id: entry.member_id,
              year,
              invoice_file_path: null,
              invoice_number: entry.invoice_number,
            });
            // Ensure a contribution record exists (unpaid by default)
            if (!contribMap.has(entry.member_id)) {
              await upsert.mutateAsync({
                member_id: entry.member_id,
                year,
                amount: FIXED_AMOUNT,
                paid: false,
                paid_date: null,
              });
            }
          }
        }}
      />

      <CsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        year={year}
        contributions={contributions ?? []}
        invoices={invoicesData ?? []}
        members={effectiveMembers.map((m) => ({ id: m.id, naam: m.naam }))}
        onImport={async (updates) => {
          for (const u of updates) {
            await upsert.mutateAsync({
              member_id: u.member_id,
              year,
              amount: FIXED_AMOUNT,
              paid: u.paid,
              paid_date: u.paid_date,
            });
          }
        }}
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
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
                const bankHit = bankPaidMap.get(m.id);
                const isPaid = isPaidEffective(m.id);
                const paidDate = paidDateEffective(m.id);
                const memberInvoices = invoicesMap.get(m.id) ?? [];
                return (
                  <TableRow key={m.id} className={`${isPaid ? "bg-emerald-50/50" : ""} cursor-pointer hover:bg-muted/70`} onClick={() => navigate(`/leden/${m.id}`)}>
                    <TableCell className="text-sm text-muted-foreground">{m.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{m.naam}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">{m.plaats}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.plaats}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {memberInvoices.length === 0 ? (
                        <span>—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {memberInvoices.map((inv) => (
                            <div key={inv.id} className="flex items-center gap-1.5">
                              <span>{inv.invoice_number ?? "—"}</span>
                              {inv.invoice_file_path && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
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
                                    window.open(url, "_blank", "noopener,noreferrer");
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
                    <TableCell className="text-center text-sm">{m.locaties?.length || m.aantalLocaties || 1}</TableCell>
                    <TableCell className="text-right text-sm"><CurrencyCell value={FIXED_AMOUNT} /></TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isPaid}
                        onCheckedChange={() => handleTogglePaid(m.id, c?.paid ?? false)}
                        disabled={!!bankHit}
                        className="mx-auto"
                        title={bankHit ? "Automatisch betaald via bank" : undefined}
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {paidDate ?? "—"}
                      {bankHit && <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-600">bank</span>}
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
      </div>
    </div>
  );
}


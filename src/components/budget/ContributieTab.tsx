import { useState, useMemo } from "react";
import {
  useContributions,
  useUpsertContribution,
  useContributionInvoices,
  useCreateContributionInvoice,
  type Contribution,
  type ContributionInvoice,
} from "@/hooks/useContributions";
import { useMembers } from "@/hooks/useMembers";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CsvImportDialog from "@/components/CsvImportDialog";
import ContributionPdfUploadDialog from "@/components/budget/ContributionPdfUploadDialog";
import { useBankStatement } from "@/hooks/useBudget";
import FacturenOverzichtTab from "@/components/budget/FacturenOverzichtTab";

const FIXED_AMOUNT = 3000;

interface Props {
  year: number;
}

export default function ContributieTab({ year }: Props) {
  const navigate = useNavigate();
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
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

    const invByNumber = new Map<string, number>();
    (invoicesData ?? []).forEach((inv) => {
      if (inv.invoice_number) invByNumber.set(norm(inv.invoice_number), inv.member_id);
    });

    for (const tx of txs) {
      const haystack = `${norm(tx.invoice_reference)} ${norm(tx.description)} ${norm(tx.counterparty)}`;
      let matchedMember: number | null = null;

      for (const [num, mid] of invByNumber) {
        if (num && haystack.includes(num)) {
          matchedMember = mid;
          break;
        }
      }

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

  // Note: earlier we auto-registered a placeholder invoice here when a bank
  // payment matched a member without an invoice. That wrote the raw SEPA
  // description into invoice_number, corrupting the facturenlijst. The
  // Informer-sync + Ponto matcher now cover this properly, so we no longer
  // create synthetic invoices from the client.

  const membersWithoutInvoice = useMemo(() => {
    return effectiveMembers
      .filter((m) => (invoicesMap.get(m.id) ?? []).length === 0)
      .sort((a, b) => a.id - b.id);
  }, [effectiveMembers, invoicesMap]);

  if (isLoading || invoicesLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Contributiegegevens laden...</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      {membersWithoutInvoice.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-900">
                Nog geen factuur verstuurd ({membersWithoutInvoice.length})
              </h3>
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setPdfDialogOpen(true)}>
          <FileText size={12} /> PDF uploaden
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setCsvDialogOpen(true)}>
          <Upload size={12} /> CSV importeren
        </Button>
      </div>

      <ContributionPdfUploadDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        year={year}
        members={effectiveMembers.map((m) => ({ id: m.id, naam: m.naam }))}
        existingInvoices={(invoicesData ?? []).map(inv => ({ invoice_number: inv.invoice_number, member_id: inv.member_id }))}
        onImport={async (entries) => {
          for (const entry of entries) {
            await createInvoice.mutateAsync({
              member_id: entry.member_id,
              year,
              invoice_file_path: null,
              invoice_number: entry.invoice_number,
            });
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

      <FacturenOverzichtTab year={year} />
    </div>
  );
}

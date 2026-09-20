import { Card } from "@/components/ui/card";
import { Euro, CheckCircle2, BadgeCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyContributionInvoices } from "@/hooks/useContributionLedger";
import { useMemberExemption } from "@/hooks/useContributionExemptions";

const fmt = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Eigen contributiestatus van het ingelogde lid. De bedragen en betaalstatus
 * komen uitsluitend uit de administratie van de bond; het lid ziet nooit de
 * gegevens van een ander lid.
 */
export function ContributiePaymentCard() {
  const { linkedMemberId } = useAuth();
  const year = new Date().getFullYear();
  const { data: invoices = [], isLoading } = useMyContributionInvoices(year);
  const { data: exemption } = useMemberExemption(linkedMemberId, year);

  if (!linkedMemberId) return null;

  if (exemption) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Euro size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold font-display">Contributie {year}</h3>
        </div>
        <div className="flex items-start gap-2 text-sm text-emerald-700 p-3 rounded-md bg-emerald-50">
          <BadgeCheck size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{exemption.reason}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Voor {year} is er geen contributie verschuldigd en hoeft er niets betaald te worden.
              Vanaf {year + 1} geldt de gewone contributie.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const invoiced = invoices.reduce((s, i) => s + i.amount_incl, 0);
  const paid = invoices.reduce((s, i) => s + i.paid_amount, 0);
  const open = invoices.reduce((s, i) => s + i.open_amount, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Euro size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Contributie {year}</h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Gegevens laden...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Er staat voor {year} nog geen contributiefactuur voor je klaar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-md bg-muted/40">
              <div className="text-xs text-muted-foreground">Gefactureerd</div>
              <div className="text-base font-bold tabular-nums">{fmt(invoiced)}</div>
            </div>
            <div className="text-center p-3 rounded-md bg-emerald-50">
              <div className="text-xs text-emerald-700">Betaald</div>
              <div className="text-base font-bold text-emerald-700 tabular-nums">{fmt(paid)}</div>
            </div>
            <div className="text-center p-3 rounded-md bg-amber-50">
              <div className="text-xs text-amber-700">Openstaand</div>
              <div className="text-base font-bold text-amber-700 tabular-nums">{fmt(open)}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <div
                key={`${inv.invoice_number}-${inv.entry_date}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="tabular-nums">{inv.invoice_number ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(inv.entry_date)}</span>
                <span className="tabular-nums">{fmt(inv.amount_incl)}</span>
                {inv.open_amount <= 0.005 ? (
                  <span className="text-xs font-medium text-emerald-600">Betaald</span>
                ) : (
                  <span className="text-xs font-medium text-amber-600">Open {fmt(inv.open_amount)}</span>
                )}
              </div>
            ))}
          </div>

          {open <= 0.005 && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              Volledig betaald — bedankt!
            </div>
          )}
          {open > 0.005 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Maak het openstaande bedrag over onder vermelding van het factuurnummer. Vragen? Neem contact op met het bestuur.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

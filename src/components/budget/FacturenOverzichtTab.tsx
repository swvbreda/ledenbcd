import { useMemo } from "react";
import { useContributionLedger } from "@/hooks/useContributionLedger";
import { useMembers } from "@/hooks/useMembers";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  year: number;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Contributiefacturen van één jaar. Uitsluitend de facturen zoals ze in de
 * boekhouding staan; lokale administratieregels tellen hier niet mee.
 */
export default function FacturenOverzichtTab({ year }: Props) {
  const { data, isLoading } = useContributionLedger(year);
  const { effectiveMembers } = useMembers();

  const memberById = useMemo(() => {
    const m = new Map<number, string>();
    effectiveMembers.forEach((mm) => m.set(mm.id, mm.naam));
    return m;
  }, [effectiveMembers]);

  const rows = useMemo(() => {
    return [...(data?.contribution ?? [])].sort((a, b) =>
      (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? ""),
    );
  }, [data]);

  const totals = data?.contributionTotals;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Facturen laden...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Facturen</div>
          <div className="text-base font-semibold tabular-nums">{totals?.count ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Gefactureerd</div>
          <div className="text-base font-semibold tabular-nums"><CurrencyText value={totals?.invoiced ?? 0} /></div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Ontvangen</div>
          <div className="text-base font-semibold tabular-nums text-emerald-700"><CurrencyText value={totals?.paid ?? 0} /></div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Openstaand</div>
          <div className="text-base font-semibold tabular-nums text-amber-700"><CurrencyText value={totals?.open ?? 0} /></div>
        </CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-28">Factuurnr</th>
              <th className="px-3 py-2 text-left font-medium">Lid</th>
              <th className="px-3 py-2 text-left font-medium w-28">Datum</th>
              <th className="px-3 py-2 text-right font-medium w-28">Bedrag</th>
              <th className="px-3 py-2 text-right font-medium w-28">Betaald</th>
              <th className="px-3 py-2 text-right font-medium w-28">Openstaand</th>
              <th className="px-3 py-2 text-left font-medium w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Geen facturen voor {year}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.key} className="border-t border-border/50">
                <td className="px-3 py-1.5 tabular-nums">{r.invoiceNumber ?? "—"}</td>
                <td className="px-3 py-1.5">
                  {r.memberId ? (memberById.get(r.memberId) ?? `Lid #${r.memberId}`) : r.relationName || "—"}
                </td>
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{fmtDate(r.invoiceDate)}</td>
                <td className="px-3 py-1.5 text-right"><CurrencyCell value={r.amount} /></td>
                <td className="px-3 py-1.5 text-right"><CurrencyCell value={r.paidAmount} /></td>
                <td className="px-3 py-1.5 text-right"><CurrencyCell value={r.openAmount} /></td>
                <td className="px-3 py-1.5">
                  {r.status === "paid" ? (
                    <span className="text-xs font-medium text-emerald-600">Betaald</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600">Open</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

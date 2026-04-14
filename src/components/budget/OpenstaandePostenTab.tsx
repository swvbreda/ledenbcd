import { useMemo } from "react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { Contribution } from "@/hooks/useContributions";

interface MemberOption {
  id: number;
  naam: string;
}

interface Props {
  contributions: Contribution[];
  members: MemberOption[];
  year: number;
  contributionAmount: number;
}

export default function OpenstaandePostenTab({ contributions, members, year, contributionAmount }: Props) {
  const debtors = useMemo(() => {
    const paidMemberIds = new Set(
      contributions.filter((c) => c.paid).map((c) => c.member_id)
    );
    return members
      .filter((m) => !paidMemberIds.has(m.id))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }, [contributions, members]);

  const totalDebtors = debtors.length * contributionAmount;

  return (
    <div className="mt-4 space-y-2 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Openstaande debiteuren ({debtors.length})</h3>
        <span className="text-xs text-muted-foreground">
          Totaal: <CurrencyText value={totalDebtors} />
        </span>
      </div>
      <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left font-medium">Lid</th>
              <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {debtors.length === 0 ? (
              <tr><td colSpan={2} className="px-2 py-4 text-center text-muted-foreground">Geen openstaande debiteuren voor {year}</td></tr>
            ) : (
              debtors.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-2 py-1">{d.naam}</td>
                  <td className="px-2 py-1 text-right tabular-nums"><CurrencyCell value={contributionAmount} /></td>
                </tr>
              ))
            )}
          </tbody>
          {debtors.length > 0 && (
            <tfoot>
              <tr className="bg-primary/5 font-semibold border-t border-border">
                <td className="px-2 py-1.5">Totaal</td>
                <td className="px-2 py-1.5 text-right"><CurrencyCell value={totalDebtors} /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

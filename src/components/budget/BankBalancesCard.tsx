import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Landmark } from "lucide-react";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface BankBalance {
  id: string;
  account_id: string;
  name: string | null;
  iban: string | null;
  balance: number;
  currency: string | null;
  as_of_date: string | null;
  updated_at: string;
}

export default function BankBalancesCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["informer_bank_balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informer_bank_balances")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BankBalance[];
    },
  });

  const total = (data ?? []).reduce((s, b) => s + Number(b.balance || 0), 0);
  const lastUpdate = (data ?? []).reduce<string | null>((acc, b) => {
    if (!acc) return b.updated_at;
    return b.updated_at > acc ? b.updated_at : acc;
  }, null);
  const hasBalances = (data ?? []).some((b) => Number(b.balance) !== 0);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-brand-red" />
          <h3 className="text-sm font-semibold">Banksaldi (Informer)</h3>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            bijgewerkt {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true, locale: nl })}
          </span>
        )}
      </div>
      {!hasBalances && (
        <p className="text-xs text-muted-foreground mb-2">
          Informer levert geen actueel banksaldo via de API. Alleen de rekening­namen worden getoond; saldo werk je bij in Informer zelf.
        </p>
      )}
      <table className="w-full text-sm">
        <tbody>
          {data.map((b) => (
            <tr key={b.id} className="border-b border-border/40 last:border-0">
              <td className="py-1.5">
                <div className="font-medium">{b.name || b.account_id}</div>
                {b.iban && <div className="text-xs text-muted-foreground tabular-nums">{b.iban}</div>}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {Number(b.balance) !== 0
                  ? <CurrencyText value={Number(b.balance)} />
                  : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
          {data.length > 1 && hasBalances && (
            <tr className="font-semibold">
              <td className="pt-2">Totaal</td>
              <td className="pt-2 text-right tabular-nums"><CurrencyText value={total} /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
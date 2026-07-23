import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Landmark } from "lucide-react";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface InformerBankBalance {
  id: string;
  account_id: string;
  name: string | null;
  iban: string | null;
  balance: number;
  currency: string | null;
  as_of_date: string | null;
  updated_at: string;
}

interface PontoBankBalance {
  id: string;
  account_id: string;
  name: string | null;
  iban: string | null;
  available_balance: number;
  current_balance: number;
  currency: string | null;
  as_of_date: string | null;
  updated_at: string;
}

export default function BankBalancesCard() {
  const { data: ponto, isLoading: loadingPonto } = useQuery({
    queryKey: ["ponto_bank_balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_bank_balances")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PontoBankBalance[];
    },
  });

  if (loadingPonto) return null;
  const pontoList = ponto ?? [];
  if (pontoList.length === 0) return null;

  const pontoTotal = pontoList.reduce((s, b) => s + Number(b.available_balance || 0), 0);
  const lastUpdate = pontoList.reduce<string | null>((acc, b) => {
    if (!acc) return b.updated_at;
    return b.updated_at > acc ? b.updated_at : acc;
  }, null);

  return (
    <div className="border border-border rounded-lg bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-brand-red" />
          <h3 className="text-sm font-semibold">Banksaldi</h3>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            bijgewerkt {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true, locale: nl })}
          </span>
        )}
      </div>

      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ponto (live)</div>
      <table className="w-full text-sm">
            <tbody>
              {pontoList.map((b) => (
                <tr key={b.id} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5">
                    <div className="font-medium">{b.name || b.account_id}</div>
                    {b.iban && <div className="text-xs text-muted-foreground tabular-nums">{b.iban}</div>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    <CurrencyText value={Number(b.available_balance)} />
                  </td>
                </tr>
              ))}
              {pontoList.length > 1 && (
                <tr className="font-semibold">
                  <td className="pt-2">Totaal</td>
                  <td className="pt-2 text-right tabular-nums"><CurrencyText value={pontoTotal} /></td>
                </tr>
              )}
            </tbody>
      </table>
    </div>
  );
}
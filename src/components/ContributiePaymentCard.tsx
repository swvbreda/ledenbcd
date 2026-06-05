import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Euro, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { paymentsConfigured } from "@/lib/stripe";

interface PaymentRow {
  id: string;
  amount: number;
  installment_number: number;
  installment_count: number;
  status: "pending" | "paid" | "failed" | "refunded";
  paid_at: string | null;
  created_at: string;
}

const CONTRIBUTION_AMOUNT = 3000;

export function ContributiePaymentCard() {
  const { linkedMemberId } = useAuth();
  const year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<"full" | "installment">("full");
  const [installmentNumber, setInstallmentNumber] = useState<1 | 2>(1);

  const { data: payments } = useQuery({
    queryKey: ["my-contribution-payments", linkedMemberId, year],
    enabled: !!linkedMemberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_payments")
        .select("id, amount, installment_number, installment_count, status, paid_at, created_at")
        .eq("member_id", linkedMemberId!)
        .eq("year", year)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    refetchInterval: open ? 3000 : false,
  });

  const { data: contribStatus } = useQuery({
    queryKey: ["my-contribution-status", linkedMemberId, year],
    enabled: !!linkedMemberId,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_contributions")
        .select("paid, paid_date, amount")
        .eq("member_id", linkedMemberId!)
        .eq("year", year)
        .maybeSingle();
      return data;
    },
  });

  const totals = useMemo(() => {
    const paid = (payments ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
    const pending = (payments ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
    const open = Math.max(0, CONTRIBUTION_AMOUNT - paid);
    const hasFirstInstallment = (payments ?? []).some(
      (p) => p.status === "paid" && p.installment_count === 2 && p.installment_number === 1
    );
    const hasSecondInstallment = (payments ?? []).some(
      (p) => p.status === "paid" && p.installment_count === 2 && p.installment_number === 2
    );
    return { paid, pending, open, hasFirstInstallment, hasSecondInstallment };
  }, [payments]);

  if (!linkedMemberId) return null;

  const isFullyPaid = contribStatus?.paid || totals.open === 0;
  const stripeReady = paymentsConfigured();

  const openCheckout = (selectedPlan: "full" | "installment", installment: 1 | 2 = 1) => {
    setPlan(selectedPlan);
    setInstallmentNumber(installment);
    setOpen(true);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Euro size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Contributie {year}</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 rounded-md bg-muted/40">
          <div className="text-xs text-muted-foreground">Verschuldigd</div>
          <div className="text-base font-bold tabular-nums">€ {CONTRIBUTION_AMOUNT.toLocaleString("nl-NL")}</div>
        </div>
        <div className="text-center p-3 rounded-md bg-emerald-50">
          <div className="text-xs text-emerald-700">Betaald</div>
          <div className="text-base font-bold text-emerald-700 tabular-nums">€ {totals.paid.toLocaleString("nl-NL")}</div>
        </div>
        <div className="text-center p-3 rounded-md bg-amber-50">
          <div className="text-xs text-amber-700">Openstaand</div>
          <div className="text-base font-bold text-amber-700 tabular-nums">€ {totals.open.toLocaleString("nl-NL")}</div>
        </div>
      </div>

      {isFullyPaid ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 p-3 rounded-md bg-emerald-50">
          <CheckCircle2 size={16} />
          Volledig betaald — bedankt!
          {contribStatus?.paid_date && <span className="text-muted-foreground ml-auto">{contribStatus.paid_date}</span>}
        </div>
      ) : (
        <div className="space-y-2">
          {!stripeReady && (
            <div className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
              Online betalen is nog niet geactiveerd. Maak het bedrag handmatig over of neem contact op met het bestuur.
            </div>
          )}
          {!totals.hasFirstInstallment && (
            <>
              <Button className="w-full gap-2" onClick={() => openCheckout("full")} disabled={!stripeReady}>
                <CreditCard size={16} /> Betaal € {CONTRIBUTION_AMOUNT.toLocaleString("nl-NL")} ineens
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => openCheckout("installment", 1)} disabled={!stripeReady}>
                <CreditCard size={16} /> Betaal in 2 termijnen — nu € 1.500
              </Button>
            </>
          )}
          {totals.hasFirstInstallment && !totals.hasSecondInstallment && (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-700 p-2 rounded bg-emerald-50">
                <CheckCircle2 size={16} /> Eerste termijn (€ 1.500) is voldaan.
              </div>
              <Button className="w-full gap-2" onClick={() => openCheckout("installment", 2)} disabled={!stripeReady}>
                <CreditCard size={16} /> Betaal tweede termijn — € 1.500
              </Button>
            </>
          )}
          {totals.pending > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={12} /> Er staat nog een betaling open in verwerking.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Online betalen via iDEAL of creditcard. Bij 2 termijnen ontvang je over 6 maanden een herinnering voor de tweede termijn.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Contributie {year} — {plan === "full" ? "ineens" : `termijn ${installmentNumber}/2`}
            </DialogTitle>
          </DialogHeader>
          <PaymentTestModeBanner />
          {open && (
            <StripeEmbeddedCheckout plan={plan} installmentNumber={installmentNumber} year={year} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
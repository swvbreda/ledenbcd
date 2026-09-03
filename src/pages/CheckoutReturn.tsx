import { useEffect, useState } from "react";
import { Link, useSearchParams } from "@/lib/router-compat";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "paid" | "pending" | "failed";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const { data } = await supabase
        .from("contribution_payments")
        .select("status")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.status === "paid") setStatus("paid");
      else if (data?.status === "failed") setStatus("failed");
      else if (attempts > 20) setStatus("pending");
      else setTimeout(poll, 1500);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Clock className="mx-auto text-muted-foreground animate-pulse" size={40} />
            <h1 className="text-xl font-display font-bold">Betaling verwerken…</h1>
            <p className="text-sm text-muted-foreground">Een moment, we bevestigen je betaling.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
            <h1 className="text-xl font-display font-bold">Betaling geslaagd</h1>
            <p className="text-sm text-muted-foreground">Bedankt! Je contributie is bijgewerkt in de administratie.</p>
          </>
        )}
        {status === "pending" && (
          <>
            <Clock className="mx-auto text-amber-600" size={48} />
            <h1 className="text-xl font-display font-bold">Nog niet bevestigd</h1>
            <p className="text-sm text-muted-foreground">
              Soms duurt het even voor je bank de betaling doorgeeft. We werken je status automatisch bij zodra die binnen is.
            </p>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle className="mx-auto text-red-600" size={48} />
            <h1 className="text-xl font-display font-bold">Betaling niet voltooid</h1>
            <p className="text-sm text-muted-foreground">Je kunt het opnieuw proberen via je account.</p>
          </>
        )}
        <Button asChild className="w-full">
          <Link to="/mijn-account">Terug naar mijn account</Link>
        </Button>
      </Card>
    </div>
  );
}
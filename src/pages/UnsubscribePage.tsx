import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const j = await r.json();
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
          body: JSON.stringify({ token }),
        },
      );
      const j = await r.json();
      if (j.success || j.reason === "already_unsubscribed") setState("done");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full bg-white rounded-lg border-2 border-primary/60 p-6 space-y-4 text-center">
        <h1 className="text-xl font-bold text-primary">Uitschrijven</h1>
        {state === "loading" && <p>Even geduld...</p>}
        {state === "invalid" && <p>Deze uitschrijflink is ongeldig of verlopen.</p>}
        {state === "already" && <p>Je bent al uitgeschreven.</p>}
        {state === "error" && <p>Er ging iets mis. Probeer het later opnieuw.</p>}
        {state === "valid" && (
          <>
            <p>Bevestig dat je geen e-mails meer wilt ontvangen.</p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? "Bezig..." : "Bevestig uitschrijven"}
            </Button>
          </>
        )}
        {state === "done" && <p>Je bent succesvol uitgeschreven.</p>}
      </div>
    </div>
  );
}
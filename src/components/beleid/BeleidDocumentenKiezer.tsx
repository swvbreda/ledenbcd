import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Notebook } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getBcdGemeenten } from "@/lib/bcdDocumenten.functions";
import BeleidDocumentenLijst, { FOUT_TEKST } from "./BeleidDocumentenLijst";

/** Alfabetische keuze uit alle gemeenten van de Beleidsmonitor (ook zonder aangesloten shop). */
export default function BeleidDocumentenKiezer() {
  const { user } = useAuth();
  const fetchGemeenten = useServerFn(getBcdGemeenten);
  const [gm, setGm] = useState("");
  const id = useId();
  const q = useQuery({
    queryKey: ["bcd-gemeenten", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: () => fetchGemeenten(),
  });

  return (
    <section aria-labelledby={`${id}-t`} className="bg-card rounded-lg border border-border p-5 space-y-4 min-w-0">
      <h3 id={`${id}-t`} className="text-sm font-semibold font-display flex items-center gap-2">
        <Notebook size={16} className="text-brand-red" aria-hidden /> Beleid en documenten
      </h3>
      <p className="text-xs text-muted-foreground">Openbare bronstukken uit de Beleidsmonitor per gemeente.</p>
      {q.isPending ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Gemeenten laden…</div>
      ) : q.data?.status === "ok" ? (
        <>
          <label htmlFor={`${id}-s`} className="text-xs font-medium block">Gemeente</label>
          <select
            id={`${id}-s`}
            value={gm}
            onChange={(e) => setGm(e.target.value)}
            className="w-full max-w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Kies een gemeente…</option>
            {q.data.gemeenten.map((g) => <option key={g.gm_code} value={g.gm_code}>{g.naam}</option>)}
          </select>
          {gm && <BeleidDocumentenLijst key={gm} gmCode={gm} />}
        </>
      ) : (
        <div role="alert" className="p-3 rounded-lg text-sm bg-destructive/10 text-destructive">
          {FOUT_TEKST[q.data?.status === "fout" ? q.data.reden : "bron_onbereikbaar"]}
        </div>
      )}
    </section>
  );
}

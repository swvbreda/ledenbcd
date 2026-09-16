import { useMemo } from "react";
import { Hash } from "lucide-react";
import { useMembersData } from "@/contexts/MembersDataContext";

/** Nummers vanaf 10000 zijn historienummers van gestopte leden. */
const HISTORIE_VANAF = 10000;

/**
 * Klein overzicht van de lidnummers: hoeveel er in gebruik zijn, welke vrij
 * zijn en welk nummer het volgende nieuwe lid krijgt.
 */
const LidnummerOverzicht = () => {
  const { rawMembers, rawLeads, rawOldMembers } = useMembersData();

  const { inGebruik, hoogste, vrij, volgende } = useMemo(() => {
    const ids = [...rawMembers, ...rawLeads, ...rawOldMembers]
      .map((m) => m.id)
      .filter((id) => id < HISTORIE_VANAF);
    const bezet = new Set(ids);
    const max = ids.length ? Math.max(...ids) : 0;
    const vrijeNummers: number[] = [];
    for (let i = 1; i <= max; i++) if (!bezet.has(i)) vrijeNummers.push(i);
    return {
      inGebruik: ids.length,
      hoogste: max,
      vrij: vrijeNummers,
      volgende: vrijeNummers[0] ?? max + 1,
    };
  }, [rawMembers, rawLeads, rawOldMembers]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-brand-red" />
        <h2 className="font-display uppercase text-sm">Lidnummers</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "In gebruik", value: inGebruik },
          { label: "Hoogste nummer", value: hoogste },
          { label: "Vrije nummers", value: vrij.length },
          { label: "Volgende nieuwe lid", value: volgende },
        ].map((k) => (
          <div key={k.label} className="rounded-md border bg-background p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-display tabular-nums mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {vrij.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Vrij: {vrij.join(", ")} — deze worden bij een nieuw lid als eerste gebruikt.
        </p>
      )}
    </div>
  );
};

export default LidnummerOverzicht;

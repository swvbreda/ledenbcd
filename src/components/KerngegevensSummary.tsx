import { useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { Building2, Link2, MapPin, Store, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useKerngegevens } from "@/hooks/useKerngegevens";
import { useRegisterStats } from "@/hooks/useRegisterStats";

const Kaart = ({
  icon: Icon,
  label,
  waarde,
  hint,
}: {
  icon: typeof Users;
  label: string;
  waarde: string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-brand-red shrink-0" />
      <span className="text-[11px] uppercase tracking-wide leading-tight">{label}</span>
    </div>
    <div className="mt-2 text-2xl sm:text-3xl font-display tabular-nums">{waarde}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const KerngegevensSummary = () => {
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;
  const k = useKerngegevens(allowed);
  // Zelfde bron als de kerngegevenspagina, zodat beide hetzelfde getal tonen.
  const { totaalRepresented } = useRegisterStats();

  const peildatum = useMemo(
    () =>
      new Date().toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  if (!allowed) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase tracking-tight">Kerngegevens</h2>
        <Link to="/kerngegevens" className="text-xs text-brand-red hover:underline">
          Bekijk alle kerngegevens
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kaart
          icon={Store}
          label="Aangesloten coffeeshops"
          waarde={String(totaalRepresented)}
          hint="vertegenwoordigd via het register"
        />
        <Kaart
          icon={Building2}
          label="Vestigingen"
          waarde={String(k.totaalVestigingen)}
          hint="zoals ingevuld in het ledenbestand"
        />
        <Kaart
          icon={Users}
          label="Gem. per ondernemer"
          waarde={k.gemiddeld.toFixed(1)}
          hint={`${k.multiShop} met meerdere coffeeshops`}
        />
        <Kaart
          icon={MapPin}
          label="Gemeenten"
          waarde={String(k.gemeenteRijen.length)}
        />
        <Kaart
          icon={Link2}
          label="Gekoppeld aan register"
          waarde={String(k.gekoppeldeVestigingen)}
          hint="bevestigde koppelingen"
        />
      </div>

      <p className="text-xs text-muted-foreground">Peildatum {peildatum}</p>
    </section>
  );
};

export default KerngegevensSummary;

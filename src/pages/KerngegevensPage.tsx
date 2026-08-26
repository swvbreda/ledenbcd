import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Building2,
  Landmark,
  Link2,
  MapPin,
  Users,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { useAuth } from "@/hooks/useAuth";
import { useKerngegevens } from "@/hooks/useKerngegevens";
import { memberLocationCount } from "@/lib/locationCount";
import { UNKNOWN_BANK } from "@/lib/bankFromIban";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Member } from "@/data/types";

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
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-brand-red" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <div className="mt-2 text-3xl font-display tabular-nums">{waarde}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const Sectie = ({
  titel,
  bron,
  children,
  className,
}: {
  titel: string;
  bron: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3",
      className,
    )}
  >
    <div>
      <h2 className="font-display text-lg uppercase tracking-tight">{titel}</h2>
      <p className="text-xs text-muted-foreground">{bron}</p>
    </div>
    {children}
  </section>
);

const Balk = ({ pct }: { pct: number }) => (
  <div className="h-2 w-full rounded-full bg-muted">
    <div
      className="h-2 rounded-full bg-brand-red"
      style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
    />
  </div>
);

const KerngegevensPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;
  const k = useKerngegevens(allowed);
  const [detail, setDetail] = useState<{ titel: string; leden: Member[] } | null>(null);

  const peildatum = useMemo(
    () => new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
    [],
  );

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Deze pagina is alleen beschikbaar voor het bestuur.</p>
      </div>
    );
  }

  const maxBank = k.bankGroepen[0]?.aantal ?? 1;
  const maxGemeente = k.gemeenteRijen[0]?.vestigingen ?? 1;
  const maxDec = Math.max(1, ...k.decenniaRijen.map((d) => d.aantal));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <BcdHeroBanner
        title="Kerngegevens"
        subtitle="Inzichten uit het ledenbestand, de bankgegevens en de registerkoppelingen"
      />

      <p className="text-xs text-muted-foreground">Peildatum {peildatum}</p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kaart icon={Users} label="Leden" waarde={String(k.totaalLeden)} />
        <Kaart icon={Building2} label="Vestigingen" waarde={String(k.totaalVestigingen)} />
        <Kaart
          icon={Building2}
          label="Gem. per lid"
          waarde={k.gemiddeld.toFixed(1)}
          hint={`${k.multiShop} leden met meerdere shops`}
        />
        <Kaart
          icon={MapPin}
          label="Gemeenten"
          waarde={String(k.gemeenteRijen.length)}
          hint={`${k.ledenMeerdereGemeenten} leden in meerdere gemeenten`}
        />
        <Kaart
          icon={Link2}
          label="Gekoppeld aan register"
          waarde={String(k.gekoppeldeVestigingen)}
          hint="bevestigde koppelingen"
        />
      </div>

      <Sectie
        titel="Bankiert bij"
        bron={`Afgeleid uit de IBAN's in het ledenbestand — ${k.metIban} van ${k.totaalLeden} leden met bekend IBAN`}
      >
        <div className="space-y-2">
          {k.bankGroepen.map((b) => (
            <button
              key={b.bank}
              type="button"
              onClick={() => setDetail({ titel: `Bankiert bij ${b.bank}`, leden: b.leden })}
              className="w-full text-left rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-brand-red" />
                  {b.bank}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {b.aantal} · {b.pct}%
                </span>
              </div>
              <div className="mt-1.5">
                <Balk pct={(b.aantal / maxBank) * 100} />
              </div>
            </button>
          ))}
          {k.bankGroepen.length === 0 && (
            <p className="text-sm text-muted-foreground">Nog geen bankgegevens bekend.</p>
          )}
        </div>
      </Sectie>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Sectie titel="Omvang ondernemers" bron="Aantal vestigingen per lid uit het ledenbestand">
          <div className="space-y-2">
            {k.omvang.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setDetail({ titel: o.label, leden: o.leden })}
                className="w-full text-left rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center justify-between text-sm">
                  <span>{o.label}</span>
                  <span className="tabular-nums text-muted-foreground">{o.aantal} leden</span>
                </div>
                <div className="mt-1.5">
                  <Balk pct={k.totaalLeden ? (o.aantal / k.totaalLeden) * 100 : 0} />
                </div>
              </button>
            ))}
          </div>
        </Sectie>

        <Sectie titel="Grootste leden" bron="Top 10 op aantal vestigingen">
          <div className="divide-y divide-border">
            {k.topLeden.map(({ member, vestigingen }) => (
              <button
                key={member.id}
                type="button"
                onClick={() => navigate(`/leden/${member.id}`)}
                className="w-full flex items-center justify-between py-2 text-sm hover:text-brand-red transition-colors"
              >
                <span className="truncate">{member.naam}</span>
                <span className="tabular-nums text-muted-foreground shrink-0 ml-3">
                  {vestigingen}
                </span>
              </button>
            ))}
          </div>
        </Sectie>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Sectie titel="Spreiding over gemeenten" bron="Vestigingen van leden per gemeente">
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {k.gemeenteRijen.map((g) => (
              <div key={g.gemeente} className="px-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{g.gemeente}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {g.vestigingen} · {g.leden} {g.leden === 1 ? "lid" : "leden"}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Balk pct={(g.vestigingen / maxGemeente) * 100} />
                </div>
              </div>
            ))}
          </div>
        </Sectie>

        <div className="space-y-4">
          <Sectie
            titel="Oprichting vestigingen"
            bron={`Oprichtingsdata per decennium — ${k.metOprichting} vestigingen met bekende datum`}
          >
            <div className="space-y-2">
              {k.decenniaRijen.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{d.label}</span>
                    <span className="tabular-nums text-muted-foreground">{d.aantal}</span>
                  </div>
                  <div className="mt-1.5">
                    <Balk pct={(d.aantal / maxDec) * 100} />
                  </div>
                </div>
              ))}
              {k.decenniaRijen.length === 0 && (
                <p className="text-sm text-muted-foreground">Nog geen oprichtingsdata bekend.</p>
              )}
            </div>
          </Sectie>

          <Sectie
            titel="Lidmaatschapsduur"
            bron={`Gemiddeld ${k.gemiddeldeDuur} jaar lid`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {k.duurRijen.map((d) => (
                <div key={d.label} className="rounded-lg border border-border p-2">
                  <div className="text-xl font-display tabular-nums">{d.aantal}</div>
                  <div className="text-xs text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          </Sectie>
        </div>
      </div>

      <Sectie
        titel="Eigendom & UBO"
        bron={`${k.vestigingenMetUbo} vestigingen met bekende UBO · ${k.uniekeUbos} unieke personen`}
      >
        {k.uboRijen.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Geen personen gevonden die aan meerdere vestigingen verbonden zijn.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Persoon</th>
                  <th className="py-2 pr-3 font-medium">Vestigingen</th>
                  <th className="py-2 pr-3 font-medium">Registervestigingen</th>
                  <th className="py-2 font-medium">Leden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {k.uboRijen.map((r) => (
                  <tr key={r.naam}>
                    <td className="py-2 pr-3">{r.naam}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.vestigingen}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.vestigingsnamen.join(", ")}</td>
                    <td className="py-2 text-muted-foreground">{r.leden.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sectie>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-brand-red" />
              {detail?.titel}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {(detail?.leden ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setDetail(null);
                  navigate(`/leden/${m.id}`);
                }}
                className="w-full flex items-center justify-between py-2 text-sm hover:text-brand-red transition-colors"
              >
                <span className="truncate">{m.naam}</span>
                <Badge variant="secondary" className="shrink-0 ml-3 tabular-nums">
                  {memberLocationCount(m)}
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KerngegevensPage;

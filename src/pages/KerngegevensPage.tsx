import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  CreditCard,
  Building2,
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
import { bankColor, pspColor } from "@/lib/brandColors";
import { usePinverwerkers } from "@/hooks/usePinverwerkers";
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
  children,
  className,
}: {
  titel: string;
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

interface DonutItem {
  label: string;
  aantal: number;
  pct: number;
  color: string;
  eenheid?: string;
}

const DonutDiagram = ({
  items,
  onSelect,
}: {
  items: DonutItem[];
  onSelect: (label: string) => void;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="aantal"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            onClick={(_, index) => {
              const it = items[index];
              if (it) onSelect(it.label);
            }}
          >
            {items.map((it) => (
              <Cell
                key={it.label}
                fill={it.color}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                className="outline-hidden cursor-pointer transition-opacity hover:opacity-80"
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DonutItem;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xs text-xs">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-muted-foreground">
                    {p.aantal} {p.eenheid ?? ""} · {p.pct}%
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-2">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={() => onSelect(it.label)}
          className="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <span
              className="inline-block rounded-sm shrink-0"
              style={{ width: 14, height: 14, backgroundColor: it.color }}
            />
            {it.label}
          </span>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {it.aantal} · {it.pct}%
          </span>
        </button>
      ))}
    </div>
  </div>
);


const KerngegevensPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;
  const k = useKerngegevens(allowed);
  const { data: psp } = usePinverwerkers(allowed);
  const [detail, setDetail] = useState<{ titel: string; leden: Member[] } | null>(null);
  const [pspDetail, setPspDetail] = useState<{ titel: string; regels: string[] } | null>(null);

  const bankItems: DonutItem[] = useMemo(
    () =>
      k.bankGroepen.map((b, i) => ({
        label: b.bank,
        aantal: b.aantal,
        pct: b.pct,
        eenheid: b.aantal === 1 ? "lid" : "leden",
        color: b.bank === UNKNOWN_BANK ? bankColor(UNKNOWN_BANK) : bankColor(b.bank, i),
      })),
    [k.bankGroepen],
  );

  const pspItems: DonutItem[] = useMemo(
    () =>
      (psp?.groepen ?? []).map((p, i) => ({
        label: p.naam,
        aantal: p.aantal,
        pct: p.pct,
        eenheid: p.aantal === 1 ? "vestiging" : "vestigingen",
        color: pspColor(p.naam, i),
      })),
    [psp],
  );

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

      {/* Bank- en betaalverwerkerdiagrammen staan onderaan de pagina */}


      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Sectie titel="Omvang ondernemers">
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

        <Sectie titel="Grootste leden">
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
        <Sectie titel="Spreiding over gemeenten">
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
          <Sectie titel="Oprichting vestigingen">
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

          <Sectie titel="Lidmaatschapsduur">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Sectie titel="Bankiert bij">
          {bankItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen bankgegevens bekend.</p>
          ) : (
            <DonutDiagram
              items={bankItems}
              onSelect={(label) => {
                const b = k.bankGroepen.find((g) => g.bank === label);
                if (b) setDetail({ titel: `Bankiert bij ${b.bank}`, leden: b.leden });
              }}
            />
          )}
        </Sectie>

        <Sectie titel="Betaalverwerkers">
          {pspItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen enquêteantwoorden over betaalverwerkers.
            </p>
          ) : (
            <DonutDiagram
              items={pspItems}
              onSelect={(label) => {
                const g = psp?.groepen.find((x) => x.naam === label);
                if (g) setPspDetail({ titel: `Betaalverwerker ${g.naam}`, regels: g.vestigingen });
              }}
            />
          )}
        </Sectie>
      </div>

      <Dialog open={!!pspDetail} onOpenChange={(o) => !o && setPspDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-brand-red" />
              {pspDetail?.titel}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {(pspDetail?.regels ?? []).map((r) => (
              <div key={r} className="py-2 text-sm">
                {r}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>


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

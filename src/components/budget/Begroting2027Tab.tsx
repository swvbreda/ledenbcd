import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBegroting2027 } from "@/lib/begroting2027.functions";
import LoadingSpinner from "@/components/LoadingSpinner";

const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function Begroting2027Tab() {
  const [open, setOpen] = useState(false);
  const fetchConcept = useServerFn(getBegroting2027);
  const { data: B, isLoading, isError } = useQuery({ queryKey: ["begroting-2027-concept"], queryFn: () => fetchConcept(), retry: false, staleTime: Infinity });
  if (isLoading) return <LoadingSpinner message="Concept laden..." />;
  if (isError || !B) return <p className="text-sm text-muted-foreground">Dit concept kan niet worden geladen. Alleen beheerders kunnen het bekijken.</p>;
  const CONTROLEPUNTEN = B.controlepunten;
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl uppercase">Begroting 2027</h2>
        <Badge variant="outline" className="border-primary text-primary">Concept</Badge>
        <span className="text-sm text-muted-foreground">Peildatum {B.peildatum}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Planningsconcept, los van de begroting en administratie van andere jaren. Niet vastgesteld door de ALV,
        geen bankgeld en geen vastgesteld inkomen. Er worden geen facturen aangemaakt.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Scenario volledige staffel</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{eur(B.totalFull)}</div><p className="text-xs text-muted-foreground">Raming contributies, 100% van de verhoging</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Scenario 50% van de verhoging</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{eur(B.totalHalf)}</div><p className="text-xs text-muted-foreground">Raming contributies bij gefaseerde invoering</p></CardContent></Card>
      </div>
      <p className="text-xs text-muted-foreground">Welke fase in 2027 geldt, moet nog worden bevestigd. Beide scenario's zijn ramingen.</p>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Raming bij volledige staffel</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5 pr-2 font-medium">Staffel</th><th className="py-1.5 pr-2 text-right font-medium">Leden/groepen</th><th className="py-1.5 pr-2 text-right font-medium">Bijdrage</th><th className="py-1.5 text-right font-medium">Subtotaal</th></tr></thead>
            <tbody>
              {B.rows.map((r) => (
                <tr key={r.label} className="border-b"><td className="py-1.5 pr-2">{r.label}</td><td className="py-1.5 pr-2 text-right tabular-nums">{r.count}</td><td className="py-1.5 pr-2 text-right tabular-nums">{eur(r.amount)}</td><td className="py-1.5 text-right tabular-nums">{eur(r.count * r.amount)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5 pr-2">Totaal</td><td className="py-1.5 pr-2 text-right tabular-nums">{B.totalGroups}</td><td /><td className="py-1.5 text-right tabular-nums">{eur(B.totalFull)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Voorgestelde staffel</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">{B.staffel.map((s) => <li key={s.label} className="flex justify-between gap-2"><span>{s.label}</span><span className="tabular-nums">{eur(s.amount)}</span></li>)}</ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bron</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>ALV-presentatie 3 juni 2026 (versie 20260603), dia 16: voorstel, gefaseerd 50% / 100%.</p>
            <p>Aangevuld met de actuele ledenregistratie en profielcorrecties.</p>
            <p>De bron noemt optelling van locaties binnen dezelfde rechtspersoon; nog niet alle groepen zijn geverifieerd.</p>
          </CardContent>
        </Card>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <Card>
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left font-semibold">
            Controlepunten ({CONTROLEPUNTEN.length})
            <ChevronDown className={`h-4 w-4 text-brand-red transition-transform ${open ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ul className="list-disc space-y-1 pl-5 text-sm">{CONTROLEPUNTEN.map((c) => <li key={c}>{c}</li>)}</ul>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Uitgaven</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Uitgavenraming 2027 nog uit te werken. Er is daarom nog geen resultaat of beschikbaar budget.</CardContent>
      </Card>
    </div>
  );
}

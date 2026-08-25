import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useEnrichmentProposals,
  useResolveProposal,
  useRunEnrichment,
} from "@/hooks/useCoffeeshopRegister";

const FIELD_LABELS: Record<string, string> = {
  adres: "Adres",
  postcode: "Postcode",
  plaats: "Plaats",
  stadsdeel: "Gemeente",
  oprichtingsDatum: "Oprichtingsdatum",
  kvk: "KvK-nummer",
  website: "Website",
  telefoon: "Telefoon",
  bedrijfsnaam: "Bedrijfsnaam",
};

type Props = {
  memberName: Map<number, string>;
  isAdmin: boolean;
};

const RegisterEnrichmentPanel = ({ memberName, isAdmin }: Props) => {
  const { data: proposals = [], isLoading } = useEnrichmentProposals();
  const resolve = useResolveProposal();
  const run = useRunEnrichment();
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<number, typeof proposals>();
    for (const p of proposals) {
      const arr = map.get(p.member_id) ?? [];
      arr.push(p);
      map.set(p.member_id, arr);
    }
    return Array.from(map.entries());
  }, [proposals]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Sparkles className="h-4 w-4 text-brand-red" />
          <span className="font-medium">Aanvullingen vanuit het register</span>
          <Badge variant={proposals.length ? "default" : "secondary"}>
            {isLoading ? "…" : proposals.length}
          </Badge>
        </button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
            Ledengegevens aanvullen
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t divide-y">
          {proposals.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Geen openstaande afwijkingen. Lege velden en ontbrekende locaties zijn automatisch
              aangevuld vanuit het register.
            </p>
          )}
          {grouped.map(([memberId, items]) => (
            <div key={memberId} className="px-4 py-3">
              <p className="font-medium text-sm mb-2">
                {memberName.get(memberId) ?? `Lid #${memberId}`}
              </p>
              <div className="space-y-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 flex-wrap text-sm rounded-md border p-2"
                  >
                    <span className="font-medium min-w-32">
                      {FIELD_LABELS[p.field] ?? p.field}
                    </span>
                    <span className="text-muted-foreground line-through">
                      {p.current_value || "—"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span>{p.proposed_value}</span>
                    {INVOICE_SENSITIVE.has(p.field) && p.scope !== "locatie" && (
                      <Badge variant="destructive">beïnvloedt facturatie</Badge>
                    )}
                    <Badge variant="secondary" className="ml-auto">
                      {p.source === "kvk" ? "KvK" : "Register"}
                    </Badge>
                    <span className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ proposal: p, apply: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ proposal: p, apply: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegisterEnrichmentPanel;

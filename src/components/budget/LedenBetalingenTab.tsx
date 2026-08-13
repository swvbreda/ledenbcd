import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/hooks/useMembers";
import { useContributions, useContributionPayments } from "@/hooks/useContributions";

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

type StatusKey = "betaald" | "deels" | "open";

const statusMeta: Record<StatusKey, { label: string; icon: typeof CheckCircle2; className: string }> = {
  betaald: { label: "Betaald", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  deels: { label: "Deels betaald", icon: Clock, className: "bg-amber-100 text-amber-900 border-amber-200" },
  open: { label: "Openstaand", icon: AlertCircle, className: "bg-muted text-muted-foreground border-border" },
};

export default function LedenBetalingenPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | StatusKey>("alle");

  const { effectiveMembers, dataLoading } = useMembers();
  const { data: contributions = [], isLoading: loadingContrib } = useContributions(year);
  const { data: payments = [], isLoading: loadingPay } = useContributionPayments(year);

  const rows = useMemo(() => {
    const contribByMember = new Map(contributions.map((c) => [c.member_id, c]));
    const paidByMember = new Map<number, number>();
    const lastPaidByMember = new Map<number, string | null>();
    for (const p of payments) {
      paidByMember.set(p.member_id, (paidByMember.get(p.member_id) ?? 0) + (Number(p.amount) || 0));
      if (p.paid_at && !lastPaidByMember.get(p.member_id)) lastPaidByMember.set(p.member_id, p.paid_at);
    }

    return effectiveMembers.map((m) => {
      const c = contribByMember.get(m.id);
      const verschuldigd = Number(c?.amount ?? 0);
      const betaald = paidByMember.get(m.id) ?? (c?.paid ? verschuldigd : 0);
      const openstaand = Math.max(verschuldigd - betaald, 0);
      const status: StatusKey =
        (c?.paid && openstaand === 0) || (verschuldigd > 0 && openstaand === 0)
          ? "betaald"
          : betaald > 0
            ? "deels"
            : "open";
      return {
        id: m.id,
        naam: m.naam,
        plaats: m.plaats,
        contactpersoon: m.contactpersoon,
        factuurnummer: c?.invoice_number ?? null,
        verschuldigd,
        betaald,
        openstaand,
        laatsteBetaling: lastPaidByMember.get(m.id) ?? c?.paid_date ?? null,
        status,
      };
    });
  }, [effectiveMembers, contributions, payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === "alle" ? true : r.status === statusFilter))
      .filter((r) =>
        !q
          ? true
          : r.naam.toLowerCase().includes(q) ||
            (r.plaats || "").toLowerCase().includes(q) ||
            (r.contactpersoon || "").toLowerCase().includes(q) ||
            (r.factuurnummer || "").toLowerCase().includes(q) ||
            String(r.id).includes(q),
      )
      .sort((a, b) => b.openstaand - a.openstaand || a.naam.localeCompare(b.naam));
  }, [rows, search, statusFilter]);

  const totals = useMemo(
    () => ({
      leden: rows.length,
      verschuldigd: rows.reduce((s, r) => s + r.verschuldigd, 0),
      betaald: rows.reduce((s, r) => s + r.betaald, 0),
      openstaand: rows.reduce((s, r) => s + r.openstaand, 0),
      betaaldeLeden: rows.filter((r) => r.status === "betaald").length,
    }),
    [rows],
  );

  const loading = dataLoading || loadingContrib || loadingPay;
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-6">
      <BcdHeroBanner
        title="Leden & betalingen"
        subtitle={`Leden, contributies en betaalstatus van ${year} in één overzicht`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Leden", value: String(totals.leden), sub: `${totals.betaaldeLeden} volledig betaald` },
          { label: "Verschuldigd", value: euro(totals.verschuldigd) },
          { label: "Ontvangen", value: euro(totals.betaald) },
          { label: "Openstaand", value: euro(totals.openstaand) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{k.value}</p>
              {k.sub && <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op lid, plaats, contactpersoon of factuurnummer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {years.map((y) => (
            <Button key={y} size="sm" variant={y === year ? "default" : "outline"} onClick={() => setYear(y)}>
              {y}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(["alle", "open", "deels", "betaald"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {s === "alle" ? "Alle" : statusMeta[s].label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Geen leden gevonden.</p>
      ) : (
        <>
          {/* Mobiel: kaarten */}
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => {
              const meta = statusMeta[r.status];
              return (
                <Link key={r.id} to={`/leden/${r.id}`} className="block">
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{r.naam}</p>
                          <p className="text-xs text-muted-foreground">
                            #{r.id} · {r.plaats}
                          </p>
                        </div>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm tabular-nums pt-1">
                        <span className="text-muted-foreground">Verschuldigd {euro(r.verschuldigd)}</span>
                        <span className="font-medium">Open {euro(r.openstaand)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3 font-medium">Lid</th>
                  <th className="p-3 font-medium">Plaats</th>
                  <th className="p-3 font-medium">Factuur</th>
                  <th className="p-3 font-medium text-right">Verschuldigd</th>
                  <th className="p-3 font-medium text-right">Betaald</th>
                  <th className="p-3 font-medium text-right">Openstaand</th>
                  <th className="p-3 font-medium">Laatste betaling</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = statusMeta[r.status];
                  const Icon = meta.icon;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <Link to={`/leden/${r.id}`} className="font-medium hover:underline">
                          {r.naam}
                        </Link>
                        <span className="text-muted-foreground text-xs ml-1">#{r.id}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.plaats}</td>
                      <td className="p-3 text-muted-foreground">{r.factuurnummer ?? "—"}</td>
                      <td className="p-3 text-right tabular-nums">{euro(r.verschuldigd)}</td>
                      <td className="p-3 text-right tabular-nums">{euro(r.betaald)}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{euro(r.openstaand)}</td>
                      <td className="p-3 text-muted-foreground">
                        {r.laatsteBetaling ? new Date(r.laatsteBetaling).toLocaleDateString("nl-NL") : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {meta.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

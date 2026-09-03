import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { CheckCircle2, XCircle, Search, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { buildPhoneIndex, extractPhones, normalizePhone } from "@/lib/phoneMatch";
import { toast } from "@/hooks/use-toast";

type FilterMode = "all" | "in" | "out" | "unchecked";

const CommunityDeelnemersTable = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const allMembers = useMemo(
    () => [...rawMembers, ...rawLeads],
    [rawMembers, rawLeads],
  );
  const { statusByMember, isLoading, setStatus, bulkSetStatus } = useWhatsAppStatus();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMembers
      .filter((m) => {
        const s = statusByMember[m.id];
        if (filter === "in" && !s?.in_community) return false;
        if (filter === "out" && s?.in_community !== false) return false;
        if (filter === "unchecked" && s) return false;
        if (!q) return true;
        return (
          (m.naam || "").toLowerCase().includes(q) ||
          (m.bedrijfsnaam || "").toLowerCase().includes(q) ||
          (m.plaats || "").toLowerCase().includes(q) ||
          (m.contactpersoon || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.naam || "").localeCompare(b.naam || ""));
  }, [allMembers, statusByMember, query, filter]);

  const counts = useMemo(() => {
    let inC = 0;
    let outC = 0;
    let unchecked = 0;
    for (const m of allMembers) {
      const s = statusByMember[m.id];
      if (!s) unchecked++;
      else if (s.in_community) inC++;
      else outC++;
    }
    return { inC, outC, unchecked, total: allMembers.length };
  }, [allMembers, statusByMember]);

  const runBulkMatch = async () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const { byNormalized } = buildPhoneIndex(allMembers);

    const matchedByMember = new Map<
      number,
      { phone: string; name: string }
    >();

    for (const line of lines) {
      const raws = extractPhones(line);
      for (const raw of raws) {
        const n = normalizePhone(raw);
        if (!n) continue;
        const entries = byNormalized.get(n);
        if (!entries) continue;
        const label = line.replace(raw, "").replace(/\s{2,}/g, " ").trim();
        for (const e of entries) {
          if (!matchedByMember.has(e.memberId)) {
            matchedByMember.set(e.memberId, {
              phone: raw,
              name: label || e.memberName,
            });
          }
        }
      }
    }

    const rows = Array.from(matchedByMember.entries()).map(([id, info]) => ({
      member_id: id,
      in_community: true,
      matched_phone: info.phone,
      matched_name: info.name,
    }));

    try {
      await bulkSetStatus.mutateAsync(rows);
      toast({
        title: `${rows.length} leden gemarkeerd als 'in community'`,
        description: "Leden zonder match blijven ongewijzigd — zet ze handmatig op 'uit'.",
      });
      setBulkInput("");
      setBulkOpen(false);
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: e.message, variant: "destructive" });
    }
  };

  const toggle = async (memberId: number, next: boolean) => {
    try {
      await setStatus.mutateAsync({ member_id: memberId, in_community: next });
    } catch (e: any) {
      toast({ title: "Bijwerken mislukt", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Totaal" value={counts.total} />
        <SummaryCard label="In community" value={counts.inC} tone="good" />
        <SummaryCard label="Niet in community" value={counts.outC} tone="bad" />
        <SummaryCard label="Nog niet gecheckt" value={counts.unchecked} tone="muted" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Zoek lid, plaats of contactpersoon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle leden</SelectItem>
            <SelectItem value="in">Wel in community</SelectItem>
            <SelectItem value="out">Niet in community</SelectItem>
            <SelectItem value="unchecked">Nog niet gecheckt</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={bulkOpen ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setBulkOpen((v) => !v)}
        >
          <Wand2 size={14} /> Bulk-match
        </Button>
      </div>

      {bulkOpen && (
        <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
          <p className="text-sm">
            Plak de WhatsApp-deelnemerslijst. Elk lid waarvan een telefoonnummer matcht wordt
            automatisch op <strong>in community</strong> gezet.
          </p>
          <Textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="Naam +31 6 12 34 56 78&#10;Andere naam +31 6 ..."
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={runBulkMatch} disabled={bulkSetStatus.isPending}>
              {bulkSetStatus.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Match en opslaan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBulkOpen(false)}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Lid</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Plaats</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Gematcht nr.</th>
                <th className="px-3 py-2 font-medium hidden lg:table-cell">Laatste check</th>
                <th className="px-3 py-2 font-medium text-right">In community?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Laden…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Geen leden gevonden.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const s = statusByMember[m.id];
                  return (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Link
                          to={`/leden/${m.id}`}
                          className="font-medium hover:text-brand-red"
                        >
                          {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                        {m.plaats || "—"}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {s?.matched_phone ? (
                          <span className="font-mono text-xs">{s.matched_phone}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden lg:table-cell">
                        {s?.last_checked_at
                          ? new Date(s.last_checked_at).toLocaleDateString("nl-NL")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {s ? (
                            s.in_community ? (
                              <CheckCircle2 size={14} className="text-brand-red" />
                            ) : (
                              <XCircle size={14} className="text-muted-foreground" />
                            )
                          ) : null}
                          <Switch
                            checked={!!s?.in_community}
                            onCheckedChange={(v) => toggle(m.id, v)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "good" | "bad" | "muted";
}) => (
  <div className="border border-border rounded-md px-3 py-2 bg-card">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p
      className={`text-xl font-semibold tabular-nums ${
        tone === "good"
          ? "text-brand-red"
          : tone === "bad"
          ? "text-foreground"
          : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

export default CommunityDeelnemersTable;
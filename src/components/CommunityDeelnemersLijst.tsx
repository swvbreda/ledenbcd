import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

const CommunityDeelnemersLijst = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const allMembers = useMemo(() => [...rawMembers, ...rawLeads], [rawMembers, rawLeads]);
  const { statusByMember, isLoading } = useWhatsAppStatus();
  const [query, setQuery] = useState("");

  const participants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMembers
      .map((m) => {
        const s = statusByMember[m.id];
        if (!s?.in_community) return null;
        return {
          member: m,
          status: s,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => {
        if (!q) return true;
        const m = x.member;
        return (
          (m.naam || "").toLowerCase().includes(q) ||
          (m.bedrijfsnaam || "").toLowerCase().includes(q) ||
          (m.plaats || "").toLowerCase().includes(q) ||
          (x.status.matched_name || "").toLowerCase().includes(q) ||
          (x.status.matched_phone || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.member.naam || "").localeCompare(b.member.naam || ""));
  }, [allMembers, statusByMember, query]);

  if (isLoading) {
    return (
      <div className="border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
        Laden…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {participants.length} deelnemer{participants.length === 1 ? "" : "s"} in de WhatsApp-community
        </p>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek coffeeshop, naam of nummer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Coffeeshop</th>
                <th className="px-3 py-2 font-medium hidden sm:table-cell">Plaats</th>
                <th className="px-3 py-2 font-medium">WhatsApp-naam</th>
                <th className="px-3 py-2 font-medium">Nummer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Geen deelnemers gevonden.
                  </td>
                </tr>
              ) : (
                participants.map(({ member: m, status: s }) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link to={`/leden/${m.id}`} className="font-medium hover:text-brand-red">
                        {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {m.plaats || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-muted-foreground/60" />
                        <span>{s.matched_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-muted-foreground/60" />
                        <span className="font-mono text-xs">
                          {s.matched_phone || "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CommunityDeelnemersLijst;

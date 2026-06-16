import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, User, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMembersData } from "@/contexts/MembersDataContext";
import { supabase } from "@/integrations/supabase/client";

type Participant = {
  id: string;
  display_name: string;
  phone: string | null;
  member_id: number | null;
  sort_key: string | null;
};

const CommunityDeelnemersLijst = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const memberById = useMemo(() => {
    const map = new Map<number, (typeof rawMembers)[number]>();
    [...rawMembers, ...rawLeads].forEach((m) => map.set(m.id, m));
    return map;
  }, [rawMembers, rawLeads]);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_participants")
        .select("id, display_name, phone, member_id, sort_key")
        .order("sort_key");
      if (!active) return;
      setParticipants((data || []) as Participant[]);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (!q) return true;
      const m = p.member_id ? memberById.get(p.member_id) : null;
      return (
        p.display_name.toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q) ||
        (m?.naam || "").toLowerCase().includes(q) ||
        (m?.bedrijfsnaam || "").toLowerCase().includes(q) ||
        (m?.plaats || "").toLowerCase().includes(q)
      );
    });
  }, [participants, memberById, query]);

  const matchedCount = participants.filter((p) => p.member_id).length;

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
          {participants.length} deelnemers in de WhatsApp-community
          <span className="ml-1">
            ({matchedCount} gekoppeld aan coffeeshop, {participants.length - matchedCount} nog niet)
          </span>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Geen deelnemers gevonden.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const m = p.member_id ? memberById.get(p.member_id) : null;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {m ? (
                          <Link to={`/leden/${m.id}`} className="font-medium hover:text-brand-red">
                            {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground italic">
                            <AlertCircle size={12} className="text-amber-500" />
                            Niet gekoppeld
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {m?.plaats || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-muted-foreground/60" />
                          <span>{p.display_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-muted-foreground/60" />
                          <span className="font-mono text-xs">{p.phone || "—"}</span>
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

export default CommunityDeelnemersLijst;

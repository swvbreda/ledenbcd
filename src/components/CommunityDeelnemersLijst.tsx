import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, User, AlertCircle, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMembersData } from "@/contexts/MembersDataContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/phoneMatch";
import { useAuth } from "@/hooks/useAuth";
import CommunityUploadDialog from "@/components/CommunityUploadDialog";

type Participant = {
  id: string;
  display_name: string;
  phone: string | null;
  member_id: number | null;
  sort_key: string | null;
};

const CommunityDeelnemersLijst = () => {
  const { rawMembers, rawLeads, rawOldMembers } = useMembersData();
  const { isAdmin, isBoard } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const memberById = useMemo(() => {
    const map = new Map<number, { m: (typeof rawMembers)[number]; type: "member" | "lead" | "old" }>();
    rawMembers.forEach((m) => map.set(m.id, { m, type: "member" }));
    rawLeads.forEach((m) => map.set(m.id, { m, type: "lead" }));
    rawOldMembers.forEach((m) => map.set(m.id, { m, type: "old" }));
    return map;
  }, [rawMembers, rawLeads, rawOldMembers]);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("whatsapp_participants")
      .select("id, display_name, phone, member_id, sort_key")
      .order("sort_key");
    setParticipants((data || []) as Participant[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (!q) return true;
      const m = p.member_id ? memberById.get(p.member_id)?.m : null;
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
        <div className="flex items-center gap-2 flex-wrap">
          {(isAdmin || isBoard) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-brand-red text-brand-red hover:bg-brand-red/10"
              onClick={() => setUploadOpen(true)}
            >
              <Upload size={14} />
              Upload deelnemerslijst
            </Button>
          )}
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
      </div>

      <CommunityUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={load}
      />

      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Naam</th>
                <th className="px-3 py-2 font-medium">Nummer</th>
                <th className="px-3 py-2 font-medium">Coffeeshop</th>
                <th className="px-3 py-2 font-medium hidden sm:table-cell">Plaats</th>
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
                  const entry = p.member_id ? memberById.get(p.member_id) : null;
                  const m = entry?.m || null;
                  const type = entry?.type;
                  const memberPhone =
                    m?.telefoon ||
                    m?.contacten?.find((c) => c.telefoon)?.telefoon ||
                    "";
                  const phone = p.phone || memberPhone;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-muted-foreground/60" />
                          <span>{p.display_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-muted-foreground/60" />
                          <span className="font-mono text-xs">{phone ? formatPhone(phone) : "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {m ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/leden/${m.id}`} className="font-medium hover:text-brand-red">
                              {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                            </Link>
                            {type === "member" && (
                              <span className="text-xs font-mono text-muted-foreground">
                                #{m.id}
                              </span>
                            )}
                            {type === "lead" && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800">
                                Lead
                              </span>
                            )}
                            {type === "old" && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-sm bg-destructive/10 text-destructive">
                                Oud-lid
                              </span>
                            )}
                          </div>
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

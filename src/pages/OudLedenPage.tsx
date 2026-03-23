import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserMinus, Search, MapPin, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import type { Member } from "@/data/types";
import { useMembersData } from "@/contexts/MembersDataContext";
import { getArchivedIds } from "@/hooks/useArchive";

const OudLedenPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const archivedIds = useMemo(() => getArchivedIds(), []);
  const oldMembers = useMemo(
    () => allMembersAndLeads.filter((m) => archivedIds.includes(m.id)),
    [archivedIds]
  );

  const filtered = searchQuery
    ? oldMembers.filter(
        (m) =>
          m.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.plaats.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(m.id).includes(searchQuery)
      )
    : oldMembers;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display flex items-center gap-2">
          <UserMinus size={22} className="text-muted-foreground" />
          Oud-leden
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Voormalige leden van de BCD
        </p>
      </div>

      {oldMembers.length > 0 && (
        <div className="max-w-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek oud-leden..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground w-16">Lidnr.</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Naam</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plaats</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-20">Locaties</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/leden/${member.id}`)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{member.id}</td>
                    <td className="px-4 py-3 font-medium font-display">{member.naam}</td>
                    <td className="px-4 py-3">{member.plaats}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin size={13} />
                        {member.aantalLocaties}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <UserMinus size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Geen oud-leden</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Oud-leden verschijnen hier wanneer ze worden verplaatst vanuit de ledenlijst.
          </p>
        </div>
      )}
    </div>
  );
};

export default OudLedenPage;

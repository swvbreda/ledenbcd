import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { allMembers } from "@/hooks/useMembers";

const LocatiesPage = () => {
  const [search, setSearch] = useState("");

  const locations = useMemo(() => {
    return allMembers.flatMap((m) =>
      m.locaties.map((l) => ({
        ...l,
        memberNaam: m.naam,
        memberId: m.id,
      }))
    );
  }, []);

  const filtered = useMemo(() => {
    if (!search) return locations;
    const q = search.toLowerCase();
    return locations.filter(
      (l) =>
        l.naam.toLowerCase().includes(q) ||
        (l.plaats || "").toLowerCase().includes(q) ||
        (l.adres || "").toLowerCase().includes(q) ||
        (l.stadsdeel || "").toLowerCase().includes(q) ||
        l.memberNaam.toLowerCase().includes(q)
    );
  }, [locations, search]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Alle Locaties</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} locaties</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek locatie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Naam</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Lid</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Adres</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Postcode</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plaats</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stadsdeel</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium font-display">{loc.naam}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{loc.memberNaam}</td>
                  <td className="px-4 py-3 text-muted-foreground">{loc.adres || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{loc.postcode || "—"}</td>
                  <td className="px-4 py-3">{loc.plaats || "—"}</td>
                  <td className="px-4 py-3">
                    {loc.stadsdeel ? (
                      <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">{loc.stadsdeel}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{loc.contactpersoon || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocatiesPage;

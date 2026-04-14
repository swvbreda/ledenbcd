import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Store, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Member } from "@/data/types";

interface CoffeeshopRow {
  locatieNaam: string;
  plaats: string;
  stadsdeel: string;
}

type SortKey = "locatieNaam" | "plaats" | "stadsdeel";

const SupplierCoffeeshopTable = ({ members }: { members: Member[] }) => {
  const [sortKey, setSortKey] = useState<SortKey>("locatieNaam");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");

  const rows: CoffeeshopRow[] = useMemo(() =>
    members.flatMap((m) =>
      m.locaties.map((l) => ({
        locatieNaam: l.naam || m.naam,
        plaats: l.plaats || m.plaats,
        stadsdeel: l.stadsdeel || m.stadsdeel || "",
      }))
    ), [members]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.locatieNaam.toLowerCase().includes(q) ||
      r.plaats.toLowerCase().includes(q) ||
      r.stadsdeel.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }), [filtered, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Store size={18} /> Aangesloten Coffeeshops
          </h2>
          <p className="text-sm text-muted-foreground">{rows.length} locaties</p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek coffeeshop of plaats..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Mobile */}
        <div className="md:hidden">
          {sorted.map((row, i) => (
            <div key={i} className="p-3 border-b border-border">
              <span className="font-medium text-sm">{row.locatieNaam}</span>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{row.plaats}</span>
                {row.stadsdeel && <span>· {row.stadsdeel}</span>}
              </div>
              
            </div>
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("locatieNaam")}>
                  <span className="inline-flex items-center gap-1">Coffeeshop <SortIcon col="locatieNaam" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("plaats")}>
                  <span className="inline-flex items-center gap-1">Gemeente <SortIcon col="plaats" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("stadsdeel")}>
                  <span className="inline-flex items-center gap-1">Stadsdeel <SortIcon col="stadsdeel" /></span>
                </th>
                
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.locatieNaam}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.plaats}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.stadsdeel || "—"}</td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Geen coffeeshops gevonden</div>
        )}
      </div>
    </div>
  );
};

export default SupplierCoffeeshopTable;

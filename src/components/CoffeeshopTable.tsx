import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Member } from "@/data/types";
import { getLocationGemeente } from "@/data/gemeenteMapping";

interface CoffeeshopRow {
  locatieNaam: string;
  lidNaam: string;
  lidId: number;
  plaats: string;
  gemeente: string;
  stadsdeel: string;
  adres: string;
  postcode: string;
  isLead: boolean;
}

interface CoffeeshopTableProps {
  members: Member[];
  leadIds: Set<number>;
}

type SortKey = "locatieNaam" | "lidNaam" | "gemeente" | "stadsdeel";

const CoffeeshopTable = ({ members, leadIds }: CoffeeshopTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("locatieNaam");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();

  const rows: CoffeeshopRow[] = members.flatMap((m) =>
    m.locaties.map((l) => ({
      locatieNaam: l.naam,
      lidNaam: m.naam,
      lidId: m.id,
      plaats: l.plaats || m.plaats,
      gemeente: getLocationGemeente(l, m.plaats),
      stadsdeel: l.stadsdeel || m.stadsdeel || "",
      adres: l.adres || "",
      postcode: l.postcode || "",
      isLead: leadIds.has(m.id),
    }))
  );

  const sorted = [...rows].sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? 1 : -1;
    const av = a[sortKey] || "";
    const bv = b[sortKey] || "";
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const MobileCard = ({ row }: { row: CoffeeshopRow }) => (
    <div
      className="p-3 border-b border-border active:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/leden/${row.lidId}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium font-display text-sm">{row.locatieNaam}</span>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{row.plaats}</span>
            {row.gemeente && row.gemeente !== row.plaats && <span>· gemeente {row.gemeente}</span>}
            {row.stadsdeel && <span>· {row.stadsdeel}</span>}
          </div>
          {row.adres && (
            <p className="text-xs text-muted-foreground mt-0.5">{row.adres}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{row.lidNaam}</span>
          <ExternalLink size={14} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Mobile */}
      <div className="md:hidden">
        {sorted.map((row, i) => (
          <MobileCard key={`${row.lidId}-${i}`} row={row} />
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th
                className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSort("locatieNaam")}
              >
                <span className="inline-flex items-center gap-1">Coffeeshop <SortIcon col="locatieNaam" /></span>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSort("gemeente")}
              >
                <span className="inline-flex items-center gap-1">Gemeente <SortIcon col="gemeente" /></span>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSort("stadsdeel")}
              >
                <span className="inline-flex items-center gap-1">Stadsdeel <SortIcon col="stadsdeel" /></span>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Adres</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-20">Lidnr.</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={`${row.lidId}-${i}`}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/leden/${row.lidId}`)}
              >
                <td className="px-4 py-3 font-medium font-display whitespace-nowrap">
                  {row.locatieNaam}
                  {row.isLead && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm text-[10px] font-semibold uppercase tracking-wide">
                      Lead
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.gemeente || row.plaats}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.stadsdeel || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{row.adres || "—"}</td>
                <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{row.isLead ? "—" : row.lidId}</td>
                <td className="px-4 py-3">
                  <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">Geen coffeeshops gevonden</div>
      )}
    </div>
  );
};

export default CoffeeshopTable;

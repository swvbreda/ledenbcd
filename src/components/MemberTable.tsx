import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Mail, Phone } from "lucide-react";
import type { Member } from "@/data/types";

interface MemberTableProps {
  members: Member[];
  searchQuery: string;
}

type SortKey = "id" | "naam" | "plaats" | "jarenLid" | "aantalLocaties";

const MemberTable = ({ members, searchQuery }: MemberTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.naam.toLowerCase().includes(q) ||
      m.plaats.toLowerCase().includes(q) ||
      m.contactpersoon.toLowerCase().includes(q) ||
      m.bedrijfsnaam.toLowerCase().includes(q) ||
      String(m.id).includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "id", label: "#", className: "w-12" },
    { key: "naam", label: "Naam" },
    { key: "plaats", label: "Plaats" },
    { key: "aantalLocaties", label: "Locaties", className: "w-24 text-center" },
    { key: "jarenLid", label: "Jaren Lid", className: "w-24 text-center" },
  ];

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${col.className || ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Contact</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <>
                <tr
                  key={member.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
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
                  <td className="px-4 py-3 text-center">
                    {member.jarenLid ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        member.jarenLid >= 30 ? "bg-success/10 text-success" :
                        member.jarenLid >= 10 ? "bg-primary/10 text-primary" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {member.jarenLid} jr
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground text-xs">{member.contactpersoon}</span>
                  </td>
                </tr>
                {expandedId === member.id && (
                  <tr key={`${member.id}-detail`} className="bg-muted/20">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contactgegevens</h4>
                          <p className="font-medium">{member.contactpersoon || "—"}</p>
                          <p className="text-muted-foreground text-xs">{member.functie}</p>
                          {member.email && (
                            <p className="flex items-center gap-1 text-xs mt-1 text-primary">
                              <Mail size={12} /> {member.email}
                            </p>
                          )}
                          {member.telefoon && (
                            <p className="flex items-center gap-1 text-xs mt-0.5 text-muted-foreground">
                              <Phone size={12} /> {member.telefoon}
                            </p>
                          )}
                          {member.bedrijfsnaam && (
                            <p className="text-xs mt-2 text-muted-foreground">
                              Bedrijf: <span className="text-foreground">{member.bedrijfsnaam}</span>
                            </p>
                          )}
                          {member.contactpersoon2 && (
                            <div className="mt-3 pt-2 border-t border-border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">2e Contactpersoon</p>
                              <p className="font-medium text-xs">{member.contactpersoon2}</p>
                              {member.functie2 && <p className="text-muted-foreground text-xs">{member.functie2}</p>}
                              {member.email2 && (
                                <p className="flex items-center gap-1 text-xs mt-0.5 text-primary">
                                  <Mail size={12} /> {member.email2}
                                </p>
                              )}
                              {member.telefoon2 && (
                                <p className="flex items-center gap-1 text-xs mt-0.5 text-muted-foreground">
                                  <Phone size={12} /> {member.telefoon2}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Factuurgegevens</h4>
                          {member.factuurBedrijfsnaam ? (
                            <p className="font-medium text-xs">{member.factuurBedrijfsnaam}</p>
                          ) : (
                            <p className="text-muted-foreground text-xs">—</p>
                          )}
                          {member.factuurKvk && (
                            <p className="text-xs text-muted-foreground mt-0.5">KVK: {member.factuurKvk}</p>
                          )}
                          {member.factuurAdres && (
                            <p className="text-xs mt-1 text-muted-foreground">
                              {member.factuurAdres}
                              {member.factuurPostcode && <>, {member.factuurPostcode}</>}
                              {member.factuurPlaats && <> {member.factuurPlaats}</>}
                            </p>
                          )}
                          {member.factuurEmail && (
                            <p className="flex items-center gap-1 text-xs mt-1 text-primary">
                              <Mail size={12} /> {member.factuurEmail}
                            </p>
                          )}
                          {member.factuurTelefoon && (
                            <p className="flex items-center gap-1 text-xs mt-0.5 text-muted-foreground">
                              <Phone size={12} /> {member.factuurTelefoon}
                            </p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Locaties ({member.aantalLocaties})
                          </h4>
                          <div className="space-y-1.5">
                            {member.locaties.map((loc, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium">{loc.naam}</span>
                                {loc.adres && <span className="text-muted-foreground"> · {loc.adres}</span>}
                                {loc.plaats && <span className="text-muted-foreground"> · {loc.plaats}</span>}
                                {loc.stadsdeel && (
                                  <span className="ml-1 inline-block px-1.5 py-0.5 bg-muted rounded text-muted-foreground text-[10px]">
                                    {loc.stadsdeel}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Geen leden gevonden voor "{searchQuery}"
        </div>
      )}
    </div>
  );
};

export default MemberTable;

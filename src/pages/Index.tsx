import { useState } from "react";
import { Search } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import StatCards from "@/components/StatCards";
import MemberTable from "@/components/MemberTable";
import CityChart from "@/components/CityChart";
import StadsdeelChart from "@/components/StadsdeelChart";
import membersData from "@/data/members.json";
import type { Member } from "@/data/types";

const members = membersData as Member[];

const Index = () => {
  const [activeTab, setActiveTab] = useState("overzicht");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="ml-60">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-card border-b border-border px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Zoek op naam, stad of contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </header>

        <div className="p-6 space-y-6">
          {(activeTab === "overzicht" || activeTab === "leden") && (
            <StatCards members={members} />
          )}

          {activeTab === "overzicht" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CityChart members={members} />
                <StadsdeelChart members={members} />
              </div>
              <div>
                <h2 className="text-lg font-semibold font-display mb-3">Recente Leden</h2>
                <MemberTable
                  members={members.filter((m) => m.jarenLid !== null && m.jarenLid <= 10)}
                  searchQuery={searchQuery}
                />
              </div>
            </>
          )}

          {activeTab === "leden" && (
            <div>
              <h2 className="text-lg font-semibold font-display mb-3">Alle Leden</h2>
              <MemberTable members={members} searchQuery={searchQuery} />
            </div>
          )}

          {activeTab === "locaties" && (
            <div>
              <h2 className="text-lg font-semibold font-display mb-3">Alle Locaties</h2>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Naam</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Adres</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Postcode</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plaats</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stadsdeel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members
                      .flatMap((m) => m.locaties.map((l) => ({ ...l, memberId: m.id })))
                      .filter((l) => {
                        const q = searchQuery.toLowerCase();
                        return (
                          l.naam.toLowerCase().includes(q) ||
                          (l.plaats || "").toLowerCase().includes(q) ||
                          (l.adres || "").toLowerCase().includes(q) ||
                          (l.stadsdeel || "").toLowerCase().includes(q)
                        );
                      })
                      .map((loc, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium font-display">{loc.naam}</td>
                          <td className="px-4 py-3 text-muted-foreground">{loc.adres || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{loc.postcode || "—"}</td>
                          <td className="px-4 py-3">{loc.plaats || "—"}</td>
                          <td className="px-4 py-3">
                            {loc.stadsdeel ? (
                              <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                                {loc.stadsdeel}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "statistieken" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold font-display mb-3">Statistieken</h2>
              <StatCards members={members} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CityChart members={members} />
                <StadsdeelChart members={members} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;

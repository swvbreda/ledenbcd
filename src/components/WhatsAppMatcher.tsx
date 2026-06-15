import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MessageSquare, CheckCircle2, HelpCircle, AlertTriangle, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMembersData } from "@/contexts/MembersDataContext";
import {
  buildPhoneIndex,
  extractPhones,
  normalizePhone,
  type MemberPhoneEntry,
} from "@/lib/phoneMatch";
import { toast } from "@/hooks/use-toast";

const WhatsAppMatcher = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const allMembers = useMemo(() => [...rawMembers, ...rawLeads], [rawMembers, rawLeads]);
  const index = useMemo(() => buildPhoneIndex(allMembers), [allMembers]);

  const [singleQuery, setSingleQuery] = useState("");
  const [bulkInput, setBulkInput] = useState("");

  const singleResult = useMemo(() => {
    const n = normalizePhone(singleQuery);
    if (!n) return null;
    return { normalized: n, matches: index.byNormalized.get(n) ?? [] };
  }, [singleQuery, index]);

  const bulkResult = useMemo(() => {
    if (!bulkInput.trim()) return null;
    const raws = extractPhones(bulkInput);
    const seen = new Set<string>();
    const matched: { raw: string; normalized: string; entries: MemberPhoneEntry[] }[] = [];
    const unknown: { raw: string; normalized: string }[] = [];
    const matchedMemberIds = new Set<number>();

    for (const raw of raws) {
      const n = normalizePhone(raw);
      if (!n) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      const entries = index.byNormalized.get(n);
      if (entries && entries.length > 0) {
        matched.push({ raw, normalized: n, entries });
        entries.forEach((e) => matchedMemberIds.add(e.memberId));
      } else {
        unknown.push({ raw, normalized: n });
      }
    }

    const missingMembers = allMembers.filter((m) => !matchedMemberIds.has(m.id));

    return { matched, unknown, missingMembers, totalParsed: seen.size };
  }, [bulkInput, index, allMembers]);

  const copyList = async (lines: string[]) => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Gekopieerd naar klembord" });
    } catch {
      toast({ title: "Kopiëren mislukt", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    if (!bulkResult) return;
    const rows: string[][] = [["Status", "Nummer", "Lid", "Plaats", "Contactpersoon", "Rol"]];
    for (const m of bulkResult.matched) {
      for (const e of m.entries) {
        rows.push(["Gematcht", m.raw, e.memberName, e.memberPlaats, e.contactNaam, e.contactRol]);
      }
    }
    for (const u of bulkResult.unknown) {
      rows.push(["Onbekend", u.raw, "", "", "", ""]);
    }
    for (const mm of bulkResult.missingMembers) {
      rows.push([
        "Niet in WhatsApp",
        "",
        mm.naam || mm.bedrijfsnaam || `Lid #${mm.id}`,
        mm.plaats || "",
        mm.contactpersoon || "",
        mm.telefoon || "",
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-match-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-brand-red/10 p-2 shrink-0">
            <MessageSquare className="text-brand-red" size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-base">WhatsApp-nummer matcher</h2>
            <p className="text-sm text-muted-foreground">
              Controleer of telefoonnummers uit de WhatsApp-community bij geregistreerde leden horen.
              Zoek één nummer op, of plak de hele deelnemerslijst voor een bulkrapport.
            </p>
          </div>
        </div>

        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single" className="gap-1.5">
              <Search size={14} /> Zoek één nummer
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1.5">
              <MessageSquare size={14} /> Bulk-match
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-3 pt-4">
            <Input
              type="tel"
              placeholder="Bijv. +31 6 12345678 of 0612345678"
              value={singleQuery}
              onChange={(e) => setSingleQuery(e.target.value)}
              className="max-w-md"
              autoComplete="off"
            />
            {singleQuery && !singleResult && (
              <p className="text-sm text-muted-foreground">Vul een geldig telefoonnummer in.</p>
            )}
            {singleResult && singleResult.matches.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
                <HelpCircle className="text-muted-foreground shrink-0 mt-0.5" size={16} />
                <div className="text-sm">
                  <p className="font-medium">Onbekend nummer</p>
                  <p className="text-muted-foreground">
                    Dit nummer komt niet voor in de ledenadministratie.
                  </p>
                </div>
              </div>
            )}
            {singleResult && singleResult.matches.length > 0 && (
              <div className="space-y-2">
                {singleResult.matches.map((e, i) => (
                  <Link
                    key={i}
                    to={`/leden/${e.memberId}`}
                    className="flex items-start gap-2 p-3 rounded-md bg-card border border-border hover:border-brand-red transition-colors"
                  >
                    <CheckCircle2 className="text-brand-red shrink-0 mt-0.5" size={16} />
                    <div className="text-sm">
                      <p className="font-medium">
                        {e.memberName}
                        {e.memberPlaats && (
                          <span className="text-muted-foreground font-normal"> · {e.memberPlaats}</span>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {e.contactNaam} ({e.contactRol})
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bulk" className="space-y-3 pt-4">
            <Textarea
              placeholder={`Plak hier de WhatsApp-deelnemerslijst.\nEén nummer per regel of de ruwe export — de tool pikt nummers er zelf uit.`}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            {bulkResult && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    {bulkResult.totalParsed} unieke nummers gevonden in de input.
                  </p>
                  <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                    <Download size={14} /> Exporteer rapport (CSV)
                  </Button>
                </div>

                {/* Matched */}
                <section className="border border-border rounded-md">
                  <header className="px-3 py-2 border-b border-border flex items-center gap-2 bg-muted/30">
                    <CheckCircle2 className="text-brand-red" size={16} />
                    <h3 className="font-medium text-sm">
                      Gematcht ({bulkResult.matched.length})
                    </h3>
                  </header>
                  {bulkResult.matched.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Geen matches.</p>
                  ) : (
                    <ul className="divide-y divide-border max-h-80 overflow-auto">
                      {bulkResult.matched.map((m, i) => (
                        <li key={i} className="px-3 py-2 text-sm">
                          <span className="font-mono text-muted-foreground mr-2">{m.raw}</span>
                          →{" "}
                          {m.entries.map((e, j) => (
                            <span key={j}>
                              {j > 0 && ", "}
                              <Link
                                to={`/leden/${e.memberId}`}
                                className="font-medium hover:text-brand-red"
                              >
                                {e.memberName}
                              </Link>{" "}
                              <span className="text-muted-foreground">
                                ({e.contactNaam}, {e.contactRol})
                              </span>
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Unknown */}
                <section className="border border-border rounded-md">
                  <header className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="text-muted-foreground" size={16} />
                      <h3 className="font-medium text-sm">
                        Onbekend in ledenadministratie ({bulkResult.unknown.length})
                      </h3>
                    </div>
                    {bulkResult.unknown.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7"
                        onClick={() => copyList(bulkResult.unknown.map((u) => u.raw))}
                      >
                        <Copy size={12} /> Kopieer
                      </Button>
                    )}
                  </header>
                  {bulkResult.unknown.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      Alle nummers in de input zijn herkend.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border max-h-60 overflow-auto">
                      {bulkResult.unknown.map((u, i) => (
                        <li key={i} className="px-3 py-2 text-sm font-mono">
                          {u.raw}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Missing in WhatsApp */}
                <section className="border border-border rounded-md">
                  <header className="px-3 py-2 border-b border-border flex items-center gap-2 bg-muted/30">
                    <AlertTriangle className="text-muted-foreground" size={16} />
                    <h3 className="font-medium text-sm">
                      Geen telefoonnummer in WhatsApp-lijst ({bulkResult.missingMembers.length})
                    </h3>
                  </header>
                  {bulkResult.missingMembers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      Alle leden komen voor in de geplakte lijst.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border max-h-80 overflow-auto">
                      {bulkResult.missingMembers.map((m) => (
                        <li key={m.id} className="px-3 py-2 text-sm">
                          <Link
                            to={`/leden/${m.id}`}
                            className="font-medium hover:text-brand-red"
                          >
                            {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                          </Link>
                          {m.plaats && (
                            <span className="text-muted-foreground"> · {m.plaats}</span>
                          )}
                          {m.telefoon && (
                            <span className="text-muted-foreground font-mono ml-2">
                              {m.telefoon}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WhatsAppMatcher;
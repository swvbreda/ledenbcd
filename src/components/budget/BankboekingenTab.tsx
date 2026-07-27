import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Filter, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useBudgetCategories } from "@/hooks/useBudget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface PontoTx {
  id: string;
  account_id: string;
  transaction_id: string;
  executed_at: string | null;
  amount: number;
  currency: string | null;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  description: string | null;
  remittance_info: string | null;
  dossier: string | null;
  budget_line_item_id: string | null;
  matched_manually: boolean;
  matched_rule_id: string | null;
  match_strategy: string | null;
}

interface Rule {
  id: string;
  pattern: string;
  match_field: string;
  budget_line_item_id: string | null;
  dossier: string | null;
  priority: number;
}

export default function BankboekingenTab({ year }: { year: number }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unmatched" | "matched">("all");
  const [syncing, setSyncing] = useState(false);
  const [newDossierFor, setNewDossierFor] = useState<string | null>(null);
  const [newDossierValue, setNewDossierValue] = useState("");
  const [openTx, setOpenTx] = useState<PontoTx | null>(null);

  const { data: categories } = useBudgetCategories(year);
  const allLineItems = useMemo(
    () => (categories || []).flatMap((c) =>
      c.line_items.map((li) => ({ id: li.id, label: `${c.name} · ${li.name}` }))
    ),
    [categories],
  );
  const lineItemLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const li of allLineItems) m.set(li.id, li.label);
    return m;
  }, [allLineItems]);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const { data: txs, isLoading } = useQuery({
    queryKey: ["ponto_transactions", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_transactions")
        .select("*")
        .gte("executed_at", yearStart)
        .lt("executed_at", yearEnd)
        .order("executed_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PontoTx[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["ponto_matching_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_matching_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const { data: dossierList } = useQuery({
    queryKey: ["dossiers_all"],
    queryFn: async () => {
      const [{ data: expRows }, { data: pontoRows }, { data: bankRows }] = await Promise.all([
        supabase.from("budget_expenses").select("dossier").not("dossier", "is", null),
        supabase.from("ponto_transactions").select("dossier").not("dossier", "is", null),
        supabase.from("bank_transactions").select("dossier").not("dossier", "is", null),
      ]);
      const set = new Set<string>();
      for (const r of [...(expRows ?? []), ...(pontoRows ?? []), ...(bankRows ?? [])]) {
        const v = ((r as any).dossier || "").trim();
        if (!v) continue;
        // Filter contributie-koppelingen per lid: dat zijn geen dossiers
        if (/^contributie\b/i.test(v)) continue;
        set.add(v);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "nl"));
    },
  });

  const { data: memberNames } = useQuery({
    queryKey: ["members_name_index"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members_data")
        .select("id, data");
      if (error) throw error;
      const map = new Map<number, string>();
      for (const m of data ?? []) {
        const d: any = (m as any).data || {};
        map.set(Number((m as any).id), d.naam || d.bedrijfsnaam || `Lid #${(m as any).id}`);
      }
      return map;
    },
  });

  const strategyLabel: Record<string, string> = {
    invoice: "factuurnummer",
    member_ref: "lidnummer",
    iban: "IBAN",
    name: "naam",
  };
  const strategyColor: Record<string, string> = {
    invoice: "bg-green-100 text-green-800 border-green-200",
    member_ref: "bg-blue-100 text-blue-800 border-blue-200",
    iban: "bg-purple-100 text-purple-800 border-purple-200",
    name: "bg-amber-100 text-amber-800 border-amber-200",
  };

  const parseContribDossier = (d: string | null) => {
    if (!d) return null;
    const m = d.match(/^Contributie\s*#(\d+)(?:\s*\(([^)]+)\))?/i);
    if (!m) return null;
    return { memberId: Number(m[1]), invoice: m[2] || null };
  };

  const contribMatches = useMemo(() => {
    return (txs ?? [])
      .map((t) => ({ tx: t, meta: parseContribDossier(t.dossier) }))
      .filter((r) => r.meta !== null)
      .sort((a, b) => (b.tx.executed_at || "").localeCompare(a.tx.executed_at || ""));
  }, [txs]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (txs ?? []).filter((t) => {
      const handled = !!t.budget_line_item_id || isExcludedDossier(t.dossier);
      if (statusFilter === "matched" && !handled) return false;
      if (statusFilter === "unmatched" && handled) return false;
      if (!q) return true;
      return [t.counterparty_name, t.description, t.remittance_info, t.dossier]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [txs, filter, statusFilter]);

  const totals = useMemo(() => {
    let inc = 0, out = 0;
    for (const t of filtered) {
      if (Number(t.amount) >= 0) inc += Number(t.amount);
      else out += Math.abs(Number(t.amount));
    }
    return { inc, out, net: inc - out };
  }, [filtered]);

  const unlinked = useMemo(() => {
    let inc = 0, out = 0, incN = 0, outN = 0;
    for (const t of (txs ?? [])) {
      if (t.budget_line_item_id || isExcludedDossier(t.dossier)) continue;
      const a = Number(t.amount);
      if (a >= 0) { inc += a; incN++; } else { out += Math.abs(a); outN++; }
    }
    return { inc, out, incN, outN, total: incN + outN };
  }, [txs]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeWithAuth<{ success: boolean; transactions_processed: number; rule_matches: number; contribution_matches?: number; error?: string }>(
        "ponto-sync?action=all", { method: "POST" },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "onbekende fout");
      const parts = [
        `${data.transactions_processed} boekingen opgehaald`,
        `${data.rule_matches} regel-matches`,
      ];
      if (data.contribution_matches != null) parts.push(`${data.contribution_matches} contributies`);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["ponto_transactions"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["ponto_bank_balances"] });
    } catch (e) {
      toast.error(`Sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const updateTx = async (id: string, patch: Partial<PontoTx>) => {
    const { error } = await supabase.from("ponto_transactions").update({
      ...patch,
      matched_manually: true,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ponto_transactions"] });
  };

  const createRule = async (tx: PontoTx, lineItemId: string) => {
    const pattern = (tx.counterparty_name || tx.description || "").trim();
    if (!pattern || !lineItemId) return;
    const { error } = await supabase.from("ponto_matching_rules").insert({
      pattern, match_field: "counterparty", budget_line_item_id: lineItemId, dossier: tx.dossier,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Regel opgeslagen: "${pattern}" → ${lineItemLabel.get(lineItemId)}`);
    qc.invalidateQueries({ queryKey: ["ponto_matching_rules"] });
  };

  return (
    <div className="mt-4 space-y-3">
      {unlinked.total > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-amber-900">
            {unlinked.total} bankboekingen zonder begrotingspost
          </span>
          <span className="text-amber-800">
            Uit: <CurrencyText value={unlinked.out} /> ({unlinked.outN})
          </span>
          <span className="text-amber-800">
            In: <CurrencyText value={unlinked.inc} /> ({unlinked.incN})
          </span>
          <button
            className="ml-auto text-amber-900 underline hover:no-underline"
            onClick={() => setStatusFilter("unmatched")}
          >
            Toon alleen niet-gekoppelde →
          </button>
        </div>
      )}
      <div className="border border-border rounded-lg p-3 bg-card flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-muted-foreground" />
        <Input
          placeholder="Filter op tegenpartij, omschrijving of dossier…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 flex-1 min-w-[220px]"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="unmatched">Nog te categoriseren</SelectItem>
            <SelectItem value="matched">Gekoppeld</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto flex gap-4 tabular-nums">
          <span>In: <CurrencyText value={totals.inc} /></span>
          <span>Uit: <CurrencyText value={totals.out} /></span>
          <span>Netto: <CurrencyText value={totals.net} /></span>
        </div>
        <Button size="sm" onClick={runSync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Ophalen…" : "Bank ophalen"}
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Geen boekingen.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Tegenpartij / omschrijving</th>
                <th className="px-3 py-2 font-medium text-right">Bedrag</th>
                <th className="px-3 py-2 font-medium">Begrotingspost</th>
                <th className="px-3 py-2 font-medium">Dossier</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {t.executed_at ? new Date(t.executed_at).toLocaleDateString("nl-NL") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.counterparty_name || "—"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {t.description || t.remittance_info || ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className={Number(t.amount) < 0 ? "text-destructive" : "text-green-600"}>
                      <CurrencyText value={Number(t.amount)} />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-border rounded px-2 py-1 text-xs bg-background w-full max-w-[220px]"
                      value={t.budget_line_item_id ?? ""}
                      onChange={(e) => updateTx(t.id, { budget_line_item_id: e.target.value || null })}
                    >
                      <option value="">— niet gekoppeld —</option>
                      {allLineItems.map((li) => (
                        <option key={li.id} value={li.id}>{li.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {newDossierFor === t.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={newDossierValue}
                          onChange={(e) => setNewDossierValue(e.target.value)}
                          placeholder="Nieuw dossier…"
                          className="h-7 text-xs w-[140px]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = newDossierValue.trim();
                              if (v) {
                                updateTx(t.id, { dossier: v });
                                qc.invalidateQueries({ queryKey: ["dossiers_all"] });
                              }
                              setNewDossierFor(null);
                              setNewDossierValue("");
                            } else if (e.key === "Escape") {
                              setNewDossierFor(null);
                              setNewDossierValue("");
                            }
                          }}
                        />
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => { setNewDossierFor(null); setNewDossierValue(""); }}
                        >×</button>
                      </div>
                    ) : (
                      <select
                        className="border border-border rounded px-2 py-1 text-xs bg-background w-full max-w-[180px]"
                        value={t.dossier ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__new__") {
                            setNewDossierValue("");
                            setNewDossierFor(t.id);
                          } else {
                            updateTx(t.id, { dossier: v || null });
                          }
                        }}
                      >
                        <option value="">— geen dossier —</option>
                        {(dossierList ?? []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        {t.dossier && !(dossierList ?? []).includes(t.dossier) && (
                          <option value={t.dossier}>{t.dossier}</option>
                        )}
                        <option value="__new__">+ nieuw dossier…</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.budget_line_item_id && (t.counterparty_name || t.description) && (
                      <button
                        title="Onthoud deze koppeling voor vergelijkbare boekingen"
                        className="text-xs text-muted-foreground hover:text-brand-red inline-flex items-center gap-1"
                        onClick={() => createRule(t, t.budget_line_item_id!)}
                      >
                        <Wand2 size={12} /> Regel
                      </button>
                    )}
                    <button
                      className="ml-3 text-xs text-muted-foreground hover:text-brand-red underline"
                      onClick={() => setOpenTx(t)}
                    >
                      Openen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contribMatches.length > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contributie-matches ({contribMatches.length})
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Tegenpartij</th>
                <th className="px-3 py-2 font-medium text-right">Bedrag</th>
                <th className="px-3 py-2 font-medium">Lid</th>
                <th className="px-3 py-2 font-medium">Factuur</th>
                <th className="px-3 py-2 font-medium">Strategie</th>
              </tr>
            </thead>
            <tbody>
              {contribMatches.map(({ tx, meta }) => {
                const strat = tx.match_strategy || (tx.matched_manually ? "handmatig" : "onbekend");
                const cls = strategyColor[strat] || "bg-muted text-muted-foreground border-border";
                const label = strategyLabel[strat] || strat;
                return (
                  <tr key={tx.id} className="border-t border-border cursor-pointer hover:bg-muted/40" onClick={() => setOpenTx(tx)}>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                      {tx.executed_at ? new Date(tx.executed_at).toLocaleDateString("nl-NL") : "—"}
                    </td>
                    <td className="px-3 py-1.5">{tx.counterparty_name || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-green-600">
                      <CurrencyText value={Number(tx.amount)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{memberNames?.get(meta!.memberId) || `Lid #${meta!.memberId}`}</div>
                      <div className="text-xs text-muted-foreground">#{meta!.memberId}</div>
                    </td>
                    <td className="px-3 py-1.5 text-xs">{meta!.invoice || "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(rules?.length ?? 0) > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Matchregels ({rules!.length})
          </div>
          <table className="w-full text-sm">
            <tbody>
              {rules!.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{r.pattern}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    → {r.budget_line_item_id ? (lineItemLabel.get(r.budget_line_item_id) || "onbekende post") : "—"}
                    {r.dossier ? ` · ${r.dossier}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await supabase.from("ponto_matching_rules").delete().eq("id", r.id);
                        qc.invalidateQueries({ queryKey: ["ponto_matching_rules"] });
                      }}
                    >verwijder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!openTx} onOpenChange={(o) => !o && setOpenTx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bankboeking</DialogTitle>
          </DialogHeader>
          {openTx && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Datum</span>
                <span className="font-medium">{openTx.executed_at ? new Date(openTx.executed_at).toLocaleDateString("nl-NL") : "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bedrag</span>
                <span className={`font-semibold tabular-nums ${Number(openTx.amount) < 0 ? "text-destructive" : "text-green-600"}`}>
                  <CurrencyText value={Number(openTx.amount)} /> {openTx.currency || "EUR"}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tegenpartij</div>
                <div className="font-medium">{openTx.counterparty_name || "—"}</div>
                {openTx.counterparty_iban && (
                  <div className="text-xs text-muted-foreground tabular-nums">{openTx.counterparty_iban}</div>
                )}
              </div>
              {openTx.description && (
                <div>
                  <div className="text-xs text-muted-foreground">Omschrijving</div>
                  <div className="whitespace-pre-wrap break-words">{openTx.description}</div>
                </div>
              )}
              {openTx.remittance_info && openTx.remittance_info !== openTx.description && (
                <div>
                  <div className="text-xs text-muted-foreground">Mededeling</div>
                  <div className="whitespace-pre-wrap break-words">{openTx.remittance_info}</div>
                </div>
              )}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Begrotingspost</span>
                  <span className="font-medium text-right">
                    {openTx.budget_line_item_id ? (lineItemLabel.get(openTx.budget_line_item_id) || "onbekend") : "— niet gekoppeld —"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Dossier</span>
                  <span className="font-medium text-right">{openTx.dossier || "—"}</span>
                </div>
                {(() => {
                  const meta = parseContribDossier(openTx.dossier);
                  if (!meta) return null;
                  const name = memberNames?.get(meta.memberId) || `Lid #${meta.memberId}`;
                  return (
                    <div className="rounded-md border border-border bg-muted/30 p-2 text-xs space-y-1">
                      <div><span className="text-muted-foreground">Gekoppeld lid: </span><a className="font-medium underline hover:text-brand-red" href={`/leden/${meta.memberId}`}>{name} (#{meta.memberId})</a></div>
                      {meta.invoice && <div><span className="text-muted-foreground">Factuur: </span><span className="font-medium">{meta.invoice}</span></div>}
                    </div>
                  );
                })()}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Matchstrategie</span>
                  <span className="font-medium">
                    {openTx.match_strategy ? (strategyLabel[openTx.match_strategy] || openTx.match_strategy) : (openTx.matched_manually ? "handmatig" : "—")}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground pt-2 border-t border-border tabular-nums">
                ID: {openTx.transaction_id}
              </div>
            </div>
          )}
          <DialogFooter>
            {openTx?.budget_line_item_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await updateTx(openTx.id, { budget_line_item_id: null, dossier: null });
                  setOpenTx(null);
                  toast.success("Koppeling verwijderd");
                }}
              >
                Koppeling verwijderen
              </Button>
            )}
            <Button size="sm" onClick={() => setOpenTx(null)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
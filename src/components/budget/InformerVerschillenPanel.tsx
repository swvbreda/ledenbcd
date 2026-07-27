import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Check, EyeOff, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMembersData } from "@/contexts/MembersDataContext";

const FIELD_LABELS: Record<string, string> = {
  bedrijfsnaam: "Bedrijfsnaam",
  email: "E-mail",
  telefoon: "Telefoon",
  kvk: "KvK",
  adres: "Adres",
  postcode: "Postcode",
  plaats: "Plaats",
};

interface DiffRow {
  id: string;
  member_id: number;
  field: string;
  local_value: string | null;
  informer_value: string | null;
  status: string;
}

export default function InformerVerschillenPanel() {
  const qc = useQueryClient();
  const { allMembersAndLeads, refetch: refetchMembers } = useMembersData();
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: diffs, isFetching, refetch } = useQuery({
    queryKey: ["informer_field_diffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informer_field_diffs")
        .select("id, member_id, field, local_value, informer_value, status")
        .order("member_id");
      if (error) throw error;
      return (data ?? []) as DiffRow[];
    },
  });

  const { data: memberEdits } = useQuery({
    queryKey: ["member_edits_for_diffs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_edits").select("member_id, data");
      if (error) throw error;
      const map = new Map<number, Record<string, unknown>>();
      for (const row of data ?? []) map.set(Number(row.member_id), (row.data ?? {}) as Record<string, unknown>);
      return map;
    },
  });

  const { data: mapping } = useQuery({
    queryKey: ["informer_debtor_map_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("informer_debtor_map").select("member_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => Number(r.member_id)));
    },
  });

  const memberName = (id: number) => {
    const m = allMembersAndLeads.find((x) => x.id === id);
    return m ? (m.bedrijfsnaam || m.naam || `Lid #${id}`) : `Lid #${id}`;
  };

  const unlinked = useMemo(() => {
    if (!mapping) return [];
    return allMembersAndLeads.filter((m) => !mapping.has(m.id));
  }, [allMembersAndLeads, mapping]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (diffs ?? []).filter((d) => {
      if (!showIgnored && d.status !== "open") return false;
      if (fieldFilter && d.field !== fieldFilter) return false;
      if (!q) return true;
      return memberName(d.member_id).toLowerCase().includes(q) || String(d.member_id).includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffs, search, fieldFilter, showIgnored, allMembersAndLeads]);

  const grouped = useMemo(() => {
    const map = new Map<number, DiffRow[]>();
    for (const d of visible) {
      const list = map.get(d.member_id) ?? [];
      list.push(d);
      map.set(d.member_id, list);
    }
    return [...map.entries()].sort((a, b) => memberName(a[0]).localeCompare(memberName(b[0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, allMembersAndLeads]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["informer_field_diffs"] });
    refetchMembers();
  };

  // Fetch-and-merge: alleen het gekozen veld wordt aangepast.
  const adopt = async (rows: DiffRow[]) => {
    const memberId = rows[0].member_id;
    setBusy(rows.map((r) => r.id).join(","));
    try {
      const { data: existing, error } = await supabase
        .from("members_data").select("data").eq("id", memberId).maybeSingle();
      if (error) throw error;
      const merged: Record<string, unknown> = { ...((existing?.data ?? {}) as Record<string, unknown>) };
      for (const r of rows) merged[r.field] = r.informer_value ?? "";
      const { error: upErr } = await supabase
        .from("members_data")
        .update({ data: merged as never })
        .eq("id", memberId);
      if (upErr) throw upErr;
      const { error: delErr } = await supabase
        .from("informer_field_diffs").delete().in("id", rows.map((r) => r.id));
      if (delErr) throw delErr;
      toast.success(rows.length === 1 ? "Informer-waarde overgenomen" : `${rows.length} waarden overgenomen`);
      invalidate();
    } catch (e) {
      toast.error(`Overnemen mislukt: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const ignore = async (row: DiffRow) => {
    setBusy(row.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("informer_field_diffs")
        .update({ status: "ignored", resolved_by: userData?.user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      invalidate();
    } catch (e) {
      toast.error(`Negeren mislukt: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const reopen = async (row: DiffRow) => {
    setBusy(row.id);
    try {
      const { error } = await supabase
        .from("informer_field_diffs")
        .update({ status: "open", resolved_by: null, resolved_at: null })
        .eq("id", row.id);
      if (error) throw error;
      invalidate();
    } finally {
      setBusy(null);
    }
  };

  const fieldsPresent = useMemo(
    () => [...new Set((diffs ?? []).map((d) => d.field))].sort(),
    [diffs],
  );

  return (
    <div className="space-y-4">
      {unlinked.length > 0 && (
        <div className="border border-border rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Unlink size={16} className="text-brand-red" />
            <h4 className="text-sm font-semibold">Leden zonder Informer-debiteur ({unlinked.length})</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Afwijkende gegevens komen vaak door een ontbrekende of verkeerde koppeling. Koppel deze leden via “Debiteuren koppelen”.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlinked.slice(0, 40).map((m) => (
              <span key={m.id} className="text-xs border border-border rounded px-2 py-0.5">
                #{m.id} · {m.bedrijfsnaam || m.naam}
              </span>
            ))}
            {unlinked.length > 40 && (
              <span className="text-xs text-muted-foreground">+{unlinked.length - 40} meer</span>
            )}
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-brand-red" />
            <h4 className="text-sm font-semibold">
              Verschillen met Informer ({(diffs ?? []).filter((d) => d.status === "open").length})
            </h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="border border-border rounded px-2 py-1 text-sm bg-background"
              placeholder="Zoek lid…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border border-border rounded px-2 py-1 text-sm bg-background"
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
            >
              <option value="">Alle velden</option>
              {fieldsPresent.map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} />
              Toon genegeerde
            </label>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Vernieuwen
            </Button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Geen verschillen. Het ledenbestand is leidend — Informer vult alleen lege velden aan.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([memberId, rows]) => (
              <div key={memberId} className="p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-sm font-medium">#{memberId} · {memberName(memberId)}</div>
                  {rows.filter((r) => r.status === "open").length > 1 && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => adopt(rows.filter((r) => r.status === "open"))}
                      disabled={busy !== null}
                    >
                      Alles overnemen
                    </Button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 font-medium w-32">Veld</th>
                      <th className="py-1 font-medium">Ledenbestand</th>
                      <th className="py-1 font-medium">Informer</th>
                      <th className="py-1 font-medium">Door lid ingediend</th>
                      <th className="py-1 font-medium w-48"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const submitted = memberEdits?.get(r.member_id)?.[r.field];
                      return (
                        <tr key={r.id} className="border-t border-border/60 align-top">
                          <td className="py-1.5 text-xs text-muted-foreground">{FIELD_LABELS[r.field] ?? r.field}</td>
                          <td className="py-1.5 pr-2">{r.local_value || "—"}</td>
                          <td className="py-1.5 pr-2">{r.informer_value || "—"}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">
                            {submitted ? String(submitted) : "—"}
                          </td>
                          <td className="py-1.5">
                            <div className="flex gap-1.5 justify-end">
                              {r.status === "open" ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => adopt([r])} disabled={busy !== null}>
                                    <Check size={13} /> Overnemen
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => ignore(r)} disabled={busy !== null}>
                                    <EyeOff size={13} /> Negeren
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => reopen(r)} disabled={busy !== null}>
                                  Terugzetten
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

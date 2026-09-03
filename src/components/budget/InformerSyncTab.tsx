import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useMembersData } from "@/contexts/MembersDataContext";

interface SyncLog {
  id: string;
  run_at: string;
  action: string;
  success: boolean;
  items_processed: number;
  error_message: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  pull_debtors: "Debiteuren ← Informer",
  pull_invoices: "Facturen ← Informer",
  pull_creditors: "Crediteuren ← Informer",
  pull_bank_balances: "Banksaldi ← Informer",
  pull_ponto_balances: "Banksaldi (live)",
  pull_ponto_transactions: "Bankboekingen (live)",
  all: "Volledige sync",
};

interface InformerDebtor {
  id: string;
  name: string;
  email: string | null;
  kvk: string | null;
  city: string | null;
}

export default function InformerSyncTab() {
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    authenticated?: boolean;
    administration?: { id?: string; name?: string; source?: string } | null;
    security_code_preview?: string | null;
    is_override?: boolean;
    error?: string;
    note?: string;
  } | null>(null);

  const runVerify = async (codeOverride?: string) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const qs = codeOverride ? `?action=whoami&code=${encodeURIComponent(codeOverride)}` : "?action=whoami";
      const { data, error } = await invokeWithAuth<any>(`informer-sync${qs}`, { method: "POST" });
      if (error) throw new Error(error.message);
      setVerifyResult(data);
      if (data?.authenticated && data?.administration?.name) {
        toast.success(`Actieve administratie: ${data.administration.name}`);
      } else if (data?.authenticated) {
        toast.success("Authenticatie geslaagd");
      } else {
        toast.error(data?.error ?? "Authenticatie mislukt");
      }
    } catch (e) {
      toast.error(`Controle mislukt: ${(e as Error).message}`);
    } finally {
      setVerifying(false);
    }
  };

  const { data: logs } = useQuery({
    queryKey: ["informer_sync_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informer_sync_log")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SyncLog[];
    },
    refetchInterval: syncing ? 2000 : false,
  });

  const { data: state } = useQuery({
    queryKey: ["informer_sync_state"],
    queryFn: async () => {
      const { data } = await supabase.from("informer_sync_state").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeWithAuth("informer-sync", { method: "POST" });
      if (error) throw new Error(error.message);
      const results = (data as any)?.results ?? [];
      const total = results.reduce((s: number, r: any) => s + (r.items_processed || 0), 0);
      const failed = results.filter((r: any) => !r.success);
      if (failed.length === 0) {
        toast.success(`Sync voltooid — ${total} item${total === 1 ? "" : "s"} verwerkt`);
      } else {
        toast.error(`Sync deels mislukt: ${failed.map((r: any) => r.action).join(", ")}`);
      }
      qc.invalidateQueries({ queryKey: ["informer_sync_log"] });
      qc.invalidateQueries({ queryKey: ["informer_sync_state"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["informer_bank_balances"] });
    } catch (e) {
      toast.error(`Sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const runBankSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeWithAuth("informer-sync?action=pull_bank_balances", { method: "POST" });
      if (error) throw new Error(error.message);
      const r = ((data as any)?.results ?? [])[0];
      if (r?.success) toast.success(`Banksaldi opgehaald — ${r.items_processed} rekening${r.items_processed === 1 ? "" : "en"}`);
      else toast.error(`Bank-sync mislukt: ${r?.error_message ?? "onbekende fout"}`);
      qc.invalidateQueries({ queryKey: ["informer_sync_log"] });
      qc.invalidateQueries({ queryKey: ["informer_sync_state"] });
      qc.invalidateQueries({ queryKey: ["informer_bank_balances"] });
    } catch (e) {
      toast.error(`Bank-sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const runPontoSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeWithAuth<{ success: boolean; items_processed: number; error?: string }>(
        "ponto-sync", { method: "POST" },
      );
      if (error) throw new Error(error.message);
      if (data?.success) {
        toast.success(`Live banksaldi opgehaald — ${data.items_processed} rekening${data.items_processed === 1 ? "" : "en"}`);
      } else {
        toast.error(`Live bank-sync mislukt: ${data?.error ?? "onbekende fout"}`);
      }
      qc.invalidateQueries({ queryKey: ["informer_sync_log"] });
      qc.invalidateQueries({ queryKey: ["informer_sync_state"] });
      qc.invalidateQueries({ queryKey: ["ponto_bank_balances"] });
    } catch (e) {
      toast.error(`Live bank-sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const openLinker = () => setLinkOpen(true);

  const STALE_MS = 48 * 60 * 60 * 1000;
  const staleSources = useMemo(() => {
    const s = state as any;
    const checks: { label: string; at: string | null }[] = [
      { label: "Live banksaldi", at: s?.last_ponto_sync_at ?? null },
      { label: "Bankboekingen", at: s?.last_ponto_tx_sync_at ?? null },
      { label: "Informer debiteuren", at: s?.last_debtor_sync_at ?? null },
      { label: "Informer facturen", at: s?.last_payment_sync_at ?? null },
    ];
    return checks.filter((c) => !c.at || Date.now() - new Date(c.at).getTime() > STALE_MS);
  }, [state]);

  const lastFailure = useMemo(
    () => (logs ?? []).find((l) => !l.success) ?? null,
    [logs],
  );

  return (
    <div className="mt-4 space-y-4">
      {(staleSources.length > 0 || lastFailure) && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium text-amber-900">
            <AlertCircle size={14} /> Synchronisatie-aandachtspunten
          </div>
          {staleSources.length > 0 && (
            <div className="text-amber-900/90 text-xs">
              Langer dan 48 uur niet bijgewerkt: {staleSources.map((s) => s.label).join(", ")}.
              De automatische sync draait dagelijks; klik hiernaast op “Synchroniseer nu” om direct bij te werken.
            </div>
          )}
          {lastFailure && (
            <div className="text-amber-900/90 text-xs">
              Laatste fout ({ACTION_LABELS[lastFailure.action] ?? lastFailure.action},{" "}
              {formatDistanceToNow(new Date(lastFailure.run_at), { addSuffix: true, locale: nl })}):{" "}
              {lastFailure.error_message ?? "onbekend"}
            </div>
          )}
        </div>
      )}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold mb-1">Informer-koppeling</h3>
            <p className="text-sm text-muted-foreground">
              Haalt debiteuren, factuurstatus en crediteuren uit Informer. Het ledenbestand is leidend; nieuwe debiteuren in Informer worden niet automatisch aangemaakt.
            </p>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>
                Laatste debiteur-sync:{" "}
                {(state as any)?.last_debtor_sync_at
                  ? formatDistanceToNow(new Date((state as any).last_debtor_sync_at), { addSuffix: true, locale: nl })
                  : "nog niet gedraaid"}
              </div>
              <div>
                Laatste factuur-sync:{" "}
                {state?.last_payment_sync_at
                  ? formatDistanceToNow(new Date(state.last_payment_sync_at), { addSuffix: true, locale: nl })
                  : "nog niet gedraaid"}
              </div>
              <div>
                Laatste crediteur-sync:{" "}
                {state?.last_creditor_sync_at
                  ? formatDistanceToNow(new Date(state.last_creditor_sync_at), { addSuffix: true, locale: nl })
                  : "nog niet gedraaid"}
              </div>
              <div>
                Laatste bank-sync:{" "}
                {(state as any)?.last_bank_sync_at
                  ? formatDistanceToNow(new Date((state as any).last_bank_sync_at), { addSuffix: true, locale: nl })
                  : "nog niet gedraaid"}
              </div>
              <div>
                Laatste live bank-sync:{" "}
                {(state as any)?.last_ponto_sync_at
                  ? formatDistanceToNow(new Date((state as any).last_ponto_sync_at), { addSuffix: true, locale: nl })
                  : "nog niet gedraaid"}
              </div>
              <div className="pt-1 text-[11px]">
                Automatisch: bank 06:00 en 18:00, Informer 04:30 (dagelijks).
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => { setVerifyOpen(true); setVerifyResult(null); setVerifyCode(""); runVerify(); }}
            >
              <ShieldCheck size={14} /> Administratie controleren
            </Button>
            <Button variant="outline" onClick={openLinker}>
              <Link2 size={14} /> Debiteuren koppelen
            </Button>
            <Button variant="outline" onClick={runBankSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Banksaldi
            </Button>
            <Button variant="outline" onClick={runPontoSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Live saldi
            </Button>
            <Button onClick={runSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Bezig…" : "Synchroniseer nu"}
            </Button>
          </div>
        </div>
      </div>

      <DebtorLinkDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={() => qc.invalidateQueries({ queryKey: ["informer_sync_log"] })} />

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Informer-administratie controleren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              Controleert bij Informer welke administratie hoort bij de opgeslagen security code.
              Wil je een andere ID testen? Plak hem hieronder — er wordt niets opgeslagen tot je bevestigt.
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-border rounded-sm px-3 py-1.5 text-sm bg-background font-mono"
                placeholder="Optioneel: nieuwe INFORMER_ADMINISTRATION_ID"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
              />
              <Button variant="outline" onClick={() => runVerify(verifyCode.trim() || undefined)} disabled={verifying}>
                <RefreshCw size={14} className={verifying ? "animate-spin" : ""} /> Controleren
              </Button>
            </div>
            {verifyResult && (
              <div className={`border rounded-lg p-3 text-sm ${verifyResult.authenticated ? "border-green-600/40 bg-green-50 dark:bg-green-950/20" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-center gap-2 font-medium mb-1">
                  {verifyResult.authenticated ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-destructive" />}
                  {verifyResult.authenticated ? "Authenticatie geslaagd" : "Authenticatie mislukt"}
                </div>
                {verifyResult.administration?.name && (
                  <div className="mt-1"><span className="text-muted-foreground">Administratie:</span> <strong>{verifyResult.administration.name}</strong></div>
                )}
                {verifyResult.administration?.id && (
                  <div><span className="text-muted-foreground">ID:</span> <code className="text-xs">{verifyResult.administration.id}</code></div>
                )}
                {verifyResult.security_code_preview && (
                  <div className="text-xs text-muted-foreground mt-1">Security code: {verifyResult.security_code_preview}{verifyResult.is_override ? " (testwaarde)" : " (opgeslagen)"}</div>
                )}
                {verifyResult.note && <div className="text-xs text-muted-foreground mt-1">{verifyResult.note}</div>}
                {verifyResult.error && <div className="text-destructive text-xs mt-1">{verifyResult.error}</div>}
                {verifyResult.is_override && verifyResult.authenticated && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Als dit de juiste administratie is, laat dit weten dan werk ik het secret <code>INFORMER_ADMINISTRATION_ID</code> bij.
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <h4 className="text-sm font-semibold">Recente sync-activiteit</h4>
        </div>
        {(logs ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nog geen sync uitgevoerd.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actie</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Wanneer</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs!.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {l.success ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <AlertCircle size={16} className="text-destructive" />
                    )}
                  </td>
                  <td className="px-3 py-2">{ACTION_LABELS[l.action] ?? l.action}</td>
                  <td className="px-3 py-2 tabular-nums">{l.items_processed}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(l.run_at), { addSuffix: true, locale: nl })}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate" title={l.error_message ?? ""}>
                    {l.error_message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DebtorLinkDialog({
  open, onOpenChange, onLinked,
}: { open: boolean; onOpenChange: (o: boolean) => void; onLinked: () => void }) {
  const { allMembersAndLeads } = useMembersData();
  const [loading, setLoading] = useState(false);
  const [debtors, setDebtors] = useState<InformerDebtor[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");

  const memberOptions = useMemo(
    () => [...allMembersAndLeads].sort((a, b) => (a.bedrijfsnaam || a.naam || "").localeCompare(b.bedrijfsnaam || b.naam || "")),
    [allMembersAndLeads],
  );

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth<{ debtors: InformerDebtor[]; mapping: { member_id: number; informer_debtor_id: string }[] }>(
        "informer-sync?action=list_debtors", { method: "POST" },
      );
      if (error) throw new Error(error.message);
      setDebtors(data?.debtors ?? []);
      const m: Record<string, number> = {};
      for (const row of data?.mapping ?? []) m[row.informer_debtor_id] = row.member_id;
      setMapping(m);
    } catch (e) {
      toast.error(`Kan debiteuren niet laden: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setLink = async (debtorId: string, memberIdRaw: string) => {
    const prev = mapping[debtorId];
    if (!memberIdRaw) {
      const { error } = await supabase.from("informer_debtor_map").delete().eq("informer_debtor_id", debtorId);
      if (error) { toast.error(error.message); return; }
      const next = { ...mapping }; delete next[debtorId]; setMapping(next);
      onLinked();
      return;
    }
    const memberId = Number(memberIdRaw);
    const { error } = await supabase.from("informer_debtor_map").upsert(
      { member_id: memberId, informer_debtor_id: debtorId, matched_by: "manual" },
      { onConflict: "member_id" },
    );
    if (error) { toast.error(error.message); return; }
    setMapping({ ...mapping, [debtorId]: memberId });
    onLinked();
    if (prev !== memberId) toast.success("Gekoppeld");
  };

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return debtors;
    return debtors.filter((d) =>
      (d.name || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.kvk || "").toLowerCase().includes(q) ||
      (d.city || "").toLowerCase().includes(q),
    );
  }, [debtors, filter]);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) load(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Informer-debiteuren koppelen aan leden</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 py-2">
          <input
            className="flex-1 border border-border rounded-sm px-3 py-1.5 text-sm bg-background"
            placeholder="Zoek op naam, e-mail, KvK of plaats…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Vernieuwen
          </Button>
        </div>
        <div className="overflow-auto flex-1 border border-border rounded-lg">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Laden…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Geen debiteuren.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Informer-debiteur</th>
                  <th className="px-3 py-2 font-medium">KvK</th>
                  <th className="px-3 py-2 font-medium">Plaats</th>
                  <th className="px-3 py-2 font-medium">Gekoppeld aan lid</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{d.name || "—"}</div>
                      {d.email && <div className="text-xs text-muted-foreground">{d.email}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{d.kvk ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{d.city ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        className="border border-border rounded-sm px-2 py-1 text-sm bg-background w-full max-w-xs"
                        value={mapping[d.id] ?? ""}
                        onChange={(e) => setLink(d.id, e.target.value)}
                      >
                        <option value="">— niet gekoppeld —</option>
                        {memberOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            #{m.id} · {m.bedrijfsnaam || m.naam}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
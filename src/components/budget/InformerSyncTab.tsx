import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
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
    } catch (e) {
      toast.error(`Sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const openLinker = () => setLinkOpen(true);

  return (
    <div className="mt-4 space-y-4">
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
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={openLinker}>
              <Link2 size={14} /> Debiteuren koppelen
            </Button>
            <Button onClick={runSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Bezig…" : "Synchroniseer nu"}
            </Button>
          </div>
        </div>
      </div>

      <DebtorLinkDialog open={linkOpen} onOpenChange={setLinkOpen} onLinked={() => qc.invalidateQueries({ queryKey: ["informer_sync_log"] })} />

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

  const setLink = async (debtorId: string, memberIdRaw: string) => {
    const prev = mapping[debtorId];
    if (!memberIdRaw) {
      const { error } = await supabase.from("informer_debtor_map").delete().eq("informer_debtor_id", debtorId);
      if (error) return toast.error(error.message);
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
            className="flex-1 border border-border rounded px-3 py-1.5 text-sm bg-background"
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
                        className="border border-border rounded px-2 py-1 text-sm bg-background w-full max-w-xs"
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
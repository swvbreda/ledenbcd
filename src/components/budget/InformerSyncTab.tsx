import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

interface SyncLog {
  id: string;
  run_at: string;
  action: string;
  success: boolean;
  items_processed: number;
  error_message: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  push_invoices: "Facturen → Informer",
  pull_payments: "Betaalstatus ← Informer",
  pull_creditors: "Crediteuren ← Informer",
  all: "Volledige sync",
};

export default function InformerSyncTab() {
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();

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

  return (
    <div className="mt-4 space-y-4">
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold mb-1">Informer-koppeling</h3>
            <p className="text-sm text-muted-foreground">
              Synchroniseert elk uur automatisch. Push contributiefacturen, haal betaalstatus en crediteuren op.
            </p>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>
                Laatste betaalstatus-sync:{" "}
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
          <Button onClick={runSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Bezig…" : "Synchroniseer nu"}
          </Button>
        </div>
      </div>

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
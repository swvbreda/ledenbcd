import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Link2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface SyncState {
  last_push_at: string | null;
  last_push_count: number;
  last_pull_at: string | null;
  last_pull_count: number;
  last_status: string | null;
  last_error: string | null;
}

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" }) : "nog niet";

export default function BeleidsmonitorSyncPanel({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();

  const { data: state } = useQuery({
    queryKey: ["beleidsmonitor-sync-state"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beleidsmonitor_sync_state" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SyncState) ?? null;
    },
  });

  const { data: dossierCount = 0 } = useQuery({
    queryKey: ["beleidsmonitor-dossier-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("beleidsmonitor_dossiers" as any)
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const runSync = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("trigger_beleidsmonitor_sync" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Synchronisatie met de Beleidsmonitor gestart");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["beleidsmonitor-sync-state"] });
        qc.invalidateQueries({ queryKey: ["beleidsmonitor-dossier-count"] });
      }, 6000);
    },
    onError: (e: any) => toast.error("Starten mislukt: " + e.message),
  });

  if (!isAdmin) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Link2 size={14} /> Koppeling Beleidsmonitor
          </h3>
          <p className="text-xs text-muted-foreground">
            Ledenlijst wordt dagelijks verstuurd; verrijkte dossiers worden teruggehaald.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" disabled={runSync.isPending} onClick={() => runSync.mutate()}>
          <RefreshCw size={14} className={runSync.isPending ? "animate-spin" : ""} />
          Nu synchroniseren
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Laatst verstuurd</p>
          <p className="font-medium">{fmt(state?.last_push_at ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Verstuurde leden</p>
          <p className="font-medium tabular-nums">{state?.last_push_count ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Laatst opgehaald</p>
          <p className="font-medium">{fmt(state?.last_pull_at ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dossiers</p>
          <p className="font-medium tabular-nums">{dossierCount}</p>
        </div>
      </div>

      {state?.last_status === "error" && state.last_error && (
        <p className="text-xs text-destructive flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {state.last_error}
        </p>
      )}
    </Card>
  );
}

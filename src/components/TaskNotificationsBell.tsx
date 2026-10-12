import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { taskRoute } from "@/lib/taskPush";

type Row = { id: string; task_id: string; title: string; body: string; read_at: string | null; created_at: string };
const db = supabase as any;

/** Persistente taakmeldingen; alleen zichtbaar voor beheerders, alleen eigen meldingen (RLS). */
export default function TaskNotificationsBell() {
  const { user, isAdmin } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["task-notifications", uid],
    enabled: !!uid && isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("task_notifications")
        .select("id,task_id,title,body,read_at,created_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as Row[];
    },
  });
  if (!uid || !isAdmin) return null;
  const rows = q.data ?? [];
  const unread = rows.filter((r) => !r.read_at);

  const open = async (r: Row) => {
    if (!r.read_at) {
      await db.rpc("mark_task_notifications_read", { _ids: [r.id] });
      qc.invalidateQueries({ queryKey: ["task-notifications", uid] });
    }
    navigate(taskRoute(r.task_id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative ml-auto" aria-label={unread.length ? `${unread.length} nieuwe taakmeldingen` : "Taakmeldingen"}>
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border font-medium">Taakmeldingen</div>
        {q.isError ? (
          <p className="p-4 text-sm text-destructive">Meldingen konden niet worden geladen.</p>
        ) : q.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Laden…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Geen meldingen.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => void open(r)} className="w-full text-left px-4 py-3 hover:bg-muted">
                  <p className={`text-sm ${r.read_at ? "text-muted-foreground" : "font-semibold"}`}>{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.body} · {new Date(r.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

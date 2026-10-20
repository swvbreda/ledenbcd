import { useState } from "react";
import { ArrowLeft, HelpCircle, MessageCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useAdminThreads } from "@/hooks/useSupport";
import SupportThreadView, { SupportStatusBadge } from "./SupportThreadView";

/** Admin-only list of member questions (app + verified WhatsApp). */
export default function SupportAdminInbox() {
  const { user, isAdmin } = useAuth();
  const { data, isLoading, error } = useAdminThreads(user?.id, isAdmin);
  const [selected, setSelected] = useState<string | null>(null);
  const current = data?.find((t) => t.id === selected) ?? null;
  if (!isAdmin) return null;

  if (current) {
    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
          <Button variant="ghost" size="sm" className="px-2" aria-label="Terug" onClick={() => setSelected(null)}><ArrowLeft size={16} /></Button>
          <div className="min-w-0">
            <CardTitle className="text-base break-words">{current.subject}</CardTitle>
            <p className="text-xs text-muted-foreground">Geverifieerd lid: {current.member_name ?? "onbekend"} (lidnr. {current.member_id})</p>
          </div>
        </CardHeader>
        <CardContent><SupportThreadView thread={current} mode="admin" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><HelpCircle size={16} className="text-brand-red" /> Ledenvragen</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Laden...</p>}
        {error && <p className="px-4 py-6 text-sm text-destructive">Vragen konden niet worden geladen.</p>}
        {!isLoading && !error && !data?.length && <p className="px-4 py-6 text-sm text-muted-foreground">Nog geen vragen van leden.</p>}
        <ul className="divide-y divide-border">
          {data?.map((t) => (
            <li key={t.id}>
              <button onClick={() => setSelected(t.id)} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${t.admin_unread ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.admin_unread && <span className="h-2 w-2 rounded-full bg-destructive" aria-label="Ongelezen" />}
                    <SupportStatusBadge status={t.status} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                  {t.channel === "whatsapp" ? <Smartphone size={11} /> : <MessageCircle size={11} />}
                  {t.channel === "whatsapp" ? "WhatsApp" : "App"} · {t.member_name ?? "Lid"} (lidnr. {t.member_id}) ·{" "}
                  {new Date(t.last_activity_at).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Send, AlertCircle, Clock, CheckCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useWhatsAppConversations,
  useWhatsAppMessages,
  useSendWhatsApp,
  useMarkConversationRead,
  useWhatsAppTemplates,
  type WAConversation,
} from "@/hooks/useWhatsApp";
import { useMembersData } from "@/contexts/MembersDataContext";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" });
}

function isWithin24h(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

const WhatsAppInbox = () => {
  const { data: conversations = [], isLoading } = useWhatsAppConversations();
  const { data: templates = [] } = useWhatsAppTemplates();
  const { rawMembers, rawLeads, rawOldMembers } = useMembersData();
  const memberById = useMemo(() => {
    const map = new Map<number, { naam?: string; bedrijfsnaam?: string; plaats?: string }>();
    [...rawMembers, ...rawLeads, ...rawOldMembers].forEach((m) => map.set(m.id, m));
    return map;
  }, [rawMembers, rawLeads, rawOldMembers]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const { data: messages = [] } = useWhatsAppMessages(active?.phone ?? null);
  const send = useSendWhatsApp();
  const markRead = useMarkConversationRead();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && active.unread_count > 0) markRead.mutate(active.id);
    setDraft("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const labelFor = (c: WAConversation): string => {
    if (c.member_id) {
      const m = memberById.get(c.member_id);
      return m?.naam || m?.bedrijfsnaam || c.display_name || c.phone;
    }
    return c.display_name || c.phone;
  };

  const within24 = isWithin24h(active?.last_inbound_at ?? null);
  const approvedTemplates = templates.filter((t) => t.status === "approved");

  const handleSend = () => {
    if (!active || !draft.trim()) return;
    send.mutate({
      phone: active.phone,
      text: draft.trim(),
      member_id: active.member_id,
    });
    setDraft("");
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Laden…</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] border border-border rounded-lg overflow-hidden bg-card min-h-[500px]">
      {/* Conversation list */}
      <aside className="border-r border-border max-h-[600px] overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground flex flex-col items-center text-center gap-2">
            <Inbox size={24} />
            <p>Nog geen WhatsApp-gesprekken.</p>
            <p className="text-xs">Gesprekken verschijnen hier zodra leden het BCD-nummer berichten.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 hover:bg-muted/40 transition",
                    activeId === c.id && "bg-muted/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{labelFor(c)}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.last_message_preview || "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatTime(c.last_message_at)}</span>
                      {c.unread_count > 0 && (
                        <span className="bg-brand-red text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold min-w-[18px] text-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Chat area */}
      <section className="flex flex-col min-h-[500px] max-h-[600px]">
        {!active ? (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <MessageSquare size={28} />
              <p>Selecteer een gesprek.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{labelFor(active)}</p>
                <p className="text-xs text-muted-foreground font-mono">{active.phone}</p>
              </div>
              {active.member_id && (
                <Link
                  to={`/leden/${active.member_id}`}
                  className="text-xs text-brand-red hover:underline shrink-0"
                >
                  Open lid →
                </Link>
              )}
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">Geen berichten in dit gesprek.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    m.direction === "outbound"
                      ? "ml-auto bg-brand-red text-white"
                      : "mr-auto bg-card border border-border",
                  )}
                >
                  {m.template_name && (
                    <p className="text-[10px] uppercase opacity-70 mb-1">Template: {m.template_name}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body || "—"}</p>
                  <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                    {formatTime(m.timestamp)}
                    {m.direction === "outbound" && m.status === "read" && <CheckCheck size={12} />}
                    {m.direction === "outbound" && m.status === "failed" && <AlertCircle size={12} />}
                    {m.direction === "outbound" && m.status === "queued" && <Clock size={12} />}
                  </p>
                </div>
              ))}
            </div>

            <footer className="border-t border-border p-3 space-y-2">
              {!within24 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-900">
                    24-uurs venster verlopen. Vrije tekst kan niet meer; gebruik een goedgekeurde template via het{" "}
                    <strong>Templates</strong>-tabblad.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder={within24 ? "Typ een bericht…" : "Buiten 24u — alleen templates toegestaan"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!within24 || send.isPending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!within24 || !draft.trim() || send.isPending}
                  className="gap-1.5"
                >
                  <Send size={14} />
                  Verstuur
                </Button>
              </div>
              {approvedTemplates.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {approvedTemplates.slice(0, 4).map((t) => (
                    <Button
                      key={t.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={send.isPending}
                      onClick={() =>
                        send.mutate({
                          phone: active.phone,
                          template: { name: t.name, language: t.language },
                          member_id: active.member_id,
                        })
                      }
                    >
                      {t.display_name || t.name}
                    </Button>
                  ))}
                </div>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
};

export default WhatsAppInbox;
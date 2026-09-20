import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Megaphone, MessageCircle, ShieldAlert } from "lucide-react";
import { Navigate, useNavigate } from "@/lib/router-compat";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { maskWaId } from "@/lib/whatsappWebhook";
import {
  useMarkConversationRead,
  useWhatsAppConversations,
  useWhatsAppMessages,
  useWhatsAppRealtime,
  type WhatsAppMessage,
} from "@/hooks/useWhatsAppInbox";

const TYPE_LABELS: Record<string, string> = {
  text: "Tekst",
  image: "Afbeelding",
  video: "Video",
  audio: "Audio",
  document: "Document",
  sticker: "Sticker",
  button: "Knop",
  location: "Locatie",
};

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageLabel(message: WhatsAppMessage) {
  return TYPE_LABELS[message.message_type] ?? message.message_type;
}

const WhatsAppInboxPage = () => {
  const { isAdmin, isBoard } = useAuth();
  const navigate = useNavigate();
  const allowed = isAdmin || isBoard;
  const [selected, setSelected] = useState<string | null>(null);

  useWhatsAppRealtime(allowed);
  const { data: conversations, isLoading, error } = useWhatsAppConversations(allowed);
  const { data: messages } = useWhatsAppMessages(selected);
  const markRead = useMarkConversationRead();

  const current = useMemo(
    () => conversations?.find((c) => c.id === selected) ?? null,
    [conversations, selected],
  );

  useEffect(() => {
    if (selected && current && current.unread > 0 && !markRead.isPending) {
      markRead.mutate(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current?.unread]);

  if (!allowed) return <Navigate to="/" replace />;

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/whatsapp-webhook`
      : "/api/public/whatsapp-webhook";

  const takeOverAsAnnouncement = (message: WhatsAppMessage) => {
    const text = message.body ?? "";
    navigate(`/aankondigingen?share=${encodeURIComponent(text)}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <BcdHeroBanner title="WhatsApp-inbox" subtitle="Binnengekomen berichten" />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>Berichten konden niet worden geladen.</span>
          </CardContent>
        </Card>
      )}

      {!selected && (
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle size={16} className="text-brand-red" />
                Gesprekken
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <p className="px-4 py-6 text-sm text-muted-foreground">Laden...</p>
              )}
              {!isLoading && (conversations?.length ?? 0) === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Nog geen berichten ontvangen
                </p>
              )}
              <ul className="divide-y divide-border">
                {conversations?.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      onClick={() => setSelected(conversation.id)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {conversation.profile_name || maskWaId(conversation.wa_id)}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatTime(conversation.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {conversation.last_message_preview ?? ""}
                        </span>
                        {conversation.unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none shrink-0">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Configuratie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Webhook-URL</p>
                  <p className="break-all font-mono text-xs">{webhookUrl}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Benodigde instellingen</p>
                  <p className="text-xs">WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selected && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="px-2">
              <ArrowLeft size={16} />
            </Button>
            <CardTitle className="text-base truncate">
              {current?.profile_name || maskWaId(current?.wa_id ?? "")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(messages?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nog geen berichten ontvangen</p>
            )}
            {messages?.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-border p-3 space-y-1.5 max-w-full"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {message.direction === "inbound" ? "Ontvangen" : "Verzonden"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {messageLabel(message)}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(message.sent_at ?? message.received_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.body ?? `(${messageLabel(message)} zonder tekst)`}
                </p>
                {message.body && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => takeOverAsAnnouncement(message)}
                  >
                    <Megaphone size={14} /> Overnemen als aankondiging
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WhatsAppInboxPage;

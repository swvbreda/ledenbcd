import { FileText, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { useWhatsAppTemplates } from "@/hooks/useWhatsApp";

const statusIcon = (s: string) => {
  if (s === "approved") return <CheckCircle2 className="text-green-600" size={14} />;
  if (s === "rejected" || s === "disabled") return <XCircle className="text-red-600" size={14} />;
  return <Clock className="text-amber-600" size={14} />;
};

const WhatsAppTemplates = () => {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-brand-red/10 p-2 shrink-0">
            <FileText className="text-brand-red" size={18} />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-base">Berichttemplates</h2>
            <p className="text-sm text-muted-foreground">
              WhatsApp vereist dat berichten buiten het 24-uurs venster via vooraf goedgekeurde
              templates worden verstuurd. Templates beheer je in de{" "}
              <a
                href="https://business.facebook.com/wa/manage/message-templates/"
                target="_blank"
                rel="noreferrer"
                className="text-brand-red hover:underline inline-flex items-center gap-0.5"
              >
                Meta Business Manager <ExternalLink size={11} />
              </a>
              . Na indiening synchroniseren we de status hier.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : templates.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium">Nog geen templates geregistreerd.</p>
            <p className="mt-1 text-xs">
              Dien een template in bij Meta en voeg deze hier toe nadat hij goedgekeurd is.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {templates.map((t) => (
              <li key={t.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.display_name || t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.name}</p>
                    {t.body_text && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.body_text}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="flex items-center gap-1 text-xs">
                      {statusIcon(t.status)}
                      {t.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{t.category}</span>
                    <span className="text-[10px] text-muted-foreground">{t.language}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Copy, ExternalLink, Send, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Status = {
  verify_token: boolean;
  app_secret: boolean;
  access_token: boolean;
  phone_number_id: boolean;
  webhook_url: string;
};

const SECRETS: Array<{ key: keyof Status; label: string; help: string }> = [
  { key: "verify_token", label: "WHATSAPP_VERIFY_TOKEN", help: "Zelf gekozen string (20+ tekens). Plak ook in Meta bij 'Verify token'." },
  { key: "app_secret", label: "WHATSAPP_APP_SECRET", help: "Meta for Developers → App Settings → Basic → App Secret." },
  { key: "access_token", label: "WHATSAPP_ACCESS_TOKEN", help: "System User token uit Business Manager (permanent token)." },
  { key: "phone_number_id", label: "WHATSAPP_PHONE_NUMBER_ID", help: "WhatsApp → API Setup → Phone number ID." },
];

const WhatsAppSetupWizard = () => {
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<Status>("whatsapp-status");
      if (error) throw error;
      return data!;
    },
  });

  const allSet = status &&
    status.verify_token && status.app_secret && status.access_token && status.phone_number_id;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} gekopieerd` });
  };

  const sendTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          phone: testPhone,
          template: { name: "hello_world", language: "en_US" },
        },
      });
      if (error) throw error;
      toast({ title: "Test-bericht verzonden", description: "Check WhatsApp op het opgegeven nummer." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Verzenden mislukt", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-base">WhatsApp Cloud API koppeling</h2>
          {isLoading ? (
            <Badge variant="outline">Laden…</Badge>
          ) : allSet ? (
            <Badge className="bg-green-600 hover:bg-green-600">Klaar voor test</Badge>
          ) : status && (status.verify_token || status.app_secret || status.access_token || status.phone_number_id) ? (
            <Badge variant="outline" className="border-orange-500 text-orange-700">Gedeeltelijk</Badge>
          ) : (
            <Badge variant="outline" className="border-brand-red text-brand-red">Niet gekoppeld</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Volg de stappen om je Meta WhatsApp Business-account aan de app te koppelen.
        </p>
      </div>

      {/* Webhook URL */}
      {status?.webhook_url && (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Webhook callback URL (Meta → WhatsApp → Configuration)
          </label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={status.webhook_url} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => copy(status.webhook_url, "Webhook URL")}>
              <Copy size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Secrets checklist */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Vereiste secrets
        </label>
        <ul className="mt-2 divide-y divide-border border border-border rounded-md">
          {SECRETS.map((s) => {
            const ok = status?.[s.key] === true;
            return (
              <li key={s.key} className="px-3 py-2 flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-1 ${ok ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {ok ? <Check size={12} /> : <X size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.help}</p>
                </div>
                <Badge variant={ok ? "secondary" : "outline"} className="text-xs shrink-0">
                  {ok ? "Ingesteld" : "Ontbreekt"}
                </Badge>
              </li>
            );
          })}
        </ul>
        {!allSet && (
          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            Vraag Lovable om de ontbrekende secrets toe te voegen — bijvoorbeeld: "Voeg WHATSAPP_ACCESS_TOKEN toe".
          </p>
        )}
      </div>

      {/* Routekaart */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Routekaart
        </label>
        <ol className="mt-2 space-y-3 text-sm">
          <li>
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-brand-red text-white w-5 h-5 text-xs flex items-center justify-center shrink-0">1</span>
              Meta Business Manager
              <a href="https://business.facebook.com/overview" target="_blank" rel="noreferrer" className="text-brand-red text-xs flex items-center gap-1 hover:underline">
                openen <ExternalLink size={10} />
              </a>
            </div>
            <ul className="ml-7 mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>Business verificatie afronden (KvK-uittreksel uploaden)</li>
              <li>WhatsApp Business Account (WABA) aanmaken</li>
              <li>Telefoonnummer toevoegen en bevestigen</li>
            </ul>
          </li>
          <li>
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-brand-red text-white w-5 h-5 text-xs flex items-center justify-center shrink-0">2</span>
              Meta for Developers
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-brand-red text-xs flex items-center gap-1 hover:underline">
                openen <ExternalLink size={10} />
              </a>
            </div>
            <ul className="ml-7 mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>Nieuwe Business-app aanmaken</li>
              <li>Product "WhatsApp" toevoegen aan de app</li>
              <li>WABA en telefoonnummer aan de app koppelen</li>
              <li>App Secret noteren (Settings → Basic)</li>
              <li>Phone Number ID noteren (WhatsApp → API Setup)</li>
            </ul>
          </li>
          <li>
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-brand-red text-white w-5 h-5 text-xs flex items-center justify-center shrink-0">3</span>
              Webhook configureren in Meta
            </div>
            <ul className="ml-7 mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>WhatsApp → Configuration → Edit webhook</li>
              <li>Callback URL: gebruik de URL hierboven</li>
              <li>Verify token: zelf gekozen string (sla op als WHATSAPP_VERIFY_TOKEN)</li>
              <li>Subscribe op de velden: <span className="font-mono">messages</span> en <span className="font-mono">message_status</span></li>
            </ul>
          </li>
          <li>
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-brand-red text-white w-5 h-5 text-xs flex items-center justify-center shrink-0">4</span>
              System User + permanent token
            </div>
            <ul className="ml-7 mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>Business Manager → Settings → Users → System Users</li>
              <li>Nieuwe System User aanmaken (rol: Admin)</li>
              <li>Asset toewijzen: WABA + de app</li>
              <li>Generate Token → kies app → permissies: <span className="font-mono">whatsapp_business_messaging</span> + <span className="font-mono">whatsapp_business_management</span></li>
              <li>Token sla op als WHATSAPP_ACCESS_TOKEN</li>
            </ul>
          </li>
          <li>
            <div className="flex items-center gap-2 font-medium">
              <span className="rounded-full bg-brand-red text-white w-5 h-5 text-xs flex items-center justify-center shrink-0">5</span>
              Secrets invullen in Lovable
            </div>
            <p className="ml-7 mt-1 text-xs text-muted-foreground">
              Vraag Lovable om de 4 secrets hierboven toe te voegen. Daarna verschijnt hier een groene status en kun je een testbericht versturen.
            </p>
          </li>
        </ol>
      </div>

      {/* Test send */}
      {allSet && (
        <div className="border-t border-border pt-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Test-bericht verzenden (hello_world template)
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="+31612345678"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="font-mono"
            />
            <Button onClick={sendTest} disabled={!testPhone || testing}>
              {testing ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              <span className="ml-1.5">Verstuur</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Werkt alleen als het nummer geverifieerd is in Meta (of als ontvanger-testnummer is toegevoegd).
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          Status verversen
        </Button>
      </div>
    </div>
  );
};

export default WhatsAppSetupWizard;
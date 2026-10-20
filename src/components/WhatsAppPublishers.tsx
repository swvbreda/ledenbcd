import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveWhatsAppPublisher } from "@/lib/whatsappPublishers.functions";

export default function WhatsAppPublishers() {
  const { user, isAdmin } = useAuth();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveWhatsAppPublisher);
  const client = useQueryClient();
  const key = ["whatsapp-publishers", user?.id];
  const publishers = useQuery({ queryKey: key, enabled: isAdmin && !!user?.id, queryFn: async () => {
    const result = await supabase.from("whatsapp_announcement_publishers").select("phone,enabled").order("phone");
    if (result.error) throw result.error;
    return result.data;
  } });
  if (!isAdmin) return null;
  const change = async (number: string, enabled: boolean) => {
    setSaving(true);
    try {
      await save({ data: { phone: number, enabled } });
      await client.invalidateQueries({ queryKey: key });
      if (enabled) setPhone("");
      toast.success(enabled ? "Afzender expliciet toegestaan" : "Toestemming ingetrokken");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Opslaan mislukt"); }
    finally { setSaving(false); }
  };
  return <section className="border-t border-border pt-4 space-y-3" aria-label="Toegestane WhatsApp-afzenders">
    <h2 className="text-base font-semibold flex gap-2 items-center"><ShieldCheck className="h-4 w-4 text-brand-red" /> Toegestane afzenders</h2>
    <p className="text-sm text-muted-foreground">Alleen expliciet doorgestuurde tekst naar het BCD-nummer wordt automatisch gepubliceerd. Bijlagen en gewone berichten blijven in de inbox. De community wordt niet uitgelezen.</p>
    {publishers.isError ? <p className="text-sm text-destructive">Toegestane afzenders konden niet worden geladen.</p> : publishers.isPending ? <p className="text-sm text-muted-foreground">Laden…</p> : <>
      {!publishers.data?.some(p => p.enabled) && <p className="text-sm">Geen afzenders toegestaan: automatisch publiceren staat uit.</p>}
      <ul className="divide-y divide-border">{publishers.data?.filter(p => p.enabled).map(p => <li key={p.phone} className="flex items-center justify-between gap-2 py-2"><span className="text-sm tabular-nums">{p.phone}</span><Button variant="ghost" size="icon" disabled={saving} onClick={() => change(p.phone, false)} aria-label={`Toestemming intrekken voor ${p.phone}`} title="Toestemming intrekken"><X className="h-4 w-4" /></Button></li>)}</ul>
    </>}
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void change(phone, true); }}>
      <Input type="tel" aria-label="Internationaal telefoonnummer" placeholder="+31…" value={phone} onChange={event => setPhone(event.target.value)} className="flex-1 min-w-40" />
      <Button disabled={saving || !phone.trim()} type="submit"><Plus className="h-4 w-4 mr-2" /> Toestaan</Button>
    </form>
  </section>;
}
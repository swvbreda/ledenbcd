import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { safeWebsite } from '@/lib/addressBook';

export function EmailLink({ email }: { email: string }) {
  if (!email) return null;
  return <div className="flex min-w-0 items-center gap-1"><a className="min-w-0 break-all text-primary underline underline-offset-2" href={`mailto:${email}`}>{email}</a><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="E-mailadres kopiëren" aria-label={`Kopieer ${email}`} onClick={async () => {
    try { await navigator.clipboard.writeText(email); toast.success('E-mailadres gekopieerd'); }
    catch { toast.error('Kopiëren mislukt. Selecteer het e-mailadres om het te kopiëren.'); }
  }}><Copy size={15} /></Button></div>;
}
export function GeneralLinks({ email, phone, website }: { email: string; phone: string; website?: string }) {
  const url = website ? safeWebsite(website) : null;
  return <div className="min-w-0 space-y-1 text-sm"><EmailLink email={email} />{phone && <p><a className="text-primary underline" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></p>}{url && <p><a className="break-all text-primary underline" href={url} target="_blank" rel="noopener noreferrer">{website}</a></p>}</div>;
}

import { useState, type ReactNode } from 'react';
import { Copy, Download, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { exportScope, exportEmails, contactsCsv, downloadAddressFile } from '@/lib/addressBookExport';
import { plural, type AddressBook } from '@/lib/addressBook';

export function ExportToolbar({ results, selected, onClear, primaryAction }: { results: AddressBook; selected: ReadonlySet<string>; onClear: () => void; primaryAction?: ReactNode }) {
  const [general, setGeneral] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const scope = exportScope(results, selected);
  const chosen = scope.contacts.some(c => selected.has(c.id));
  const emails = exportEmails(scope, general);
  async function copy() {
    const text = emails.join('; ');
    try { await navigator.clipboard.writeText(text); toast.success('E-mailadressen gekopieerd'); }
    catch { setFallback(text); }
  }
  const summary = <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><strong>{chosen ? 'Export: selectie' : 'Export: alle resultaten'} · {plural(scope.contacts.length, 'contactpersoon', 'contactpersonen')}</strong><span className="text-muted-foreground">{plural(emails.length, 'bruikbaar uniek e-mailadres', 'bruikbare unieke e-mailadressen')}</span>{chosen && <Button size="sm" variant="ghost" onClick={onClear}><X size={14} /> Selectie wissen</Button>}</div>;
  const generalOption = <label className="flex min-h-9 items-center gap-2 text-sm"><Checkbox checked={general} onCheckedChange={v => setGeneral(v === true)} />Ook algemene organisatieadressen (alleen e-mailadressen)</label>;
  const buttons = <><Button size={primaryAction ? 'default' : 'sm'} variant="outline" disabled={!emails.length} onClick={copy}><Copy size={15} /> E-mailadressen kopiëren</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size={primaryAction ? 'default' : 'sm'} variant="outline" disabled={!scope.contacts.length && !emails.length}><Download size={15} /> Exporteren <ChevronDown size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem disabled={!emails.length} onSelect={() => downloadAddressFile(emails.join('; '), 'txt')}>E-mailadressen (.txt)</DropdownMenuItem><DropdownMenuItem disabled={!scope.contacts.length} onSelect={() => downloadAddressFile(contactsCsv(scope), 'csv')}>Contacten (.csv)</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>;
  return <section aria-label="Export Contacten" className={primaryAction ? 'space-y-3' : 'space-y-2 border-y border-border py-3'}>
    {primaryAction ? <>
      <div role="group" aria-label="Contactacties" className="flex flex-wrap items-center justify-end gap-2">{buttons}{primaryAction}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">{summary}{generalOption}</div>
    </> : <>{summary}<div className="flex flex-wrap items-center gap-2">{buttons}{generalOption}</div></>}
    <Dialog open={fallback !== null} onOpenChange={v => { if (!v) setFallback(null); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>E-mailadressen handmatig kopiëren</DialogTitle><DialogDescription>Automatisch kopiëren lukte niet. Selecteer en kopieer deze adressen.</DialogDescription></DialogHeader><textarea aria-label="E-mailadressen om te kopiëren" readOnly value={fallback ?? ''} onFocus={e => e.target.select()} className="h-40 w-full rounded-md border border-input bg-background p-3 text-sm" /><Button variant="outline" onClick={() => setFallback(null)}>Sluiten</Button></DialogContent></Dialog>
  </section>;
}

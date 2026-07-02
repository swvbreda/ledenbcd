import { useState } from "react";
import { Mail, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Member } from "@/data/types";

interface Props {
  members: Member[];
}

const MAIL_SEPARATOR = ";";

const getUniqueEmails = (data: { email: string | null }[]) =>
  [...new Set(
    data
      .map((r) => (r.email || "").trim().replace(/^[,;\s]+|[,;\s]+$/g, ""))
      .filter(Boolean)
  )];

export default function MailingExportButton({ members }: Props) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEmails, setDialogEmails] = useState("");
  const [dialogCount, setDialogCount] = useState(0);

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back to the textarea copy method below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const fetchMailingData = async () => {
    const memberIds = members.map((m) => m.id);
    const { data, error } = await supabase
      .from("member_mailing_preferences")
      .select("member_id, email")
      .in("member_id", memberIds);

    if (error) {
      toast.error("Fout bij ophalen mailingvoorkeuren: " + error.message);
      return null;
    }
    const prefs = data || [];
    // Fallback: members without an explicit preference get their primary email included.
    const withPref = new Set(prefs.map((r) => r.member_id));
    const fallback = members
      .filter((m) => !withPref.has(m.id) && (m.email || "").trim())
      .map((m) => ({ member_id: m.id, email: (m.email as string).trim() }));
    return [...prefs, ...fallback];
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMailto = async () => {
    setLoading(true);
    const data = await fetchMailingData();
    if (!data) { setLoading(false); return; }

    if (data.length === 0) {
      toast.info("Geen mailingvoorkeuren gevonden");
      setLoading(false);
      return;
    }

    const emails = getUniqueEmails(data);
    const joined = emails.join(MAIL_SEPARATOR);
    setDialogEmails(joined);
    setDialogCount(emails.length);
    setDialogOpen(true);
    setLoading(false);
  };

  const handleDialogCopy = async () => {
    const copied = await copyToClipboard(dialogEmails);
    if (copied) {
      toast.success(`${dialogCount} e-mailadressen gekopieerd. Plak ze in het BCC-veld van Outlook.`);
    } else {
      toast.error("Kopiëren mislukt. Selecteer de tekst handmatig (Cmd/Ctrl+A) en kopieer met Cmd/Ctrl+C.");
    }
  };

  const handleDialogDownload = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(dialogEmails, `bcd-outlook-bcc-${today}.txt`);
  };

  const handleDialogOpenOutlook = () => {
    window.open("https://outlook.office.com/mail/deeplink/compose", "_blank", "noopener,noreferrer");
  };

  const handleSimpleExport = async () => {
    setLoading(true);
    const data = await fetchMailingData();
    if (!data) { setLoading(false); return; }

    if (data.length === 0) {
      toast.info("Geen mailingvoorkeuren gevonden");
      setLoading(false);
      return;
    }

    const memberMap = new Map(members.map((m) => [m.id, m]));
    const headers = ["Lidnr", "Bedrijfsnaam", "E-mail"];
    const rows = data.map((r) => {
      const m = memberMap.get(r.member_id);
      return [r.member_id, m?.naam ?? "", r.email];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `bcd-mailinglijst-${today}.csv`);
    setLoading(false);
  };

  const handleOutlookExport = async () => {
    setLoading(true);
    const data = await fetchMailingData();
    if (!data) { setLoading(false); return; }

    if (data.length === 0) {
      toast.info("Geen mailingvoorkeuren gevonden");
      setLoading(false);
      return;
    }

    const memberMap = new Map(members.map((m) => [m.id, m]));
    const headers = ["First Name", "Last Name", "E-mail Address", "Company", "Job Title", "Business Phone", "Business City"];
    const rows = data.map((r) => {
      const m = memberMap.get(r.member_id);
      const contact = m?.contacten?.find((c) => c.email === r.email);
      const nameParts = (contact?.naam || m?.contactpersoon || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      return [
        firstName, lastName, r.email, m?.naam ?? "",
        contact?.functie || m?.functie || "",
        contact?.telefoon || m?.telefoon || "",
        m?.plaats ?? "",
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(MAIL_SEPARATOR))
      .join("\n");

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `bcd-mailinglijst-outlook-${today}.csv`);
    setLoading(false);
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={loading}>
          <Mail size={14} />
          Mailinglijst
          <ChevronDown size={12} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleMailto}>
          Open in Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSimpleExport}>
          Exporteer mailinglijst (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlookExport}>
          Exporteer voor Outlook
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogCount} e-mailadressen</DialogTitle>
          <DialogDescription>
            Klik op “Kopieer” en plak in het BCC-veld van Outlook. Adressen zijn gescheiden met een puntkomma (;).
          </DialogDescription>
        </DialogHeader>
        <textarea
          readOnly
          value={dialogEmails}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-64 p-3 text-sm font-mono border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand-red"
        />
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="outline" onClick={handleDialogDownload}>Download .txt</Button>
          <Button variant="outline" onClick={handleDialogOpenOutlook}>Open Outlook</Button>
          <Button onClick={handleDialogCopy}>Kopieer alles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

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
    return data || [];
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
    const copied = await copyToClipboard(joined);
    const today = new Date().toISOString().slice(0, 10);
    // Always download as fallback so the user reliably has the ;-separated list.
    downloadCsv(joined, `bcd-outlook-bcc-${today}.txt`);
    if (copied) {
      toast.success(`${emails.length} e-mailadressen gekopieerd (gescheiden met ;) en als bestand gedownload. Plak in BCC van Outlook.`);
    } else {
      toast.info(`${emails.length} e-mailadressen gedownload als tekstbestand (gescheiden met ;). Open en kopieer naar BCC in Outlook.`);
    }
    const url = `https://outlook.office.com/mail/deeplink/compose`;
    window.open(url, "_blank", "noopener,noreferrer");
    setLoading(false);
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
  );
}

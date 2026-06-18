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

export default function MailingExportButton({ members }: Props) {
  const [loading, setLoading] = useState(false);

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

    const emails = [...new Set(data.map((r) => r.email))];
    const joined = emails.join("; ");
    try {
      await navigator.clipboard.writeText(joined);
      toast.success(`${emails.length} e-mailadressen gekopieerd. Plak ze in het BCC-veld van Outlook.`);
    } catch {
      toast.info("Kopieer de adressen handmatig: " + joined);
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
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
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

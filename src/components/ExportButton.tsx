import { Download } from "lucide-react";
import type { Member } from "@/data/types";
import { getMembershipYears } from "@/lib/membership";

interface ExportButtonProps {
  members: Member[];
  filename?: string;
}

const ExportButton = ({ members, filename = "bcd-leden" }: ExportButtonProps) => {
  const handleExport = () => {
    const headers = [
      "Lidnr", "Naam", "Plaats", "Stadsdeel", "Jaren Lid", "Oprichting",
      "Contactpersoon", "Functie", "Telefoon", "Email",
      "Aantal Locaties", "Factuur Bedrijfsnaam", "Factuur KVK",
      "Factuur Adres", "Factuur Postcode", "Factuur Plaats", "Factuur Email",
    ];

    const rows = members.map((m) => [
      m.id, m.naam, m.plaats, m.stadsdeel, getMembershipYears(m) ?? "", m.oprichtingJaar ?? "",
      m.contactpersoon, m.functie, m.telefoon, m.email,
      m.aantalLocaties, m.factuurBedrijfsnaam ?? "", m.factuurKvk ?? "",
      m.factuurAdres ?? "", m.factuurPostcode ?? "", m.factuurPlaats ?? "",
      m.factuurEmail ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
    >
      <Download size={14} />
      Exporteer CSV
    </button>
  );
};

export default ExportButton;

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Member } from "@/data/types";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { buildWorkbookData, exportFileName } from "@/lib/memberExport";

interface ExportButtonProps {
  /** Alleen als hint voor de bestandsnaam; de export bevat altijd alle leden. */
  filename?: string;
  members?: Member[];
}

const HEADERS_LEDEN = [
  { header: "Nr.", key: "nr", width: 6 },
  { header: "Lidnr", key: "lidnr", width: 9 },
  { header: "Naam", key: "naam", width: 28 },
  { header: "Plaats", key: "plaats", width: 18 },
  { header: "Stadsdeel", key: "stadsdeel", width: 16 },
  { header: "Jaren lid", key: "jarenLid", width: 10 },
  { header: "Lid sinds", key: "lidSinds", width: 10 },
  { header: "Oprichtingsjaar", key: "oprichtingsjaar", width: 14 },
  { header: "Contactpersoon", key: "contactpersoon", width: 24 },
  { header: "Functie", key: "functie", width: 18 },
  { header: "Telefoon", key: "telefoon", width: 16 },
  { header: "E-mail", key: "email", width: 30 },
  { header: "Aantal locaties", key: "aantalLocaties", width: 13 },
  { header: "Locaties", key: "locaties", width: 55 },
  { header: "KVK", key: "kvk", width: 14 },
  { header: "Bedrijfsnaam", key: "bedrijfsnaam", width: 28 },
  { header: "Factuurbedrijfsnaam", key: "factuurBedrijfsnaam", width: 28 },
  { header: "Factuuradres", key: "factuurAdres", width: 26 },
  { header: "Factuurpostcode", key: "factuurPostcode", width: 14 },
  { header: "Factuurplaats", key: "factuurPlaats", width: 18 },
  { header: "Factuure-mail", key: "factuurEmail", width: 30 },
  { header: "Factuurtelefoon", key: "factuurTelefoon", width: 16 },
];

const HEADERS_LOCATIES = [
  { header: "Nr.", key: "nr", width: 6 },
  { header: "Type", key: "type", width: 10 },
  { header: "Lidnr", key: "lidnr", width: 9 },
  { header: "Lidnaam", key: "lidnaam", width: 28 },
  { header: "Locatienaam", key: "locatienaam", width: 28 },
  { header: "Straat", key: "straat", width: 26 },
  { header: "Huisnummer", key: "huisnummer", width: 12 },
  { header: "Toevoeging", key: "toevoeging", width: 12 },
  { header: "Postcode", key: "postcode", width: 12 },
  { header: "Plaats", key: "plaats", width: 18 },
  { header: "Gemeente", key: "gemeente", width: 18 },
  { header: "Stadsdeel", key: "stadsdeel", width: 16 },
  { header: "KVK", key: "kvk", width: 14 },
  { header: "Bedrijfsnaam", key: "bedrijfsnaam", width: 28 },
  { header: "Telefoon", key: "telefoon", width: 16 },
  { header: "E-mail", key: "email", width: 30 },
];

const HEADERS_CONTACTEN = [
  { header: "Nr.", key: "nr", width: 6 },
  { header: "Type", key: "type", width: 10 },
  { header: "Lidnr", key: "lidnr", width: 9 },
  { header: "Lidnaam", key: "lidnaam", width: 28 },
  { header: "Naam contactpersoon", key: "naam", width: 26 },
  { header: "Functie", key: "functie", width: 20 },
  { header: "Telefoon", key: "telefoon", width: 16 },
  { header: "E-mail", key: "email", width: 30 },
  { header: "Primair", key: "primair", width: 9 },
];

const ExportButton = ({ filename }: ExportButtonProps) => {
  const [busy, setBusy] = useState(false);
  const { rawMembers, rawLeads, rawOldMembers } = useMembersData();
  const { members: mergedMembers } = useMergedMembers(rawMembers);
  const { members: mergedLeads } = useMergedMembers(rawLeads);
  const { members: mergedOldMembers } = useMergedMembers(rawOldMembers);

  const handleExport = async () => {
    setBusy(true);
    try {
      // Altijd de volledige effectieve lijst; tab, zoeken, sorteren en filters tellen niet mee.
      const { leden, leads, oudLeden, locaties, contacten } = buildWorkbookData(
        {
          leden: mergedMembers,
          leads: mergedLeads,
          oudLeden: mergedOldMembers,
        },
      );

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();

      const sheets: [
        string,
        typeof HEADERS_LEDEN,
        Record<string, unknown>[],
        string[],
      ][] = [
        [
          "Leden",
          HEADERS_LEDEN,
          leden as unknown as Record<string, unknown>[],
          ["locaties"],
        ],
        [
          "Leads",
          HEADERS_LEDEN,
          leads as unknown as Record<string, unknown>[],
          ["locaties"],
        ],
        [
          "Oud-leden",
          HEADERS_LEDEN,
          oudLeden as unknown as Record<string, unknown>[],
          ["locaties"],
        ],
        [
          "Locaties",
          HEADERS_LOCATIES,
          locaties as unknown as Record<string, unknown>[],
          [],
        ],
        [
          "Contactpersonen",
          HEADERS_CONTACTEN,
          contacten as unknown as Record<string, unknown>[],
          [],
        ],
      ];

      for (const [name, columns, rows, wrapKeys] of sheets) {
        const sheet = workbook.addWorksheet(name, {
          views: [{ state: "frozen", ySplit: 1 }],
        });
        sheet.columns = columns.map((c) => ({
          header: c.header,
          key: c.key,
          width: c.width,
        }));
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).alignment = { vertical: "middle" };
        rows.forEach((row) => sheet.addRow(row));
        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: columns.length },
        };
        for (const key of wrapKeys) {
          const column = sheet.getColumn(key);
          column.alignment = { wrapText: true, vertical: "top" };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ? `${filename}.xlsx` : exportFileName();
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Excel gedownload: ${leden.length} leden, ${leads.length} leads, ${oudLeden.length} oud-leden, ${locaties.length} locaties, ${contacten.length} contactpersonen.`,
      );
    } catch (error) {
      console.error("Excel-export mislukt", error);
      toast.error("Excel downloaden is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
    >
      <Download size={14} />
      {busy ? "Bezig…" : "Excel downloaden"}
    </button>
  );
};

export default ExportButton;

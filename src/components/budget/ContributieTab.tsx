import FacturenOverzichtTab from "@/components/budget/FacturenOverzichtTab";

interface Props {
  year: number;
}

/**
 * Contributieoverzicht. Facturen, bedragen en betaalstatus komen uitsluitend
 * uit de boekhouding; er worden geen lokale contributieregels meer gelezen of
 * aangemaakt.
 */
export default function ContributieTab({ year }: Props) {
  return (
    <div className="space-y-4 mt-4">
      <FacturenOverzichtTab year={year} />
    </div>
  );
}

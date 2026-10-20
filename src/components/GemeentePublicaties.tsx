import { Notebook } from "lucide-react";
import BeleidDocumentenLijst from "@/components/beleid/BeleidDocumentenLijst";

/** Blok "Beleid en documenten": uitsluitend openbare bronstukken uit de Beleidsmonitor. */
export default function GemeentePublicaties({ gemeentenaam }: { gemeentenaam: string }) {
  return (
    <section aria-labelledby="beleid-docs-titel" className="bg-card rounded-lg border border-border p-5 space-y-4 min-w-0">
      <h3 id="beleid-docs-titel" className="text-sm font-semibold font-display flex items-center gap-2">
        <Notebook size={16} className="text-brand-red" aria-hidden />
        Beleid en documenten
      </h3>
      <p className="text-xs text-muted-foreground">Openbare bronstukken uit de Beleidsmonitor, nieuwste eerst.</p>
      <BeleidDocumentenLijst key={gemeentenaam} gemeentenaam={gemeentenaam} />
    </section>
  );
}

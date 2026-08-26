import { useMemo } from "react";
import { Building2, Users } from "lucide-react";

export type VergunninghouderRow = {
  /** Vestigingsnaam zoals bekend bij het lid of in het register. */
  locatie: string;
  adres?: string | null;
  plaats?: string | null;
  /** Vergunninghoudende onderneming van DEZE vestiging. */
  houder?: string | null;
  exploitant?: string | null;
  kvk?: string | null;
  vestigingsnummer?: string | null;
  ubo?: { naam: string; soort?: string; niveau?: number; isUiteindelijk?: boolean }[];
  /** Contactpersonen die specifiek aan deze vestiging gekoppeld zijn. */
  contacten?: { naam: string; functie?: string }[];
};

type Props = { rows: VergunninghouderRow[] };

const norm = (v?: string | null) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Groep = {
  key: string;
  naam: string | null;
  kvk: string | null;
  ubo: VergunninghouderRow["ubo"];
  rows: VergunninghouderRow[];
};

/**
 * Toont per lid welke vergunninghoudende ondernemingen (B.V.'s) en eigenaren er
 * achter de vestigingen zitten. Binnen één lid kunnen dat er meerdere zijn — de
 * BV hoort bij een vestiging, niet bij het lid als geheel.
 */
const VergunninghoudersOverzicht = ({ rows }: Props) => {
  const groepen = useMemo(() => {
    const map = new Map<string, Groep>();
    for (const r of rows) {
      const naam = r.houder || r.exploitant || null;
      const key = naam ? norm(naam) : `onbekend`;
      const bestaand = map.get(key);
      if (bestaand) {
        bestaand.rows.push(r);
        if (!bestaand.kvk && r.kvk) bestaand.kvk = r.kvk;
        if ((!bestaand.ubo || bestaand.ubo.length === 0) && r.ubo?.length) bestaand.ubo = r.ubo;
      } else {
        map.set(key, {
          key,
          naam,
          kvk: r.kvk ?? null,
          ubo: r.ubo ?? [],
          rows: [r],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (!a.naam) return 1;
      if (!b.naam) return -1;
      return a.naam.localeCompare(b.naam);
    });
  }, [rows]);

  if (rows.length === 0) return null;

  const bekend = groepen.filter((g) => g.naam);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Building2 size={16} className="text-brand-red" /> Vergunninghouders &amp; eigenaren
        </h3>
        <span className="text-xs text-muted-foreground">
          {bekend.length} {bekend.length === 1 ? "onderneming" : "ondernemingen"} over {rows.length}{" "}
          {rows.length === 1 ? "vestiging" : "vestigingen"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groepen.map((g) => (
          <div key={g.key} className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium font-display">
                {g.naam ?? "Vergunninghouder onbekend"}
              </span>
              {g.kvk && (
                <span className="font-mono text-xs text-muted-foreground">KvK {g.kvk}</span>
              )}
            </div>

            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {g.rows.map((r, i) => (
                <li key={i} className="leading-snug">
                  <span className="text-foreground">{r.locatie}</span>
                  {(r.adres || r.plaats) && (
                    <span> — {[r.adres, r.plaats].filter(Boolean).join(", ")}</span>
                  )}
                  {r.vestigingsnummer && (
                    <span className="ml-1 font-mono text-xs">vest. {r.vestigingsnummer}</span>
                  )}
                  {r.contacten && r.contacten.length > 0 && (
                    <span className="block text-xs">
                      {r.contacten
                        .map((p) => p.naam + (p.functie ? ` (${p.functie})` : ""))
                        .join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {g.ubo && g.ubo.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users size={12} className="text-brand-red" /> Eigenaren
                </p>
                <ul className="space-y-0.5 text-sm">
                  {g.ubo.map((u, i) => (
                    <li key={i} className="leading-snug">
                      {u.naam}
                      {u.soort && (
                        <span className="ml-1 text-xs text-muted-foreground">({u.soort})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VergunninghoudersOverzicht;

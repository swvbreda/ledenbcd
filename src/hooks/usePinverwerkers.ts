import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PspGroep {
  naam: string;
  aantal: number;
  pct: number;
  vestigingen: string[];
}

const KNOWN = [
  "Worldline",
  "CCV",
  "EMS / Fiserv",
  "Adyen",
  "Rabobank",
  "SumUp",
  "YourSafe",
  "CM.com",
  "Mollie",
  "Buckaroo",
  "ING",
  "ABN AMRO",
];

/** Normaliseer een antwoord naar een aanbiedernaam; "Anders: x" wordt herkend waar mogelijk. */
const normalize = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  const zonderPrefix = v.replace(/^anders[,:]?\s*(namelijk)?[:]?\s*/i, "").trim();
  const kandidaat = zonderPrefix || v;
  const hit = KNOWN.find(
    (k) =>
      k.toLowerCase() === kandidaat.toLowerCase() ||
      kandidaat.toLowerCase().includes(k.toLowerCase()),
  );
  if (hit) return hit;
  if (/^anders/i.test(v)) return "Anders";
  if (/^(weet ik niet|niet van toepassing|n\.v\.t\.?)$/i.test(v)) return null;
  return kandidaat;
};

/** Splits een antwoordwaarde in losse aanbieders. */
const toValues = (answer: unknown): { locatie: string; keuzes: string[] } => {
  const obj = (answer ?? {}) as Record<string, unknown>;
  const locatie = typeof obj.location === "string" ? obj.location : "Onbekende vestiging";
  const val = obj.value ?? obj;
  const lijst: string[] = Array.isArray(val)
    ? val.map(String)
    : typeof val === "string"
      ? [val]
      : [];
  return { locatie, keuzes: lijst };
};

export const usePinverwerkers = (enabled: boolean) =>
  useQuery({
    queryKey: ["pinverwerkers"],
    enabled,
    queryFn: async () => {
      const { data: vragen, error: vErr } = await supabase
        .from("survey_questions")
        .select("id, question_text")
        .ilike("question_text", "%betaaldienstverlener gebruikt u momenteel%");
      if (vErr) throw vErr;
      const vraagIds = (vragen ?? []).map((v) => v.id);
      if (vraagIds.length === 0) {
        return { groepen: [] as PspGroep[], antwoorden: 0 };
      }

      const { data: responses, error: rErr } = await supabase
        .from("survey_responses")
        .select("answer, question_id")
        .in("question_id", vraagIds);
      if (rErr) throw rErr;

      const map = new Map<string, Set<string>>();
      let antwoorden = 0;

      for (const r of responses ?? []) {
        const { locatie, keuzes } = toValues(r.answer);
        const namen = Array.from(
          new Set(keuzes.map(normalize).filter((n): n is string => !!n)),
        );
        if (namen.length === 0) continue;
        antwoorden += 1;
        for (const n of namen) {
          const set = map.get(n) ?? new Set<string>();
          set.add(locatie);
          map.set(n, set);
        }
      }

      const totaal = Array.from(map.values()).reduce((s, v) => s + v.size, 0) || 1;
      const groepen: PspGroep[] = Array.from(map.entries())
        .map(([naam, set]) => ({
          naam,
          aantal: set.size,
          pct: Math.round((set.size / totaal) * 100),
          vestigingen: Array.from(set).sort((a, b) => a.localeCompare(b, "nl")),
        }))
        .sort((a, b) => {
          if (a.naam === "Anders") return 1;
          if (b.naam === "Anders") return -1;
          return b.aantal - a.aantal;
        });

      return { groepen, antwoorden };
    },
  });

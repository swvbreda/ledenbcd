/**
 * Leesbare weergave van een projectplan (plain text). Geen Markdown/HTML: alles wordt als tekst gerenderd.
 * Herkent uitsluitend de koppen 'Huidige stand', 'Verloop', 'Vervolg', 'Praktische opvolging' (eigen regel,
 * optioneel met ':'), lijstregels (-, *, •, 1.) en onder 'Verloop' tijdlijnregels 'datum | titel | tekst'.
 * Alle overige tekst blijft volledig zichtbaar als alinea.
 */
export const PLAN_HEADINGS = ["Huidige stand", "Verloop", "Vervolg", "Praktische opvolging"] as const;

export type PlanBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "timeline"; items: { date: string; title: string; text: string }[] };
export type PlanSection = { heading: string | null; blocks: PlanBlock[] };

const headingOf = (line: string) => {
  const t = line.trim().replace(/:$/, "").trim().toLowerCase();
  return PLAN_HEADINGS.find((h) => h.toLowerCase() === t) ?? null;
};
const LIST = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;
const MONTHS = "januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec";
const DATE = new RegExp(`^(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}-\\d{1,2}-\\d{4}|\\d{1,2} (?:${MONTHS})\\.? \\d{4})$`, "i");

function timelineItem(line: string) {
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 3 || !DATE.test(parts[0])) return null;
  // Extra kolommen blijven onderdeel van de tekst (lossless); bronmetadata hoort in presentText.
  return { date: parts[0], title: parts[1], text: parts.slice(2).join(" | ") };
}

export function parsePlan(raw: string | null | undefined): PlanSection[] {
  if (!raw?.trim()) return [];
  const sections: PlanSection[] = [{ heading: null, blocks: [] }];
  let para: string[] = [];
  const cur = () => sections[sections.length - 1];
  const flush = () => { if (para.length) { cur().blocks.push({ type: "paragraph", text: para.join("\n") }); para = []; } };
  const last = () => cur().blocks[cur().blocks.length - 1];

  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const h = headingOf(line);
    if (h) { flush(); sections.push({ heading: h, blocks: [] }); continue; }
    if (!line.trim()) { flush(); continue; }
    if (cur().heading === "Verloop") {
      const ti = timelineItem(line);
      if (ti) {
        flush();
        const b = last();
        if (b?.type === "timeline") b.items.push(ti); else cur().blocks.push({ type: "timeline", items: [ti] });
        continue;
      }
    }
    const m = line.match(LIST);
    if (m) {
      flush();
      const ordered = !m[1], b = last();
      if (b?.type === "list" && b.ordered === ordered) b.items.push(m[3]); else cur().blocks.push({ type: "list", ordered, items: [m[3]] });
      continue;
    }
    para.push(line);
  }
  flush();
  return sections.filter((s) => s.heading || s.blocks.length);
}

const MONTH_NUM: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6,
  juli: 7, jul: 7, augustus: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, december: 12, dec: 12,
};

/** Datumwaarde (yyyymmdd) voor herkende tijdlijndatums; null als onherkenbaar. */
export function timelineDateKey(date: string): number | null {
  const s = date.trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return +m[1] * 10000 + +m[2] * 100 + +m[3];
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return +m[3] * 10000 + +m[2] * 100 + +m[1];
  m = s.match(/^(\d{1,2}) ([a-z]+)\.? (\d{4})$/);
  if (m && MONTH_NUM[m[2]]) return +m[3] * 10000 + MONTH_NUM[m[2]] * 100 + +m[1];
  return null;
}

/** Alleen weergave: kopie van tijdlijnitems, nieuwste eerst; stabiel bij gelijke datum, onherkenbaar onderaan in oorspronkelijke volgorde. */
export function newestFirst<T extends { date: string }>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i, k: timelineDateKey(it.date) }))
    .sort((a, b) => (a.k === null || b.k === null ? (a.k === null ? 1 : 0) - (b.k === null ? 1 : 0) || a.i - b.i : b.k - a.k || a.i - b.i))
    .map((x) => x.it);
}

/**
 * Eén 'Huidige status': de omschrijving is leidend zodra die gevuld is; alleen bij lege omschrijving valt het terug
 * op de plansectie 'Huidige stand' (volledig). 'Huidige stand' wordt nooit als aparte sectie in `rest` gerenderd;
 * de ruwe plantekst blijft ongewijzigd bewerkbaar.
 */
export function splitCurrentStatus(planText: string | null | undefined, description: string | null | undefined) {
  const sections = parsePlan(planText);
  const rest = sections.filter((s) => s.heading !== "Huidige stand");
  const d = description?.trim();
  if (d) return { status: { source: "description" as const, blocks: [{ type: "paragraph", text: d } as PlanBlock] }, rest };
  const sec = sections.find((s) => s.heading === "Huidige stand" && s.blocks.length > 0);
  return { status: sec ? { source: "plan" as const, blocks: sec.blocks } : null, rest };
}

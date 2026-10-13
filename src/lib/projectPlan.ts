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
const DATEISH = /\d/;

function timelineItem(line: string) {
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 3 || !parts[0] || !DATEISH.test(parts[0]) || parts[0].length > 40) return null;
  // Alleen datum, titel en tekst; eventuele extra kolommen (bronlabels) worden niet getoond.
  return { date: parts[0], title: parts[1], text: parts[2] };
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

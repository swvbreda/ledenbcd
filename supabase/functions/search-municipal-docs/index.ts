import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORI_ENDPOINT = "https://api.openraadsinformatie.nl/v1/elastic/_search";
const NOTUBIZ_API = "https://api.notubiz.nl";

/* ── Timeout helper ── */

const DEFAULT_TIMEOUT = 8000;

function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* ── Parlaeus integration ── */

// Known Parlaeus gemeenten (subdomain mapping)
// Format: gemeentenaam (lowercase) → subdomain
const PARLAEUS_GEMEENTEN: Record<string, string> = {
  "maastricht": "maastricht",
  // Add more as discovered
};

interface ParlaeusResult {
  id: string;
  score: number;
  name: string;
  url: string | null;
  date: string | null;
  organization: string;
  description: string | null;
  source: "parlaeus";
}

async function searchParlaeus(gemeentenaam: string, keywords: string): Promise<ParlaeusResult[]> {
  const needle = gemeentenaam.toLowerCase().trim();
  const subdomain = PARLAEUS_GEMEENTEN[needle];
  if (!subdomain) return [];

  const baseUrl = `https://${subdomain}.parlaeus.nl/vji/public/bestuursdocument`;
  const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean);
  const results: ParlaeusResult[] = [];

  // Search the last 24 months
  const now = new Date();
  const fetchPromises: Promise<void>[] = [];

  for (let offset = 0; offset < 24; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mn = d.getMonth() + 1;
    const yr = d.getFullYear();

    fetchPromises.push(
      (async () => {
        try {
          const listUrl = `${baseUrl}/action=datalist/mn=${mn}/yr=${yr}`;
          const res = await fetchWithTimeout(listUrl, undefined, 6000);
          if (!res.ok) return;
          const items = await res.json();
          if (!Array.isArray(items)) return;

          for (const item of items) {
            const title = (item.title || "").toLowerCase();
            const matchScore = terms.reduce(
              (sc: number, t: string) => sc + (title.includes(t) ? 2 : 0),
              0,
            );
            if (matchScore === 0) continue;

            const hexkey = item.hexkey;
            // Construct PDF URL from the title
            const safeTitle = (item.title || "document")
              .replace(/[^a-zA-Z0-9_\-\s]/g, "")
              .replace(/\s+/g, "_");
            const pdfUrl = `${baseUrl}/action=showdoc/gd=${hexkey}/${safeTitle}.pdf`;

            results.push({
              id: `parlaeus-${hexkey}`,
              score: matchScore + (item.has_documents ? 2 : 0),
              name: item.title || "Onbekend document",
              url: pdfUrl,
              date: item.date
                ? item.date.split("-").reverse().join("-") // DD-MM-YYYY → YYYY-MM-DD
                : null,
              organization: gemeentenaam,
              description: item.type_document
                ? `${item.type_document}${item.number ? ` (${item.number})` : ""}`
                : null,
              source: "parlaeus",
            });
          }
        } catch (e) {
          // Silently skip failed months
        }
      })(),
    );
  }

  // Run in batches of 6 to avoid overwhelming the server
  for (let i = 0; i < fetchPromises.length; i += 6) {
    await Promise.all(fetchPromises.slice(i, i + 6));
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

/* ── Notubiz org lookup (cached per invocation) ── */

let orgCache: Record<string, number> | null = null;

async function findNotubizOrgId(gemeentenaam: string): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!orgCache) {
        const res = await fetchWithTimeout(`${NOTUBIZ_API}/organisations?format=json&version=1.17.0`, undefined, 12000);
        if (!res.ok) { await res.text(); return null; }
        const data = await res.json();
        const orgs = data?.organisations?.organisation ?? [];
        orgCache = {};
        for (const o of orgs) {
          const name = (o.name || "").trim().toLowerCase();
          const id = o?.["@attributes"]?.id;
          if (name && id) orgCache[name] = Number(id);
        }
      }
      const needle = gemeentenaam.toLowerCase().trim();
      // Exact match first
      for (const [name, id] of Object.entries(orgCache)) {
        if (name === `gemeente ${needle}` || name === needle) return id;
      }
      // Partial match
      for (const [name, id] of Object.entries(orgCache)) {
        if (name.includes(needle) && !name.includes("test") && !name.includes("demo") && !name.includes("college")) return id;
      }
      return null;
    } catch (e) {
      console.error(`Notubiz org lookup error (attempt ${attempt + 1}):`, e);
      orgCache = null; // Reset cache on failure for retry
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

/* ── Search Notubiz meetings for keyword matches ── */

interface NotubizResult {
  id: string;
  score: number;
  name: string;
  url: string | null;
  date: string | null;
  organization: string;
  description: string | null;
  source: "notubiz";
  meetingId?: number;
  agendaItemTitle?: string;
}

async function searchNotubizMeetings(
  orgId: number,
  keywords: string,
  gemeentenaam: string,
): Promise<NotubizResult[]> {
  const results: NotubizResult[] = [];
  const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean);

  const dateFrom = new Date();
  dateFrom.setFullYear(dateFrom.getFullYear() - 5);
  const dateTo = new Date();
  dateTo.setFullYear(dateTo.getFullYear() + 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;

  let page = 1;
  let hasMore = true;
  const maxPages = 3;

  while (hasMore && page <= maxPages) {
    try {
      const eventsUrl = `${NOTUBIZ_API}/events?format=json&version=1.17.0&organisation_id=${orgId}&date_from=${encodeURIComponent(fmt(dateFrom))}&date_to=${encodeURIComponent(fmt(dateTo))}&page_size=200&page=${page}`;
      const res = await fetchWithTimeout(eventsUrl);
      if (!res.ok) { await res.text(); break; }
      const data = await res.json();
      const events = data.events || [];
      hasMore = data.pagination?.has_more_pages ?? false;
      page++;

      for (const event of events) {
        if (event.type !== "meeting") continue;
        const attrs = event.attributes || [];
        const title = attrs.find((a: any) => a.id === 1)?.value || "";

        const titleLower = title.toLowerCase();
        const matchScore = terms.reduce(
          (sc: number, t: string) => sc + (titleLower.includes(t) ? 1 : 0),
          0,
        );
        if (matchScore === 0) continue;

        const meetingId = event.id;
        const docCount = event.event_type_data?.document_count || 0;
        const agendaCount = event.event_type_data?.agenda_item_count || 0;
        const dateStr = event.plannings?.[0]?.start_date || event.creation_date;

        if (docCount > 0 || agendaCount > 0) {
          try {
            const meetRes = await fetchWithTimeout(
              `${NOTUBIZ_API}/events/meetings/${meetingId}?format=json&version=1.17.0`,
            );
            if (!meetRes.ok) { await meetRes.text(); continue; }
            const meetData = await meetRes.json();
            const meeting = meetData.meeting;

            for (const doc of meeting.documents || []) {
              results.push({
                id: `notubiz-doc-${doc.id}`,
                score: matchScore * 2,
                name: doc.title || title,
                url: `https://api.notubiz.nl/document/${doc.id}/${doc.version || 1}`,
                date: dateStr,
                organization: gemeentenaam,
                description: `Vergaderdocument: ${title}`,
                source: "notubiz",
                meetingId,
              });
            }

            for (const item of meeting.agenda_items || []) {
              const itemAttrs = item.attributes || [];
              const itemTitle = itemAttrs.find((a: any) => a.id === 1)?.value || "";
              const itemDesc = itemAttrs.find((a: any) => a.id === 3)?.value || "";
              const itemLower = (itemTitle + " " + itemDesc).toLowerCase();
              const itemMatch = terms.reduce(
                (sc: number, t: string) => sc + (itemLower.includes(t) ? 1 : 0),
                0,
              );

              if (itemMatch > 0 || matchScore >= 2) {
                for (const doc of item.documents || []) {
                  results.push({
                    id: `notubiz-doc-${doc.id}`,
                    score: (matchScore + itemMatch) * 2,
                    name: doc.title || itemTitle || title,
                    url: `https://api.notubiz.nl/document/${doc.id}/${doc.version || 1}`,
                    date: dateStr,
                    organization: gemeentenaam,
                    description: itemTitle
                      ? `Agendapunt: ${itemTitle}`
                      : `Vergadering: ${title}`,
                    source: "notubiz",
                    meetingId,
                    agendaItemTitle: itemTitle,
                  });
                }

                for (const subItem of item.agenda_items || []) {
                  for (const doc of subItem.documents || []) {
                    results.push({
                      id: `notubiz-doc-${doc.id}`,
                      score: matchScore + itemMatch,
                      name: doc.title || itemTitle,
                      url: `https://api.notubiz.nl/document/${doc.id}/${doc.version || 1}`,
                      date: dateStr,
                      organization: gemeentenaam,
                      description: `Subagendapunt bij: ${itemTitle}`,
                      source: "notubiz",
                      meetingId,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error fetching meeting ${meetingId}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("Notubiz events error:", e);
      break;
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).sort((a, b) => b.score - a.score);
}

/* ── CVDR (Centrale Voorziening Decentrale Regelgeving) via overheid.nl SRU ── */

async function searchCVDR(gemeentenaam: string) {
  try {
    // CVDR uses dcterms.creator for the municipality name (not "gemeente" index)
    const query = encodeURIComponent(
      `dcterms.creator="${gemeentenaam}" AND dcterms.title any "soft-drugs coffeeshop softdrugs cannabis gedoog drugs opium hennep damocles"`
    );
    const url = `https://zoekservice.overheid.nl/sru/Search?version=2.0&operation=searchRetrieve&x-connection=cvdr&query=${query}&maximumRecords=5&sortKeys=dcterms.modified,,0`;

    console.log(`Searching CVDR for: ${gemeentenaam}`);
    const res = await fetchWithTimeout(url, undefined, 6000);
    const xml = await res.text();
    
    if (!xml.includes('<numberOfRecords>')) {
      console.error("CVDR: no valid response");
      return [];
    }
    const results: any[] = [];

    const numMatch = xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/);
    const numRecords = numMatch ? parseInt(numMatch[1]) : 0;
    console.log(`CVDR returned ${numRecords} records`);
    if (numRecords === 0) return [];

    const recordBlocks = xml.split('<record>').slice(1);
    for (const block of recordBlocks) {
      const getTag = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
        return m ? m[1].trim() : null;
      };

      const title = getTag('dcterms:title') || "Beleidsregel coffeeshop";
      const identifier = getTag('dcterms:identifier');
      const modified = getTag('dcterms:modified');
      const subject = getTag('dcterms:subject');

      const regelingUrl = identifier
        ? `https://lokaleregelgeving.overheid.nl/${identifier}`
        : null;

      results.push({
        id: `cvdr-${identifier || Math.random().toString(36).slice(2)}`,
        score: 25,
        name: `${title} (geldend)`,
        url: regelingUrl,
        date: modified,
        organization: gemeentenaam,
        description: subject ? `Geldende beleidsregel — ${subject}` : 'Geldende beleidsregel',
        source: "lokaleregelgeving",
      });
    }

    return results;
  } catch (e) {
    console.error("CVDR search error:", e);
    return [];
  }
}

/* ── Officiële Bekendmakingen (open.overheid.nl) via SRU ── */

async function searchOfficieleBekendmakingen(gemeentenaam: string) {
  try {
    // Only search Gemeenteblad for coffeeshop policy documents specifically
    const collections = [
      { type: "Gemeenteblad", query: `creator="${gemeentenaam}" AND dcterms.title any "coffeeshop coffeeshopbeleid gedoogbeleid softdrugs softdrugsbeleid cannabisbeleid damoclesbeleid" NOT dcterms.title any "exploitatievergunning verleend verlenging aanvraag omgevingsvergunning perceel"` },
    ];

    const allResults: any[] = [];

    await Promise.all(collections.map(async ({ connection, type, query }) => {
      try {
        const encoded = encodeURIComponent(query);
        const url = `https://zoek.officielebekendmakingen.nl/sru/Search?version=2.0&operation=searchRetrieve&query=${encoded}&maximumRecords=5&sortKeys=modified,,0`;

        console.log(`Searching Officiële Bekendmakingen (${type}) for: ${gemeentenaam}`);
        const res = await fetchWithTimeout(url, undefined, 8000);
        const xml = await res.text();

        const numMatch = xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/);
        const numRecords = numMatch ? parseInt(numMatch[1]) : 0;
        console.log(`Officiële Bekendmakingen (${type}): ${numRecords} records`);
        if (numRecords === 0) return;

        const recordBlocks = xml.split('<record>').slice(1);
        for (const block of recordBlocks) {
          const getTag = (tag: string) => {
            const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
            return m ? m[1].trim() : null;
          };
          const getAllTags = (tag: string) => {
            const matches = [...block.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g'))];
            return matches.map(m => m[1].trim());
          };

          const title = getTag('dcterms:title') || getTag('title') || `${type} coffeeshop`;
          const identifier = getTag('dcterms:identifier') || getTag('identifier');
          const modified = getTag('dcterms:modified') || getTag('dcterms:issued');
          const creator = getTag('dcterms:creator');
          const subjects = getAllTags('dcterms:subject');

          // Build URL from identifier (e.g. "gmb-2023-492164" -> full URL)
          const docUrl = identifier
            ? `https://zoek.officielebekendmakingen.nl/${identifier}.html`
            : null;

          // Skip Kamerstukken that leak through
          if (identifier && identifier.startsWith("kst-")) continue;
          
          // Skip individual permit decisions
          const titleLower = (title || "").toLowerCase();
          if (titleLower.includes("verleend") || titleLower.includes("exploitatievergunning") || titleLower.includes("omgevingsvergunning")) continue;

          const scoreBase = 20;
          
          // Recenter documenten scoren hoger — ouder dan 5 jaar krijgt lagere score
          let dateBonus = 0;
          if (modified) {
            const docYear = parseInt(modified.substring(0, 4));
            const currentYear = new Date().getFullYear();
            const age = currentYear - docYear;
            if (age <= 2) dateBonus = 5;
            else if (age <= 4) dateBonus = 2;
            else if (age > 7) dateBonus = -5;
          }

          allResults.push({
            id: `ob-${identifier || Math.random().toString(36).slice(2)}`,
            score: scoreBase + dateBonus,
            name: title,
            url: docUrl,
            date: modified,
            organization: creator || gemeentenaam,
            description: subjects.length > 0
              ? `${type}: ${subjects.slice(0, 3).join(', ')}`
              : `${type}`,
            source: "officielebekendmakingen",
          });
        }
      } catch (e) {
        console.error(`Officiële Bekendmakingen (${type}) error:`, e);
      }
    }));

    return allResults;
  } catch (e) {
    console.error("Officiële Bekendmakingen search error:", e);
    return [];
  }
}

/* ── Raadzaam (Spinque) ── */

const RAADZAAM_GEMEENTEN: Record<string, string> = {
  "amsterdam": "gemeenteamsterdam",
  "utrecht": "gemeenteutrecht",
};

async function searchRaadzaam(gemeentenaam: string, keywords: string) {
  const needle = gemeentenaam.toLowerCase().trim();
  const workspace = RAADZAAM_GEMEENTEN[needle];
  if (!workspace) return [];

  const query = encodeURIComponent(keywords || "coffeeshop");
  const url = `https://rest.spinque.com/4/${workspace}/api/raadzaam/e/search/p/q/${query}/results?config=production&count=15&offset=0`;

  try {
    console.log(`Searching Raadzaam for: ${gemeentenaam}`);
    const res = await fetchWithTimeout(url, undefined, 10000);
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const items = data.items || [];

    const results: any[] = [];
    for (const item of items) {
      const tuple = item.tuple?.[0];
      if (!tuple) continue;

      const attrs = tuple.attributes || {};
      const names = attrs["https://schema.org/name"] || [];
      const name = names[0] || "Onbekend raadsstuk";

      // Skip generic/irrelevant items
      const nameLower = name.toLowerCase();
      const genericTitles = ["vaststelling agenda", "vaststellen agenda", "termijnagenda", "algemeen", "mededelingen", "opening procedureel"];
      if (genericTitles.some(g => nameLower.startsWith(g))) continue;

      // Only keep results that mention coffeeshop-related terms
      const coffeeTerms = ["coffeeshop", "cannabis", "softdrug", "gedoog", "damocles", "opium", "hennep", "wiet"];
      const allText = names.join(" ").toLowerCase();
      if (!coffeeTerms.some(t => allText.includes(t))) continue;

      // Get date from agenda items
      const agendas = attrs.agenda || [];
      let latestDate: string | null = null;
      for (const ag of agendas) {
        const d = ag["https://schema.org/startDate"];
        if (d && (!latestDate || d > latestDate)) latestDate = d;
      }

      // Get document URL
      const docUrls = attrs["https://schema.org/url"] || [];
      let docUrl: string | null = null;
      // Find a suitable URL - prefer raadzaam links
      for (const u of docUrls) {
        if (typeof u === "string" && u.startsWith("http")) {
          docUrl = u;
          break;
        }
      }
      // Construct raadzaam link from item id
      const itemId = tuple.id || "";
      const slug = itemId.replace("https://amsterdam.nl/data/", "").replace(`https://${needle}.nl/data/`, "");
      if (!docUrl && slug) {
        docUrl = `https://raadzaam.${needle}.nl/document/${slug}`;
      }

      const types = attrs.type || [];
      const typeLabel = types[0]?.label || "";

      results.push({
        id: `raadzaam-${slug || Math.random().toString(36).slice(2)}`,
        score: (item.probability || 0) * 100 + 15,
        name,
        url: docUrl,
        date: latestDate,
        organization: gemeentenaam,
        description: typeLabel ? `Raadsstuk: ${typeLabel}` : "Raadsstuk",
        source: "raadzaam",
      });
    }

    console.log(`Raadzaam found ${results.length} documents`);
    return results;
  } catch (e) {
    console.error("Raadzaam search error:", e);
    return [];
  }
}

/* ── ORI ElasticSearch ── */

async function searchORI(gemeentenaam: string, keywords: string) {
  const searchTerms = keywords || "coffeeshop beleid maximum";
  const indexName = gemeentenaam
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 10);

  const esQuery = {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: searchTerms,
              fields: ["name^3", "text"],
              type: "best_fields",
              fuzziness: "AUTO",
            },
          },
        ],
        filter: [
          { wildcard: { _index: `ori_${indexName}*` } },
        ],
        should: [
          { range: { date: { gte: "now-3y", boost: 5 } } },
          { range: { date: { gte: "now-6y", boost: 2 } } },
        ],
      },
    },
    size: 15,
    _source: ["name", "url", "date", "organization", "description"],
    sort: [{ _score: "desc" }],
  };

  const response = await fetch(ORI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(esQuery),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("ORI API error:", response.status, errText);
    return { documents: [], total: 0 };
  }

  const data = await response.json();
  const hits = data.hits?.hits || [];
  const total = data.hits?.total?.value || 0;

  const documents = hits.map((hit: any) => ({
    id: hit._id,
    score: hit._score,
    name: hit._source?.name || "Onbekend document",
    url: hit._source?.url || null,
    date: hit._source?.date || null,
    organization: hit._source?.organization?.name || gemeentenaam,
    description: hit._source?.description || null,
    source: "ori",
  }));

  return { documents, total };
}

/* ── Main handler ── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gemeentenaam, keywords } = await req.json();

    if (!gemeentenaam) {
      return new Response(
        JSON.stringify({ error: "gemeentenaam is verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchTerms = keywords || "coffeeshop beleid maximum";

    console.log(`Searching for: ${gemeentenaam}, terms: ${searchTerms}`);

    // Run all searches in parallel
    const [oriResult, orgId, cvdrDocs, parlaeusResults, obDocs, raadzaamDocs] = await Promise.all([
      searchORI(gemeentenaam, searchTerms),
      findNotubizOrgId(gemeentenaam),
      searchCVDR(gemeentenaam),
      searchParlaeus(gemeentenaam, searchTerms),
      searchOfficieleBekendmakingen(gemeentenaam),
      searchRaadzaam(gemeentenaam, searchTerms),
    ]);

    let notubizDocs: NotubizResult[] = [];
    if (orgId) {
      console.log(`Found Notubiz org ID: ${orgId} for ${gemeentenaam}`);
      notubizDocs = await searchNotubizMeetings(orgId, searchTerms, gemeentenaam);
      console.log(`Notubiz found ${notubizDocs.length} documents`);
    } else {
      console.log(`No Notubiz org found for ${gemeentenaam}`);
    }

    console.log(`CVDR found ${cvdrDocs.length} beleidsregels`);
    console.log(`Parlaeus found ${parlaeusResults.length} documents`);
    console.log(`Officiële Bekendmakingen found ${obDocs.length} documents`);
    console.log(`Raadzaam found ${raadzaamDocs.length} documents`);

    // Merge: CVDR first, then Raadzaam, then OB, then Parlaeus, then Notubiz, then ORI
    const allDocs = [...cvdrDocs, ...raadzaamDocs, ...obDocs, ...parlaeusResults, ...notubizDocs, ...oriResult.documents];

    // Deduplicate by document name similarity
    const seen = new Set<string>();
    const merged = allDocs.filter((doc) => {
      const key = doc.name.toLowerCase().replace(/\s+/g, " ").trim().substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by relevance + recency
    merged.sort((a, b) => {
      const sourceBonus = (s: string) => {
        switch (s) {
          case "lokaleregelgeving": return 5;
          case "raadzaam": return 4.5;
          case "officielebekendmakingen": return 4;
          case "parlaeus": return 3;
          case "notubiz": return 1.5;
          default: return 0;
        }
      };
      const recencyBonus = (dateStr: string | null) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 0;
        const yearsAgo = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsAgo <= 3) return 10;
        if (yearsAgo <= 6) return 5;
        return 0;
      };
      return (b.score + sourceBonus(b.source) + recencyBonus(b.date)) - (a.score + sourceBonus(a.source) + recencyBonus(a.date));
    });

    const top = merged.slice(0, 20);

    console.log(
      `Total: ${merged.length} docs (${cvdrDocs.length} CVDR, ${raadzaamDocs.length} Raadzaam, ${obDocs.length} OB, ${parlaeusResults.length} Parlaeus, ${notubizDocs.length} Notubiz, ${oriResult.documents.length} ORI), returning ${top.length}`,
    );

    return new Response(
      JSON.stringify({
        documents: top,
        total: merged.length,
        gemeentenaam,
        notubizOrgId: orgId,
        sources: {
          lokaleregelgeving: cvdrDocs.length,
          raadzaam: raadzaamDocs.length,
          officielebekendmakingen: obDocs.length,
          parlaeus: parlaeusResults.length,
          notubiz: notubizDocs.length,
          ori: oriResult.documents.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("search-municipal-docs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

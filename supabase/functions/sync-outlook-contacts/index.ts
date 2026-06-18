import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID")!;
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET")!;

const FOLDER_NAME = "BCD Leden";
const NOTE_MARKER_RE = /\[bcd:(\d+)\]/;

interface MemberRow {
  id: number;
  data: Record<string, any>;
  member_type: string;
}

interface BoardEmail {
  id: string;
  naam: string;
  bond_email: string;
}

async function getAppToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`Token error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function graph(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph ${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function graphAll(token: string, path: string): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `https://graph.microsoft.com/v1.0${path}`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Graph paged ${url} -> ${res.status}: ${await res.text()}`);
    const json = await res.json();
    results.push(...(json.value || []));
    url = json["@odata.nextLink"] || null;
  }
  return results;
}

async function getVerifiedDomains(token: string): Promise<string[]> {
  const json = await graph(token, "/organization?$select=verifiedDomains");
  const org = json?.value?.[0];
  return (org?.verifiedDomains || [])
    .map((d: any) => (d.name || "").toLowerCase())
    .filter(Boolean);
}

async function getOrCreateFolder(token: string, upn: string): Promise<string> {
  const existing = await graph(
    token,
    `/users/${encodeURIComponent(upn)}/contactFolders?$filter=displayName eq '${FOLDER_NAME}'`
  );
  if (existing?.value?.length) return existing.value[0].id;
  const created = await graph(token, `/users/${encodeURIComponent(upn)}/contactFolders`, {
    method: "POST",
    body: JSON.stringify({ displayName: FOLDER_NAME }),
  });
  return created.id;
}

function buildContact(m: MemberRow) {
  const d = m.data || {};
  const naam: string = d.naam || d.bedrijfsnaam || `Lid ${m.id}`;
  const contactpersoon: string = d.contactpersoon || "";

  // Split contact person into first/last name
  let givenName = contactpersoon;
  let surname = "";
  if (contactpersoon.includes(" ")) {
    const parts = contactpersoon.trim().split(/\s+/);
    givenName = parts[0];
    surname = parts.slice(1).join(" ");
  }

  const emails: any[] = [];
  if (d.email) emails.push({ address: String(d.email).trim(), name: naam });

  const phones: string[] = [];
  if (d.telefoon) phones.push(String(d.telefoon).trim());
  if (d.mobiel) phones.push(String(d.mobiel).trim());

  const companyName: string = d.bedrijfsnaam || naam;
  const city: string = d.plaats || "";
  const street: string = d.adres || "";
  const postal: string = d.postcode || "";

  const category = m.member_type === "lead" ? "BCD Lead" : "BCD Lid";
  const notes = `[bcd:${m.id}] ${m.member_type === "lead" ? "Lead" : "Lid"} · ${companyName}${city ? " · " + city : ""}`;

  return {
    displayName: contactpersoon ? `${contactpersoon} (${companyName})` : companyName,
    givenName: givenName || companyName,
    surname,
    companyName,
    emailAddresses: emails,
    businessPhones: phones,
    businessAddress: {
      street,
      city,
      postalCode: postal,
      countryOrRegion: "Nederland",
    },
    personalNotes: notes,
    categories: [category],
    fileAs: companyName,
  };
}

function contactsEqual(existing: any, desired: any): boolean {
  const fields = [
    "displayName",
    "givenName",
    "surname",
    "companyName",
    "personalNotes",
    "fileAs",
  ];
  for (const f of fields) {
    if ((existing[f] || "") !== (desired[f] || "")) return false;
  }
  const ex = (existing.emailAddresses || []).map((e: any) => e.address?.toLowerCase()).sort();
  const de = (desired.emailAddresses || []).map((e: any) => e.address?.toLowerCase()).sort();
  if (JSON.stringify(ex) !== JSON.stringify(de)) return false;
  const ep = (existing.businessPhones || []).sort();
  const dp = (desired.businessPhones || []).sort();
  if (JSON.stringify(ep) !== JSON.stringify(dp)) return false;
  return true;
}

async function syncForUser(
  token: string,
  upn: string,
  members: MemberRow[]
): Promise<{ created: number; updated: number; deleted: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };
  const folderId = await getOrCreateFolder(token, upn);

  const existing = await graphAll(
    token,
    `/users/${encodeURIComponent(upn)}/contactFolders/${folderId}/contacts?$top=100&$select=id,displayName,givenName,surname,companyName,emailAddresses,businessPhones,personalNotes,fileAs,categories`
  );

  // Map existing by member_id from personalNotes marker
  const byMember = new Map<number, any>();
  const orphans: any[] = [];
  for (const c of existing) {
    const match = NOTE_MARKER_RE.exec(c.personalNotes || "");
    if (match) {
      byMember.set(parseInt(match[1], 10), c);
    } else {
      orphans.push(c);
    }
  }

  const desiredIds = new Set(members.map((m) => m.id));

  for (const m of members) {
    const desired = buildContact(m);
    const ex = byMember.get(m.id);
    try {
      if (!ex) {
        await graph(
          token,
          `/users/${encodeURIComponent(upn)}/contactFolders/${folderId}/contacts`,
          { method: "POST", body: JSON.stringify(desired) }
        );
        stats.created++;
      } else if (!contactsEqual(ex, desired)) {
        await graph(token, `/users/${encodeURIComponent(upn)}/contacts/${ex.id}`, {
          method: "PATCH",
          body: JSON.stringify(desired),
        });
        stats.updated++;
      }
    } catch (e) {
      stats.errors.push(`member ${m.id}: ${(e as Error).message}`);
    }
  }

  // Delete contacts that no longer correspond to a member
  for (const [mid, c] of byMember.entries()) {
    if (!desiredIds.has(mid)) {
      try {
        await graph(token, `/users/${encodeURIComponent(upn)}/contacts/${c.id}`, {
          method: "DELETE",
        });
        stats.deleted++;
      } catch (e) {
        stats.errors.push(`delete ${mid}: ${(e as Error).message}`);
      }
    }
  }

  return stats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const startedAt = new Date().toISOString();
  const logRow: Record<string, any> = {
    started_at: startedAt,
    status: "running",
    trigger: "unknown",
    details: {},
  };

  try {
    const body = await req.json().catch(() => ({}));
    logRow.trigger = body?.trigger || "manual";

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      throw new Error("Missing MS_GRAPH_* secrets");
    }

    const token = await getAppToken();
    const domains = await getVerifiedDomains(token);

    const { data: board, error: boardErr } = await supabase
      .from("board_members")
      .select("id, naam, bond_email")
      .not("bond_email", "is", null);
    if (boardErr) throw boardErr;

    const targets: BoardEmail[] = (board || []).filter((b: any) => {
      const e = (b.bond_email || "").toLowerCase().trim();
      if (!e || !e.includes("@")) return false;
      const dom = e.split("@")[1];
      return domains.includes(dom);
    });

    const { data: members, error: memErr } = await supabase
      .from("members_data")
      .select("id, data, member_type")
      .in("member_type", ["member", "lead"]);
    if (memErr) throw memErr;

    const perUser: Record<string, any> = {};
    for (const b of targets) {
      try {
        perUser[b.bond_email] = await syncForUser(token, b.bond_email, members as MemberRow[]);
      } catch (e) {
        perUser[b.bond_email] = { error: (e as Error).message };
      }
    }

    logRow.status = "success";
    logRow.details = { domains, target_count: targets.length, member_count: members?.length || 0, per_user: perUser };
    logRow.finished_at = new Date().toISOString();
    await supabase.from("outlook_sync_log").insert(logRow);

    return new Response(JSON.stringify({ ok: true, ...logRow.details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logRow.status = "error";
    logRow.details = { error: (e as Error).message };
    logRow.finished_at = new Date().toISOString();
    try {
      await supabase.from("outlook_sync_log").insert(logRow);
    } catch (_) {
      // ignore log insert failures
    }
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
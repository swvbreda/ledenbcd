import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimConfirmations,
  DispatchPausedError,
  loadDispatchSettings,
  markConfirmations,
  type ConfirmationDb,
} from "../agendaConfirmations";

/* -------------------------------------------------------------------------
 * Nagebootste database. De poort gedraagt zich als de echte unieke index:
 * de controle-en-schrijfactie gebeurt in één ondeelbare stap, zodat parallelle
 * aanroepen samen nooit meer dan één claim kunnen winnen.
 * ---------------------------------------------------------------------- */

type Settings = {
  registration_sync_enabled: boolean;
  outlook_dispatch_enabled: boolean;
  confirmation_channel: string;
};

function makeDb(opts: {
  settings?: Settings | null;
  settingsError?: boolean;
  gate?: string[];
  events?: Record<string, unknown>[];
  registrations?: Record<string, unknown>[];
}) {
  const gate = new Set<string>(opts.gate ?? []);
  const ledger: { event_id: string; channel: string; email: string }[] = [];
  const marks: { emails: string[]; status: string }[] = [];
  const deletes: string[] = [];
  const updates: { table: string; values: Record<string, unknown> }[] = [];

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    await Promise.resolve();
    if (fn === "agenda_claim_confirmations") {
      const fresh: string[] = [];
      for (const raw of (args["_emails"] as string[]) ?? []) {
        const email = raw.trim().toLowerCase();
        const key = `${String(args["_event_id"])}|${email}`;
        if (gate.has(key)) continue; // ondeelbaar: geen await hiertussen
        gate.add(key);
        fresh.push(email);
        ledger.push({
          event_id: String(args["_event_id"]),
          channel: String(args["_channel"]),
          email,
        });
      }
      return { data: fresh.map((email) => ({ email })), error: null };
    }
    if (fn === "agenda_mark_confirmations") {
      marks.push({ emails: args["_emails"] as string[], status: String(args["_status"]) });
      return { data: 1, error: null };
    }
    return { data: null, error: null };
  };

  const builder = (table: string) => {
    const state: { values?: Record<string, unknown> } = {};
    const chain: Record<string, unknown> = {};
    const self = () => chain as never;
    const rowsFor = () =>
      table === "agenda_events"
        ? opts.events ?? []
        : table === "agenda_registrations"
          ? opts.registrations ?? []
          : [];

    Object.assign(chain, {
      select: () => self(),
      eq: () => self(),
      in: () => self(),
      is: () => self(),
      not: () => self(),
      gte: () => self(),
      insert: async () => ({ data: null, error: null }),
      update: (values: Record<string, unknown>) => {
        state.values = values;
        updates.push({ table, values });
        return self();
      },
      delete: () => {
        deletes.push(table);
        return self();
      },
      maybeSingle: async () => {
        if (table === "agenda_outlook_settings") {
          if (opts.settingsError) return { data: null, error: { message: "boom" } };
          return { data: opts.settings ?? null, error: null };
        }
        return { data: rowsFor()[0] ?? null, error: null };
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rowsFor(), error: null }).then(resolve),
    });
    return chain;
  };

  const db = {
    from: (table: string) => builder(table),
    rpc,
  };

  return { db: db as unknown as ConfirmationDb, gate, ledger, marks, deletes, updates };
}

const SETTINGS_OPEN: Settings = {
  registration_sync_enabled: true,
  outlook_dispatch_enabled: true,
  confirmation_channel: "email",
};

/* ----------------------------- schakelaars ----------------------------- */

describe("loadDispatchSettings (fail closed)", () => {
  it("weigert bij een databasefout", async () => {
    const { db } = makeDb({ settingsError: true });
    await expect(loadDispatchSettings(db)).rejects.toBeInstanceOf(DispatchPausedError);
  });

  it("weigert wanneer de instellingenregel ontbreekt", async () => {
    const { db } = makeDb({ settings: null });
    await expect(loadDispatchSettings(db)).rejects.toMatchObject({ reason: "settings_missing" });
  });

  it("valt terug op e-mail als bevestigingskanaal", async () => {
    const { db } = makeDb({ settings: { ...SETTINGS_OPEN, confirmation_channel: "" } });
    await expect(loadDispatchSettings(db)).resolves.toMatchObject({
      confirmationChannel: "email",
      dispatchEnabled: true,
    });
  });

  it("leest een ontbrekende schakelaar als uit", async () => {
    const { db } = makeDb({
      settings: {
        ...SETTINGS_OPEN,
        outlook_dispatch_enabled: null as unknown as boolean,
      },
    });
    await expect(loadDispatchSettings(db)).resolves.toMatchObject({ dispatchEnabled: false });
  });
});

/* ------------------------------ de poort ------------------------------- */

describe("gedeelde bevestigingspoort", () => {
  it("laat parallelle aanvragen samen hooguit één claim winnen", async () => {
    const { db } = makeDb({ settings: SETTINGS_OPEN });
    const args = { eventId: "ev-1", emails: ["Job@Example.NL"], source: "t" };
    const [a, b, c] = await Promise.all([
      claimConfirmations(db, { ...args, channel: "email" }),
      claimConfirmations(db, { ...args, channel: "outlook" }),
      claimConfirmations(db, { ...args, channel: "email" }),
    ]);
    expect([...a, ...b, ...c]).toEqual(["job@example.nl"]);
  });

  it("blokkeert het andere kanaal nadat één kanaal geclaimd heeft", async () => {
    const { db, ledger } = makeDb({ settings: SETTINGS_OPEN });
    const viaEmail = await claimConfirmations(db, {
      eventId: "ev-1",
      channel: "email",
      emails: ["job@example.nl"],
      source: "mail",
    });
    const viaOutlook = await claimConfirmations(db, {
      eventId: "ev-1",
      channel: "outlook",
      emails: ["JOB@example.nl"],
      source: "agenda",
    });
    expect(viaEmail).toEqual(["job@example.nl"]);
    expect(viaOutlook).toEqual([]);
    // Kanaalgeschiedenis blijft bewaard voor het kanaal dat daadwerkelijk claimde.
    expect(ledger).toEqual([{ event_id: "ev-1", channel: "email", email: "job@example.nl" }]);
  });

  it("markeert een onzekere aflevering zonder de claim te verwijderen", async () => {
    const { db, gate, marks, deletes } = makeDb({ settings: SETTINGS_OPEN });
    await claimConfirmations(db, {
      eventId: "ev-1",
      channel: "outlook",
      emails: ["job@example.nl"],
      source: "agenda",
    });
    await markConfirmations(db, {
      eventId: "ev-1",
      emails: ["job@example.nl"],
      status: "uncertain",
      note: "timeout",
    });
    expect(marks).toEqual([{ emails: ["job@example.nl"], status: "uncertain" }]);
    expect(gate.has("ev-1|job@example.nl")).toBe(true);
    expect(deletes).toEqual([]);
    // En een volgende poging krijgt niets meer.
    const again = await claimConfirmations(db, {
      eventId: "ev-1",
      channel: "outlook",
      emails: ["job@example.nl"],
      source: "agenda",
    });
    expect(again).toEqual([]);
  });
});

/* ------------------------------- routes -------------------------------- */

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const EVENT = {
  id: EVENT_ID,
  title: "Experiment bijeenkomst",
  description: "",
  event_type: "evenement",
  event_date: "2026-10-01",
  start_time: "10:00:00",
  end_time: "12:00:00",
  location: null,
  cancelled_at: null,
  outlook_event_id: "AAMk-bestaand",
};

const REGISTRATIONS = [
  {
    id: "reg-1",
    member_id: null,
    board_member_id: null,
    attendee_names: ["Job Joris Arnold"],
    contact_name: "Job Joris Arnold",
    contact_email: "job@example.nl",
  },
];

type GraphCall = { method: string; url: string };

function installFetch(graphCalls: GraphCall[]) {
  const fetchMock = vi.fn(async (input: unknown, init?: { method?: string }) => {
    const url = String(input);
    if (url.includes("login.microsoftonline.com")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    graphCalls.push({ method: init?.method ?? "GET", url });
    return new Response(JSON.stringify({ id: "nieuw-id" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function callSync(
  db: unknown,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
  const mod = await import("@/routes/api/public/agenda-outlook-sync");
  const handler = (
    mod.Route as unknown as {
      options: { server: { handlers: { POST: (c: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.POST;
  const res = await handler({
    request: new Request("https://x/api/public/agenda-outlook-sync", {
      method: "POST",
      headers: { "x-internal-secret": "geheim", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function callBackfill(
  db: unknown,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
  const mod = await import("@/routes/api/public/agenda-outlook-backfill");
  const handler = (
    mod.Route as unknown as {
      options: { server: { handlers: { POST: (c: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.POST;
  const res = await handler({
    request: new Request("https://x/api/public/agenda-outlook-backfill", {
      method: "POST",
      headers: { "x-internal-secret": "geheim", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe("agenda-outlook-routes", () => {
  let graphCalls: GraphCall[];

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    graphCalls = [];
    installFetch(graphCalls);
    process.env["INTERNAL_WEBHOOK_SECRET"] = "geheim";
    process.env["MS_GRAPH_TENANT_ID"] = "t";
    process.env["MS_GRAPH_CLIENT_ID"] = "c";
    process.env["MS_GRAPH_CLIENT_SECRET"] = "s";
    process.env["AGENDA_OUTLOOK_MAILBOX"] = "secretariaat@example.nl";
  });

  const baseDb = (settings: Settings | null, extra: { gate?: string[] } = {}) =>
    makeDb({
      settings,
      events: [EVENT],
      registrations: REGISTRATIONS,
      gate: extra.gate ?? [],
    });

  it("doet niets bij de globale pauze", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, outlook_dispatch_enabled: false });
    const res = await callSync(db, { event_id: EVENT_ID, action: "attendees" });
    expect(res.json["skipped"]).toBe("dispatch_paused");
    expect(graphCalls).toEqual([]);
  });

  it("faalt dicht bij een databasefout op de instellingen", async () => {
    const { db } = makeDb({ settingsError: true, events: [EVENT], registrations: REGISTRATIONS });
    const res = await callSync(db, { event_id: EVENT_ID, action: "sync" });
    expect(res.json["skipped"]).toBe("settings_unavailable");
    expect(graphCalls).toEqual([]);
  });

  it("raakt een bestaande afspraak niet aan bij een routinecontrole", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, confirmation_channel: "outlook" });
    await callSync(db, { event_id: EVENT_ID, action: "sync" });
    expect(graphCalls.filter((c) => ["PATCH", "POST", "DELETE"].includes(c.method))).toEqual([]);
  });

  it("stuurt geen agenda-uitnodiging wanneer e-mail het bevestigingskanaal is", async () => {
    const { db, marks } = baseDb(SETTINGS_OPEN);
    await callSync(db, { event_id: EVENT_ID, action: "attendees" });
    expect(graphCalls.filter((c) => c.url.includes("/forward"))).toEqual([]);
    expect(marks).toEqual([]);
  });

  it("nodigt bij een aanmelding alleen nieuwe deelnemers uit", async () => {
    const { db, marks } = baseDb({ ...SETTINGS_OPEN, confirmation_channel: "outlook" });
    await callSync(db, { event_id: EVENT_ID, action: "attendees" });
    const forwards = graphCalls.filter((c) => c.url.includes("/forward"));
    expect(forwards).toHaveLength(1);
    expect(marks).toEqual([{ emails: ["job@example.nl"], status: "sent" }]);
    expect(graphCalls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("doet niets meer voor wie al bevestigd is", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, confirmation_channel: "outlook" }, {
      gate: [`${EVENT_ID}|job@example.nl`],
    });
    await callSync(db, { event_id: EVENT_ID, action: "attendees" });
    expect(graphCalls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("houdt de claim vast wanneer Microsoft een fout geeft", async () => {
    const { db, gate, marks, deletes } = baseDb({
      ...SETTINGS_OPEN,
      confirmation_channel: "outlook",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("login.microsoftonline.com")) {
          return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        }
        if (url.includes("/forward")) return new Response("timeout", { status: 504 });
        return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      }),
    );
    const res = await callSync(db, { event_id: EVENT_ID, action: "attendees" });
    expect(res.status).toBe(500);
    expect(gate.has(`${EVENT_ID}|job@example.nl`)).toBe(true);
    expect(marks).toEqual([{ emails: ["job@example.nl"], status: "uncertain" }]);
    expect(deletes).toEqual([]);
  });

  it("de backfill verwijdert of herbouwt nooit een bestaande afspraak", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, confirmation_channel: "outlook" });
    await callBackfill(db, {});
    expect(graphCalls.some((c) => c.method === "DELETE")).toBe(false);
    expect(
      graphCalls.some((c) => c.method === "POST" && !c.url.includes("/forward")),
    ).toBe(false);
  });

  it("de backfill doet nul schrijfacties als iedereen al bevestigd is", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, confirmation_channel: "outlook" }, {
      gate: [`${EVENT_ID}|job@example.nl`],
    });
    const res = await callBackfill(db, {});
    expect(graphCalls).toEqual([]);
    expect(res.json["ok"]).toBe(true);
  });

  it("de backfill stopt bij de globale pauze", async () => {
    const { db } = baseDb({ ...SETTINGS_OPEN, outlook_dispatch_enabled: false });
    const res = await callBackfill(db, {});
    expect(res.json["skipped"]).toBe("dispatch_paused");
    expect(graphCalls).toEqual([]);
  });
});

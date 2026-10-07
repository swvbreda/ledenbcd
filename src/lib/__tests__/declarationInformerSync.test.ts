import { describe, expect, it } from "vitest";
import {
  authorizeDeclarationCall,
  declarationReference,
  redactApiCalls,
  redactSensitive,
  runDeclarationSync,
  type DeclarationStore,
  type InformerPort,
} from "../../../supabase/functions/informer-sync/declarationSync";

const ID = "11111111-2222-3333-4444-555555555555";
const IBAN = "NL91ABNA0417164300";

function baseDecl(over: Record<string, unknown> = {}) {
  return {
    id: ID, year: 2026, status: "pending", submitted_by: "user-1", board_member_id: "bm-1",
    board_member_name: "Test Bestuurder", declaration_type: "reiskosten", appointment: "Vergadering",
    amount: 10.42, bank_account: IBAN, account_holder: "Test Bestuurder", expense_date: "2026-10-01",
    informer_status: "not_sent", informer_external_id: null, informer_error: null, ...over,
  };
}

// In-memory store met dezelfde atomische claimregels als de database-adapter.
function fakeStore(initial: any) {
  const row = { ...initial };
  const todos: string[] = [];
  let resolved = 0;
  const store: DeclarationStore = {
    async load() { return { ...row }; },
    async claim(_id, retry) {
      const ok = retry ? ["not_sent", "queued", "error"].includes(row.informer_status) : ["not_sent", "queued"].includes(row.informer_status);
      if (!ok) return false;
      row.informer_status = "sending";
      row.informer_error = null;
      return true;
    },
    async markSent(_id, doc) { row.informer_status = "sent"; row.informer_external_id = doc; row.informer_error = null; },
    async markError(_id, msg) { if (row.informer_status === "sending") { row.informer_status = "error"; row.informer_error = msg; } },
    async markInvalid(_id, msg) { row.informer_status = "error"; row.informer_error = msg; },
    async recordTodo(_id, msg) { todos.push(msg); },
    async resolveTodo() { resolved++; },
  };
  return { store, row, todos, get resolved() { return resolved; } };
}

function fakeInformer(opts: { existing?: string | null; fail?: string } = {}) {
  const calls = { find: [] as string[], create: 0 };
  let existing = opts.existing ?? null;
  let fail = opts.fail;
  const port: InformerPort = {
    async findByReference(ref) { calls.find.push(ref); return existing; },
    async createPurchase() {
      calls.create++;
      if (fail) throw new Error(fail);
      existing = "INF-900"; // na aanmaken vindbaar op referentie
      return "INF-900";
    },
  };
  return { port, calls, heal() { fail = undefined; }, setExisting(v: string) { existing = v; } };
}

describe("declaratie naar Informer", () => {
  it("1. eerste verzending: claim, één create, status sent + document-id", async () => {
    const s = fakeStore(baseDecl());
    const inf = fakeInformer();
    const r = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(r.success).toBe(true);
    expect(inf.calls.find).toEqual([`DECL-${ID.toUpperCase()}`]);
    expect(inf.calls.create).toBe(1);
    expect(s.row.informer_status).toBe("sent");
    expect(s.row.informer_external_id).toBe("INF-900");
    expect(s.row.status).toBe("pending");
  });

  it("1b. dubbelklik / gelijktijdige aanroep maakt maximaal één document", async () => {
    const s = fakeStore(baseDecl());
    const inf = fakeInformer();
    const [a, b] = await Promise.all([
      runDeclarationSync(ID, { retry: false }, s.store, inf.port),
      runDeclarationSync(ID, { retry: false }, s.store, inf.port),
    ]);
    expect([a.success, b.success].filter(Boolean).length).toBe(1);
    expect(inf.calls.create).toBe(1);
  });

  it("2. bestaand document met DECL-referentie: geen create, id opgeslagen", async () => {
    const s = fakeStore(baseDecl());
    const inf = fakeInformer({ existing: "INF-123" });
    const r = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(r.success).toBe(true);
    expect(r.details.reused_existing).toBe(true);
    expect(inf.calls.create).toBe(0);
    expect(s.row.informer_external_id).toBe("INF-123");
    expect(s.row.informer_status).toBe("sent");
  });

  it("3. Informer-fout: status error, declaratie blijft ingediend, geen IBAN/token/base64 in fout", async () => {
    const b64 = "JVBERi0xLjQK".padEnd(200, "A");
    const s = fakeStore(baseDecl());
    const inf = fakeInformer({ fail: `HTTP 500 iban=${IBAN} Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF pdf=${b64}` });
    const r = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(r.success).toBe(false);
    expect(s.row.informer_status).toBe("error");
    expect(s.row.status).toBe("pending");
    for (const text of [s.row.informer_error, r.error_message, s.todos[0]]) {
      expect(text).not.toContain(IBAN);
      expect(text).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(text).not.toContain(b64);
    }
    expect(s.row.informer_error).toContain("[IBAN]");
  });

  it("4. retry na error: opnieuw zoeken, maximaal één document", async () => {
    const s = fakeStore(baseDecl());
    const inf = fakeInformer({ fail: "tijdelijke storing" });
    await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(s.row.informer_status).toBe("error");

    // Zonder retry-recht mag een error-status niet opnieuw geclaimd worden.
    const noRetry = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(noRetry.success).toBe(false);
    expect(inf.calls.create).toBe(1);

    inf.heal();
    const r = await runDeclarationSync(ID, { retry: true }, s.store, inf.port);
    expect(r.success).toBe(true);
    expect(inf.calls.find.length).toBe(2);
    expect(inf.calls.create).toBe(2); // 1 mislukte poging + 1 geslaagde = één document
    expect(s.row.informer_status).toBe("sent");

    // Nog een retry: al verzonden, geen nieuwe create.
    await runDeclarationSync(ID, { retry: true }, s.store, inf.port);
    expect(inf.calls.create).toBe(2);
  });

  it("4b. retry nadat de eerste create toch in Informer landde: hergebruik, geen tweede document", async () => {
    const s = fakeStore(baseDecl());
    const inf = fakeInformer({ fail: "timeout" });
    await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    inf.setExisting("INF-LOST"); // document bleek wel aangemaakt
    const r = await runDeclarationSync(ID, { retry: true }, s.store, inf.port);
    expect(r.details.reused_existing).toBe(true);
    expect(inf.calls.create).toBe(1);
    expect(s.row.informer_external_id).toBe("INF-LOST");
  });

  it("ontbrekende bon bij overige kosten: geen Informer-aanroep", async () => {
    const s = fakeStore(baseDecl({ declaration_type: "overig", receipt_path: null, receipt_paths: [] }));
    const inf = fakeInformer();
    const r = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(r.success).toBe(false);
    expect(inf.calls.find.length + inf.calls.create).toBe(0);
  });

  it("concept wordt niet verstuurd", async () => {
    const s = fakeStore(baseDecl({ status: "concept" }));
    const inf = fakeInformer();
    const r = await runDeclarationSync(ID, { retry: false }, s.store, inf.port);
    expect(r.success).toBe(false);
    expect(s.row.informer_status).toBe("not_sent");
    expect(inf.calls.create).toBe(0);
  });
});

describe("toegang tot verzenden", () => {
  const own = { submitted_by: "user-1", informer_status: "not_sent", status: "pending" };
  it("5a. niet ingelogd: 401", () => {
    expect(authorizeDeclarationCall({ userId: null, isAdminOrTreasurer: false, isServiceCall: false }, own, false).status).toBe(401);
  });
  it("5b. andere gebruiker: 403", () => {
    expect(authorizeDeclarationCall({ userId: "user-2", isAdminOrTreasurer: false, isServiceCall: false }, own, false).status).toBe(403);
  });
  it("5c. indiener mag geen retry en niet na error", () => {
    const u = { userId: "user-1", isAdminOrTreasurer: false, isServiceCall: false };
    expect(authorizeDeclarationCall(u, own, true).allowed).toBe(false);
    expect(authorizeDeclarationCall(u, { ...own, informer_status: "error" }, false).allowed).toBe(false);
    expect(authorizeDeclarationCall(u, { ...own, status: "concept" }, false).allowed).toBe(false);
  });
  it("5d. indiener mag eerste verzending; admin/penningmeester mag retry", () => {
    expect(authorizeDeclarationCall({ userId: "user-1", isAdminOrTreasurer: false, isServiceCall: false }, own, false)).toEqual({ allowed: true, status: 200, retry: false });
    expect(authorizeDeclarationCall({ userId: "admin", isAdminOrTreasurer: true, isServiceCall: false }, { ...own, informer_status: "error" }, true)).toEqual({ allowed: true, status: 200, retry: true });
  });
});

describe("redactie", () => {
  it("api_calls bevatten geen bodies of headers", () => {
    const out = redactApiCalls([{ ts: "t", method: "POST", url: "/x", status: 200, ok: true, request_body: { pdf: "AAAA", iban: IBAN }, response_body: { iban: IBAN }, response_headers: { a: "b" } }]);
    expect(JSON.stringify(out)).not.toContain(IBAN);
    expect(JSON.stringify(out)).not.toContain("pdf");
  });
  it("referentie is vast per declaratie-id", () => {
    expect(declarationReference({ id: ID })).toBe(`DECL-${ID.toUpperCase()}`);
    expect(redactSensitive(`NL91 ABNA 0417 1643 00`)).toBe("[IBAN]");
  });
});

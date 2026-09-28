import { describe, expect, it, vi } from "vitest";
import {
  buildParticipantRecipients,
  runParticipantMail,
  type MailDeps,
  type RecipientResult,
} from "./agendaParticipantMail";

const EVENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const B1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const scoped = (): RecipientResult =>
  buildParticipantRecipients({
    registrations: [
      { id: "r1", member_id: 7, board_member_id: null, contact_email: " Piet@Shop.NL ", contact_name: "Piet" },
      { id: "r2", member_id: 8, board_member_id: null, contact_email: null, contact_name: "Klaas" },
      { id: "r3", member_id: null, board_member_id: "bm1", contact_email: null, contact_name: null },
      { id: "r4", member_id: 9, board_member_id: null, contact_email: "piet@shop.nl", contact_name: "Dubbel" },
      { id: "r5", member_id: 10, board_member_id: null, contact_email: null, contact_name: "Zonder" },
      { id: "r6", member_id: 11, board_member_id: null, contact_email: "kapot@", contact_name: "Fout" },
    ],
    guests: [
      { id: "g1", naam: "Gast", email: "gast@x.nl", status: "nieuw" },
      { id: "g2", naam: "Weg", email: "weg@x.nl", status: "geweigerd" },
      { id: "g3", naam: "Af", email: "af@x.nl", status: "afgemeld" },
    ],
    emailByMember: new Map([[8, "klaas@leden.nl"], [7, "niet-gebruiken@x.nl"]]),
    emailByBoard: new Map([["bm1", "bestuur@coffeeshopbond.nl"]]),
    nameByBoard: new Map([["bm1", "Bestuurder"]]),
  });

describe("buildParticipantRecipients", () => {
  it("neemt leden, bestuur en gasten van dit event, registratieadres eerst, dedupe en normaliseert", () => {
    const r = scoped();
    expect(r.recipients.map((x) => x.email)).toEqual([
      "bestuur@coffeeshopbond.nl",
      "gast@x.nl",
      "klaas@leden.nl",
      "piet@shop.nl",
    ]);
    expect(r.recipients.find((x) => x.email === "bestuur@coffeeshopbond.nl")?.sources).toEqual(["bestuur"]);
    expect(r.recipients.some((x) => x.email === "niet-gebruiken@x.nl")).toBe(false);
  });
  it("sluit geweigerde/afgemelde gasten uit en toont ontbrekend/ongeldig", () => {
    const r = scoped();
    expect(r.excluded).toBe(2);
    expect(r.recipients.some((x) => x.email === "weg@x.nl" || x.email === "af@x.nl")).toBe(false);
    expect(r.missing).toEqual([
      { naam: "Zonder", source: "lid", reason: "missing" },
      { naam: "Fout", source: "lid", reason: "invalid", value: "kapot@" },
    ]);
  });
});

/** In-memory mock van database + verzending; er gaat geen echte mail uit. */
function mockDeps(opts: { admin?: boolean; failOnce?: string[] } = {}) {
  const batches = new Map<string, { event_id: string; subject: string; body: string }>();
  const sends = new Map<string, string>(); // `${batch}|${email}` -> status
  const failOnce = new Set(opts.failOnce ?? []);
  const sent: { email: string; key: string; subject: string }[] = [];
  const deps: MailDeps = {
    isAdmin: async () => opts.admin !== false,
    loadEvent: async (id) => (id === EVENT || id === OTHER ? { id, title: "Ledenvergadering" } : null),
    loadRecipients: async () => scoped(),
    getBatch: async (id) => batches.get(id) ?? null,
    createBatch: async (b) => void batches.set(b.id, b),
    claim: async (batch, _e, emails) =>
      emails.filter((e) => {
        const s = sends.get(`${batch}|${e}`);
        if (s === undefined || s === "failed") {
          sends.set(`${batch}|${e}`, "claimed");
          return true;
        }
        return false;
      }),
    send: vi.fn(async (a) => {
      if (failOnce.delete(a.email)) return { status: "failed" as const };
      if (a.email === "gast@x.nl") return { status: "skipped" as const, note: "email_suppressed" };
      sent.push({ email: a.email, key: a.idempotencyKey, subject: a.subject });
      return { status: "sent" as const };
    }),
    mark: async (b, e, o) => void sends.set(`${b}|${e}`, o.status),
    listStatuses: async (b) =>
      [...sends.entries()]
        .filter(([k]) => k.startsWith(`${b}|`))
        .map(([k, status]) => ({ email: k.split("|")[1], status })),
  };
  return { deps, sent };
}

const input = (batchId = B1, subject = "Info", body = "Tot zo") => ({ eventId: EVENT, batchId, subject, body });

describe("runParticipantMail", () => {
  it("weigert niet-beheerders zonder iets te versturen", async () => {
    const { deps, sent } = mockDeps({ admin: false });
    await expect(runParticipantMail(deps, input())).rejects.toThrow("Geen rechten");
    expect(sent).toHaveLength(0);
  });

  it("verstuurt één mail per adres met idempotency key per verzending+adres", async () => {
    const { deps, sent } = mockDeps();
    const r = await runParticipantMail(deps, input());
    expect(r).toMatchObject({ total: 4, sent: 3, skipped: 1, failed: 0 });
    expect(sent.map((s) => s.key)).toContain(`agenda-mail-${B1}-piet@shop.nl`);
  });

  it("dubbelklik/herhaling met dezelfde verzending stuurt niets dubbel", async () => {
    const { deps, sent } = mockDeps();
    await Promise.all([runParticipantMail(deps, input()), runParticipantMail(deps, input())]);
    const again = await runParticipantMail(deps, input());
    expect(sent).toHaveLength(3);
    expect(again).toMatchObject({ sent: 0, alreadyDone: 4 });
  });

  it("herhalen verstuurt alleen mislukte, met het oorspronkelijke bericht", async () => {
    const { deps, sent } = mockDeps({ failOnce: ["klaas@leden.nl"] });
    const first = await runParticipantMail(deps, input());
    expect(first.failedEmails).toEqual(["klaas@leden.nl"]);
    const retry = await runParticipantMail(deps, input(B1, "ANDERS", "ANDERS"));
    expect(retry).toMatchObject({ sent: 1, failed: 0, alreadyDone: 3 });
    expect(sent.filter((s) => s.email === "klaas@leden.nl")).toEqual([
      { email: "klaas@leden.nl", key: `agenda-mail-${B1}-klaas@leden.nl`, subject: "Info" },
    ]);
  });

  it("een tweede, nieuw bericht voor hetzelfde event gaat wel weer naar iedereen", async () => {
    const { deps, sent } = mockDeps();
    await runParticipantMail(deps, input(B1));
    const r = await runParticipantMail(deps, input(B2, "Nieuw", "Tweede bericht"));
    expect(r.sent).toBe(3);
    expect(sent).toHaveLength(6);
  });

  it("weigert een bestaande verzending onder een ander evenement", async () => {
    const { deps } = mockDeps();
    await runParticipantMail(deps, input());
    await expect(runParticipantMail(deps, { ...input(), eventId: OTHER })).rejects.toThrow("ander evenement");
  });

  it("valideert onderwerp/tekst en ongeldige id's", async () => {
    const { deps } = mockDeps();
    await expect(runParticipantMail(deps, input(B1, "  ", "x"))).rejects.toThrow("onderwerp");
    await expect(runParticipantMail(deps, { ...input(), batchId: "x" })).rejects.toThrow("Ongeldige");
  });
});

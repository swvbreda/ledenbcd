import { describe, expect, it } from "vitest";
import {
  buildParticipantRecipients,
  interpretSendResponse,
  runParticipantMail,
  RecipientsChangedError,
  type BatchRow,
  type MailDeps,
  type RecipientResult,
  type SendOutcome,
  type SendRow,
} from "./agendaParticipantMail";

const EVENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const B2 = "44444444-4444-4444-8444-444444444444";

function recipients(emails: string[]): RecipientResult {
  return { recipients: emails.map((e) => ({ email: e, naam: e, sources: ["lid"] })), missing: [], excluded: 0 };
}

/** In-memory nabootsing van de SQL-functies (snapshot bij create, claim alleen pending/failed). */
function fake(opts: { admin?: boolean; emails: string[]; outcome?: (e: string) => SendOutcome }) {
  const state = {
    emails: [...opts.emails],
    batches: new Map<string, BatchRow>(),
    sends: new Map<string, SendRow>(),
    sent: [] as { email: string; key: string; subject: string }[],
    outcome: opts.outcome ?? (() => ({ status: "sent" }) as SendOutcome),
    failMark: false,
  };
  const k = (b: string, e: string) => `${b}|${e}`;
  const deps: MailDeps = {
    isAdmin: async () => opts.admin ?? true,
    loadEvent: async (id) => (id === EVENT || id === OTHER ? { id, title: "Evt" } : null),
    loadRecipients: async () => recipients(state.emails),
    createBatch: async (b, snap) => {
      if (state.batches.has(b.id)) return; // ON CONFLICT DO NOTHING
      state.batches.set(b.id, b);
      for (const r of snap) state.sends.set(k(b.id, r.email), { email: r.email, naam: r.naam, status: "pending", note: null });
    },
    getBatch: async (id) => state.batches.get(id) ?? null,
    claim: async (b, active) => {
      const out: string[] = [];
      for (const [key, row] of state.sends)
        if (key.startsWith(b + "|") && (row.status === "pending" || row.status === "failed") && active.includes(row.email)) {
          row.status = "claimed";
          out.push(row.email);
        }
      return out;
    },
    mark: async (b, e, o) => {
      if (state.failMark) throw new Error("Status vastleggen mislukt");
      const r = state.sends.get(k(b, e))!;
      r.status = o.status;
      r.note = o.note ?? null;
    },
    listStatuses: async (b) => [...state.sends].filter(([key]) => key.startsWith(b + "|")).map(([, r]) => r),
    send: async (a) => {
      state.sent.push({ email: a.email, key: a.idempotencyKey, subject: a.subject });
      return state.outcome(a.email);
    },
  };
  return { deps, state };
}

const msg = { subject: "Hallo", body: "Tekst" };

describe("ontvangers", () => {
  it("gasten, bestuur, afgemeld/geweigerd, duplicaten, ongeldig", () => {
    const r = buildParticipantRecipients({
      registrations: [
        { id: "r1", member_id: 1, board_member_id: null, contact_email: " A@x.nl ", contact_name: "A", attendee_names: [] },
        { id: "r2", member_id: null, board_member_id: "b1", contact_email: null, contact_name: null, attendee_names: [] },
        { id: "r3", member_id: 2, board_member_id: null, contact_email: "kapot", contact_name: "K", attendee_names: [] },
      ],
      guests: [
        { id: "g1", naam: "G", email: "a@x.nl", status: "approved" },
        { id: "g2", naam: "W", email: "w@x.nl", status: "rejected" },
        { id: "g3", naam: "C", email: "c@x.nl", status: "cancelled" },
        { id: "g4", naam: "N", email: "", status: "approved" },
      ],
      emailsByMember: new Map(),
      emailByBoard: new Map([["b1", "bestuur@bond.nl"]]),
      nameByBoard: new Map([["b1", "Bestuurder"]]),
    });
    expect(r.recipients.map((x) => x.email).sort()).toEqual(["a@x.nl", "bestuur@bond.nl"]);
    expect(r.recipients.find((x) => x.email === "a@x.nl")!.sources).toEqual(["lid", "gast"]);
    expect(r.excluded).toBe(2);
    expect(r.missing.map((m) => m.reason).sort()).toEqual(["invalid", "missing"]);
  });

  it("lid-terugval alleen bij één eenduidig geldig adres; meerdere → ambiguous", () => {
    const base = { id: "r", board_member_id: null, contact_email: null, contact_name: "L", attendee_names: [] };
    const r = buildParticipantRecipients({
      registrations: [
        { ...base, id: "r1", member_id: 1 },
        { ...base, id: "r2", member_id: 2 },
        { ...base, id: "r3", member_id: 3 },
      ],
      guests: [],
      emailsByMember: new Map([
        [1, ["een@x.nl", "EEN@x.nl ", "kapot"]],
        [2, ["a@x.nl", "b@x.nl"]],
        [3, []],
      ]),
      emailByBoard: new Map(),
    });
    expect(r.recipients.map((x) => x.email)).toEqual(["een@x.nl"]);
    expect(r.missing.map((m) => m.reason).sort()).toEqual(["ambiguous", "missing"]);
  });
});

describe("verzendresultaat eerlijk", () => {
  it("vertaalt antwoorden", () => {
    expect(interpretSendResponse({ success: true, sent: true }, null).status).toBe("sent");
    expect(interpretSendResponse({ success: true, queued: true }, null).status).toBe("accepted");
    expect(interpretSendResponse({ success: true }, null).status).toBe("accepted");
    expect(interpretSendResponse({ success: false, reason: "email_suppressed" }, null).status).toBe("skipped");
    expect(interpretSendResponse({ success: false, reason: "already_sent" }, null).status).toBe("sent");
    expect(interpretSendResponse({ success: false, reason: "x" }, null).status).toBe("failed");
    expect(interpretSendResponse(null, { status: 400 }).status).toBe("failed");
    expect(interpretSendResponse(null, { status: 502 }).status).toBe("failed");
    expect(interpretSendResponse(null, { status: 500 }).status).toBe("uncertain");
    expect(interpretSendResponse(null, { message: "network" }).status).toBe("uncertain");
    expect(interpretSendResponse({}, null).status).toBe("uncertain");
  });
});

describe("runParticipantMail", () => {
  it("non-admin geweigerd, niets verstuurd", async () => {
    const { deps, state } = fake({ admin: false, emails: ["a@x.nl"] });
    await expect(runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] })).rejects.toThrow("Geen toegang");
    expect(state.sent).toHaveLength(0);
  });

  it("preview wijkt af van actuele lijst → geen verzending", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl", "nieuw@x.nl"] });
    await expect(runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] })).rejects.toBeInstanceOf(RecipientsChangedError);
    expect(state.sent).toHaveLength(0);
    expect(state.batches.size).toBe(0);
  });

  it("dubbelklik/retry verstuurt niemand twee keer", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl", "b@x.nl"] });
    const input = { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl", "b@x.nl"] };
    await Promise.all([runParticipantMail(deps, input), runParticipantMail(deps, input)]);
    await runParticipantMail(deps, input);
    expect(state.sent.map((s) => s.email).sort()).toEqual(["a@x.nl", "b@x.nl"]);
  });

  it("retry: alleen oorspronkelijke mislukte; nieuw aangemelden niet; afgemelden uitgesloten", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl", "b@x.nl", "c@x.nl"], outcome: (e) => (e === "a@x.nl" ? { status: "sent" } : { status: "failed" }) });
    await runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl", "b@x.nl", "c@x.nl"] });
    state.outcome = () => ({ status: "sent" });
    state.emails = ["a@x.nl", "b@x.nl", "later@x.nl"]; // c afgemeld, later nieuw
    state.sent = [];
    const r = await runParticipantMail(deps, { batchId: B1, eventId: EVENT, subject: "", body: "" });
    expect(state.sent.map((s) => s.email)).toEqual(["b@x.nl"]);
    expect(r.noLongerParticipant).toEqual(["c@x.nl"]);
    expect(r.rows.map((x) => x.email)).not.toContain("later@x.nl");
  });

  it("race: canonieke opgeslagen tekst wint boven lokale tekst", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl"] });
    state.batches.set(B1, { id: B1, event_id: EVENT, subject: "Origineel", body: "O" });
    state.sends.set(`${B1}|a@x.nl`, { email: "a@x.nl", naam: "a", status: "pending", note: null });
    const r = await runParticipantMail(deps, { batchId: B1, eventId: EVENT, subject: "Anders", body: "X", expectedEmails: ["a@x.nl"] });
    expect(state.sent[0].subject).toBe("Origineel");
    expect(r.subject).toBe("Origineel");
  });

  it("createBatch-conflict (andere tekst al opgeslagen) → herlezen", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl"] });
    const orig = deps.createBatch;
    deps.getBatch = (() => {
      let n = 0;
      return async (id: string) => (n++ === 0 ? null : state.batches.get(id) ?? null);
    })();
    deps.createBatch = async (b, snap) => {
      await orig({ ...b, subject: "Winnaar" }, snap); // de andere klik won
      await orig(b, snap); // eigen insert: conflict, niets
    };
    await runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] });
    expect(state.sent[0].subject).toBe("Winnaar");
  });

  it("tweede bericht voor hetzelfde event wordt wel verstuurd; andere-event batch geweigerd", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl"] });
    await runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] });
    await runParticipantMail(deps, { batchId: B2, eventId: EVENT, subject: "Tweede", body: "T", expectedEmails: ["a@x.nl"] });
    expect(state.sent.map((s) => s.key)).toEqual([`agenda-mail-${B1}-a@x.nl`, `agenda-mail-${B2}-a@x.nl`]);
    await expect(runParticipantMail(deps, { batchId: B1, eventId: OTHER, ...msg })).rejects.toThrow("ander evenement");
  });

  it("accepted/uncertain tellen niet als verzonden en worden niet opnieuw geprobeerd", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl", "b@x.nl"], outcome: (e) => (e === "a@x.nl" ? { status: "accepted" } : { status: "uncertain" }) });
    const r = await runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl", "b@x.nl"] });
    expect([r.sent, r.accepted, r.uncertain, r.failedEmails.length]).toEqual([0, 1, 1, 0]);
    state.sent = [];
    await runParticipantMail(deps, { batchId: B1, eventId: EVENT, subject: "", body: "" });
    expect(state.sent).toHaveLength(0);
  });

  it("send-exceptie → uncertain; mark-fout wordt niet ingeslikt", async () => {
    const { deps, state } = fake({ emails: ["a@x.nl"] });
    deps.send = async () => { throw new Error("netwerk"); };
    const r = await runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] });
    expect(r.uncertain).toBe(1);
    const f = fake({ emails: ["a@x.nl"] });
    f.state.failMark = true;
    await expect(runParticipantMail(f.deps, { batchId: B1, eventId: EVENT, ...msg, expectedEmails: ["a@x.nl"] })).rejects.toThrow("Status vastleggen");
    expect(state.sent).toHaveLength(0);
  });

  it("ongeldige invoer / nieuwe batch zonder bevestigde ontvangers", async () => {
    const { deps } = fake({ emails: ["a@x.nl"] });
    await expect(runParticipantMail(deps, { batchId: "x", eventId: EVENT, ...msg })).rejects.toThrow();
    await expect(runParticipantMail(deps, { batchId: B1, eventId: EVENT, subject: "", body: "b", expectedEmails: [] })).rejects.toThrow();
    await expect(runParticipantMail(deps, { batchId: B1, eventId: EVENT, ...msg })).rejects.toThrow("Ontvangersbevestiging");
  });
});

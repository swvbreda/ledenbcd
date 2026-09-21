import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("aanmeldbevestiging wordt hooguit één keer verstuurd", () => {
  it("de Outlook-synchronisatie nodigt alleen nieuw geclaimde deelnemers uit", () => {
    const source = read("src/routes/api/public/agenda-outlook-sync.ts");
    expect(source).toContain("agenda_claim_invites");
    expect(source).toContain("skipped_no_new_attendees");
    // Bij een aanmelding mag de hele deelnemerslijst niet opnieuw gezet worden.
    expect(source).toContain("/forward");
    expect(source).not.toMatch(/PATCH[\s\S]{0,200}attendees,/);
    // Mislukte uitnodiging geeft de reservering terug.
    expect(source).toContain("releaseInvites");
  });

  it("de backfill slaat bijeenkomsten over waar iedereen al bevestigd is", () => {
    const source = read("src/routes/api/public/agenda-outlook-backfill.ts");
    expect(source).toContain("agenda_claim_invites");
    expect(source).toContain("iedereen kreeg al een bevestiging");
    expect(source).toContain("attendees: invitees");
  });

  it("de e-mailroute claimt per bijeenkomst en adres voordat er verstuurd wordt", () => {
    const source = read("supabase/functions/send-transactional-email/index.ts");
    expect(source).toContain("agenda-registration-confirmation");
    expect(source).toContain("agenda_claim_invites");
    expect(source).toContain("already_sent");
    expect(source).toContain("missing_event_id");
  });

  it("de aanmeldknop geeft de bijeenkomst mee zodat dedupe mogelijk is", () => {
    const source = read("src/hooks/useAgenda.ts");
    expect(source).toContain("eventId: args.eventId");
  });
});

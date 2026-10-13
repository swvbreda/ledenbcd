import { describe, expect, it } from "vitest";
import { actorLabel, canClaim, initialsFor, missingSourceFields, parseAmount, participantIds, projectProgress } from "../projectWorkspace";

const staff = [{ user_id: "a", email: "simone.de.vries@x.nl", full_name: null }, { user_id: "b", email: "b@x.nl", full_name: "Bernard Jansen" }];

describe("projectWorkspace", () => {
  it("initialen uit echte naam, anders e-mail", () => {
    expect(initialsFor(staff[1])).toBe("BJ");
    expect(initialsFor(staff[0])).toBe("SV");
    expect(initialsFor(null)).toBe("?");
  });
  it("actor: bronimport nooit als mens, ontbrekende actor eerlijk", () => {
    expect(actorLabel("bronimport", "b", staff)).toBe("Bronimport");
    expect(actorLabel("medewerker", null, staff)).toBe("Niet geregistreerd");
    expect(actorLabel("medewerker", "b", staff)).toBe("Bernard Jansen");
  });
  it("voortgang telt open/afgerond; zonder taken geen verzonnen percentage", () => {
    const t = [{ project_id: "p", status: "afgerond", assignee_id: null }, { project_id: "p", status: "bezig", assignee_id: "a" }, { project_id: "q", status: "afgerond", assignee_id: null }];
    expect(projectProgress(t, "p")).toEqual({ open: 1, done: 1, total: 2, pct: 50 });
    expect(projectProgress(t, "z").pct).toBeNull();
  });
  it("deelnemers alleen eigenaar, expliciet of uitvoerder", () => {
    const ids = participantIds({ id: "p", owner_id: "a" }, [{ project_id: "p", status: "te_doen", assignee_id: "b" }, { project_id: "q", status: "te_doen", assignee_id: "c" }], [{ project_id: "p", user_id: "a" }, { project_id: "q", user_id: "d" }]);
    expect(ids).toEqual(["a", "b"]);
  });
  it("oppakken alleen voor niet-toegewezen open taken", () => {
    expect(canClaim({ assignee_id: null, status: "te_doen" })).toBe(true);
    expect(canClaim({ assignee_id: "b", status: "te_doen" })).toBe(false);
    expect(canClaim({ assignee_id: null, status: "afgerond" })).toBe(false);
  });
  it("bedrag leeg = onbekend, nooit 0", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1.250,50")).toBe(1250.5);
    expect(parseAmount("abc")).toBe("invalid");
  });
  it("bronupdate vereist alle bronvelden en volgende stap", () => {
    expect(missingSourceFields({ source_date: "2026-10-01", source_subject: "x", source_mailbox: "m", source_ref: "r", last_action: "a" })).toEqual(["next_step"]);
  });
});

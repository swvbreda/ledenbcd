import { describe, expect, it } from "vitest";
import { newContactEmails } from "./contactInvites";

const c = (naam: string, email: string) => ({ naam, functie: "", telefoon: "", email });

describe("newContactEmails", () => {
  it("vindt een nieuw toegevoegd adres", () => {
    expect(
      newContactEmails(
        { contacten: [c("Jan", "jan@x.nl")] },
        { contacten: [c("Jan", "jan@x.nl"), c("Piet", "Piet@X.nl")] },
      ),
    ).toEqual(["piet@x.nl"]);
  });

  it("negeert naam- of telefoonwijzigingen", () => {
    expect(
      newContactEmails(
        { contacten: [c("Jan", "jan@x.nl")] },
        { contacten: [c("Jan Jansen", "jan@x.nl")] },
      ),
    ).toEqual([]);
  });

  it("negeert verwijderde contactpersonen", () => {
    expect(
      newContactEmails({ contacten: [c("Jan", "jan@x.nl")] }, { contacten: [] }),
    ).toEqual([]);
  });

  it("negeert adressen die al elders bij het lid bekend zijn", () => {
    expect(
      newContactEmails(
        { email: "info@x.nl", contacten: [] },
        { contacten: [c("Info", "info@x.nl")] },
      ),
    ).toEqual([]);
  });

  it("negeert ongeldige adressen", () => {
    expect(newContactEmails({ contacten: [] }, { contacten: [c("Jan", "geen-mail")] })).toEqual([]);
  });
});

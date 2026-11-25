import { describe, it, expect } from "vitest";
import { addressGroup } from "../surveyAddressGroup";

const SID = "48979e13-3dcf-4ed4-abbe-e2f3d365b658";
const q = (id: string, question_text: string, question_type = "text") => ({ id, question_text, question_type });
const qs = [q("a", "Hoeveel?", "radio"), q("s", "Straatnaam"), q("h", "Huisnummer"), q("t", "Toevoeging"), q("p", "Postcode"), q("c", "Plaats")];

describe("afleveradres-groepering", () => {
  it("groepeert de laatste vijf vragen met behoud van hun ID's", () => {
    expect(addressGroup(SID, qs)?.map((x) => x.id)).toEqual(["s", "h", "t", "p", "c"]);
  });
  it("laat andere enquêtes en afwijkende vragen ongemoeid", () => {
    expect(addressGroup("andere-enquete", qs)).toBeNull();
    expect(addressGroup(SID, [...qs.slice(0, 5), q("c", "Woonplaats")])).toBeNull();
  });
});

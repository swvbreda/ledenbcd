import { describe, expect, it } from "vitest";
import { parseBcdPhoneNumber, waDeepLink } from "../bcdWhatsAppNumber";

describe("BCD recipient number", () => {
  it("accepts only the fixed BCD phone_number_id", () => {
    expect(parseBcdPhoneNumber({ id: "1312061225331302", display_phone_number: "+31 6 86875231" }))
      .toEqual({ display: "+31 6 86875231", digits: "31686875231" });
  });
  it("rejects another phone number id (e.g. a publisher's) instead of guessing", () => {
    expect(parseBcdPhoneNumber({ id: "999", display_phone_number: "+31 6 46442667" })).toBeNull();
    expect(parseBcdPhoneNumber({ id: "1312061225331302" })).toBeNull();
    expect(parseBcdPhoneNumber(null)).toBeNull();
  });
  it("builds a wa.me link with the code prefilled", () => {
    expect(waDeepLink("31686875231", "BCD-AB12CD34")).toBe("https://wa.me/31686875231?text=BCD-AB12CD34");
  });
});

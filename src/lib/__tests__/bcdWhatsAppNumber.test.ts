import { describe, expect, it } from "vitest";
import { BCD_SUPPORT_NUMBER, parseBcdPhoneNumber, waDeepLink } from "../bcdWhatsAppNumber";

describe("BCD recipient number", () => {
  it("is the proven business number, not the publisher's personal number", () => {
    expect(BCD_SUPPORT_NUMBER.digits).toBe("31686875231");
    expect(BCD_SUPPORT_NUMBER.digits).not.toBe("31646442667");
  });
  it("accepts only the fixed BCD phone_number_id with the proven number", () => {
    expect(parseBcdPhoneNumber({ id: "1312061225331302", display_phone_number: "31686875231" }))
      .toEqual({ display: "+31 6 86875231", digits: "31686875231" });
  });
  it("rejects other ids or a different number instead of guessing", () => {
    expect(parseBcdPhoneNumber({ id: "999", display_phone_number: "+31 6 86875231" })).toBeNull();
    expect(parseBcdPhoneNumber({ id: "1312061225331302", display_phone_number: "+31 6 46442667" })).toBeNull();
    expect(parseBcdPhoneNumber({ id: "1312061225331302" })).toBeNull();
    expect(parseBcdPhoneNumber(null)).toBeNull();
  });
  it("builds a wa.me link to the business number with the code prefilled", () => {
    expect(waDeepLink(BCD_SUPPORT_NUMBER.digits, "BCD-AB12CD34")).toBe("https://wa.me/31686875231?text=BCD-AB12CD34");
  });
});

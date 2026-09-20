import { describe, expect, it } from "vitest";
import { calculateTravelDeclaration, sanitizeReceiptName } from "./declarations";

describe("declaratieberekening", () => {
  it("berekent retourkilometers en vergoeding automatisch", () => {
    expect(calculateTravelDeclaration(42.4, true, 0.23)).toEqual({
      oneWayKm: 42.4,
      totalKm: 84.8,
      amount: 19.5,
    });
  });

  it("ondersteunt een enkele reis", () => {
    expect(calculateTravelDeclaration(10, false, 0.23).amount).toBe(2.3);
  });

  it("maakt een veilige bestandsnaam voor een bon", () => {
    expect(sanitizeReceiptName("Bon café 20-09.JPG")).toBe("Bon-cafe-20-09.jpg");
  });
});

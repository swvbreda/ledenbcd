import { describe, it, expect } from "vitest";
import { mergeDirectory, type DirectoryRow } from "./memberDirectory";

const row = (id: number, data: Record<string, unknown>): DirectoryRow => ({
  id,
  member_type: "member",
  data,
});

describe("mergeDirectory", () => {
  it("houdt de eigen volledige rij en vult aan met geschoonde directoryrijen", () => {
    const own = [row(5, { naam: "Eigen", telefoon: "0612345678", contacten: [{ naam: "Jan" }] })];
    const directory = [
      row(5, { naam: "Eigen", contacten: [] }),
      row(9, { naam: "Ander", contacten: [] }),
    ];

    const merged = mergeDirectory(own, directory);

    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.id)).toEqual([5, 9]);
    expect((merged[0].data as Record<string, unknown>).telefoon).toBe("0612345678");
    expect((merged[1].data as Record<string, unknown>).telefoon).toBeUndefined();
  });

  it("levert geen dubbele lidnummers op", () => {
    const merged = mergeDirectory(
      [row(1, { naam: "A" }), row(1, { naam: "A" })],
      [row(1, { naam: "A" }), row(2, { naam: "B" })],
    );
    expect(merged.map((r) => r.id)).toEqual([1, 2]);
  });

  it("geeft alleen de eigen rij als er geen directory beschikbaar is", () => {
    const merged = mergeDirectory([row(7, { naam: "Eigen" })], []);
    expect(merged.map((r) => r.id)).toEqual([7]);
  });
});

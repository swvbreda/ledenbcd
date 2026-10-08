import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { monthlyAllowanceRow } from "../../../supabase/functions/auto-monthly-allowances/allowanceRow";

const src = readFileSync("supabase/functions/auto-monthly-allowances/index.ts", "utf8");

describe("automatische maandvergoeding", () => {
  it("wordt als ingediend klaargezet, niet goedgekeurd", () => {
    const now = new Date("2026-10-31T03:00:00Z");
    const row = monthlyAllowanceRow({ year: 2026, board_member_name: "Bernard", declaration_type: "penningmeester",
      amount: 210, expense_date: "2026-10-31", note: "n", now });
    expect(row.status).toBe("pending");
    expect(row.submitted_at).toBe("2026-10-31T03:00:00.000Z");
    expect(row.reviewed_by).toBeNull();
    expect(row.reviewed_at).toBeNull();
  });
  it("roept Informer niet aan", () => {
    expect(src).not.toMatch(/informer-sync|declaration_to_informer|fetch\(/);
    expect(src).not.toMatch(/status:\s*["']approved["']/);
  });
});

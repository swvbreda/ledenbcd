import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarizeRepresentation } from "@/lib/representationSummary";
import { bankGroupsFromAggregate } from "@/lib/memberBankAggregate";

const read = (p: string) => readFileSync(p, "utf8");
const base = {
  isLoading: false,
  isError: false,
  fromRegister: true,
  perGemeente: { Amsterdam: 150, Rotterdam: 30, "Den Haag": 30, Utrecht: 10, Arnhem: 5, Goes: 2 },
  representedPerGemeente: { Amsterdam: 60, Rotterdam: 10, Arnhem: 2, Goes: 0 },
  totaalNL: 557,
  totaalRepresented: 182,
};

describe("ledendashboard: centrale vertegenwoordiging", () => {
  it("gebruikt de centrale totalen (182/557) zonder lokale telling", () => {
    const r = summarizeRepresentation(base);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.totaalRepresented).toBe(182);
    expect(r.totaalNL).toBe(557);
    expect(r.marketPct).toBe(33);
  });

  it("telt gemeenten uit dezelfde centrale bron (alleen > 0)", () => {
    const r = summarizeRepresentation(base);
    if (r.status !== "ok") throw new Error("verwacht ok");
    expect(r.gemeentenNL).toBe(6);
    expect(r.gemeentenVertegenwoordigd).toBe(3);
    expect(r.g4Represented).toBe(70);
    expect(r.g4Total).toBe(220);
  });

  it("toont bij laden geen 0 als feit", () => {
    expect(summarizeRepresentation({ ...base, isLoading: true }).status).toBe("loading");
  });

  it("toont bij fout of statische noodcijfers geen cijfers als feit", () => {
    expect(summarizeRepresentation({ ...base, isError: true }).status).toBe("error");
    expect(summarizeRepresentation({ ...base, fromRegister: false }).status).toBe("error");
    expect(summarizeRepresentation({ ...base, totaalNL: 0 }).status).toBe("error");
  });

  it("dashboardkaarten zijn niet meer afgeschermd met canSeeRegister en lezen dezelfde bron", () => {
    for (const f of ["src/components/StatCards.tsx", "src/components/GemeentenOverzicht.tsx"]) {
      const s = read(f);
      expect(s).not.toContain("canSeeRegister");
      expect(s).toContain("useRegisterStats()");
      expect(s).toContain("summarizeRepresentation");
    }
  });

  it("de cijferbron valt bij fout niet stil terug op statische cijfers", () => {
    const s = read("src/hooks/useRegisterStats.ts");
    expect(s).toContain("throw new Error(\"Centrale vertegenwoordigingscijfers");
  });
});

describe("ledendashboard: privacygrenzen kerngegevens", () => {
  const src = read("src/pages/KerngegevensPage.tsx");
  it("leden laden register/UBO-hooks niet (useKerngegevens alleen voor bestuur/beheer)", () => {
    expect(src).toContain("useKerngegevens(privileged)");
    expect(src).not.toContain("useKerngegevens(true)");
    expect(src).toContain("usePinverwerkers(privileged)");
  });
  it("leden krijgen bankverdeling alleen als aggregaat", () => {
    expect(src).toContain("useMemberBankAggregate(!privileged)");
  });
  it("bankaggregaat bevat alleen aantallen per bank, geen rekeningnummers", () => {
    const g = bankGroupsFromAggregate([
      { bank_code: "INGB", aantal: 40, totaal_leden: 100 },
      { bank_code: "RABO", aantal: 50, totaal_leden: 100 },
      { bank_code: "", aantal: 10, totaal_leden: 100 },
    ]);
    expect(g).toEqual([
      { bank: "Rabobank", aantal: 50, pct: 50 },
      { bank: "ING", aantal: 40, pct: 40 },
      { bank: "Onbekend", aantal: 10, pct: 10 },
    ]);
    expect(JSON.stringify(g)).not.toMatch(/NL\d{2}/);
  });
});

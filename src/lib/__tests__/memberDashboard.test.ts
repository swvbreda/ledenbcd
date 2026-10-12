import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarizeRepresentation } from "@/lib/representationSummary";
import { bankGroupsFromAggregate, pspGroupsFromAggregate } from "@/lib/memberBankAggregate";

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

  it("telt vertegenwoordigde gemeenten alleen binnen actieve landelijke gemeenten", () => {
    const r = summarizeRepresentation({
      ...base,
      representedPerGemeente: { ...base.representedPerGemeente, Onbekend: 3, Goes: 1 },
      perGemeente: { ...base.perGemeente, Goes: 0 },
    });
    if (r.status !== "ok") throw new Error("verwacht ok");
    expect(r.gemeentenNL).toBe(5);
    expect(r.gemeentenVertegenwoordigd).toBe(3);
  });

  it("lidmaatschapskaart 'Aanwezig in gemeenten' gebruikt dezelfde centrale samenvatting", () => {
    const s = read("src/components/LidmaatschapsduurChart.tsx");
    expect(s).toContain("summarizeRepresentation(useRegisterStats())");
    expect(s).toContain("Centrale telling laden");
    expect(s).not.toContain("Object.keys(perStad)");
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
  it("leden krijgen betaalverwerkers alleen als serveraggregaat", () => {
    expect(src).toContain("useMemberPspAggregate(!privileged)");
    expect(src).not.toMatch(/\{privileged && \(\s*<Sectie titel="Betaalverwerkers"/);
  });
  it("aggregaatcaches zijn per account gescheiden", () => {
    const h = read("src/hooks/useMemberBankAggregate.ts");
    expect(h).toContain('["member-bank-groups", uid]');
    expect(h).toContain('["member-psp-groups", uid]');
    expect(h).not.toContain("get_member_bank_aggregate");
  });
  it("serveraggregaten weigeren anon/extern/inhuur en geven geen ruwe velden", () => {
    const m = read("drizzle/migrations/0018_member_bank_psp_groups.sql");
    expect(m).toContain("REVOKE ALL ON FUNCTION public.get_member_bank_groups() FROM PUBLIC, anon");
    expect(m).toContain("REVOKE ALL ON FUNCTION public.get_member_psp_groups() FROM PUBLIC, anon");
    expect(m).toContain("'extern'::app_role,'inhuur'::app_role");
    expect(m).toContain("RETURNS TABLE(bank text, aantal integer, totaal_leden integer)");
    expect(m).toContain("RETURNS TABLE(naam text, aantal integer, pct integer)");
    expect(m).toContain("'Buitenlands (' || left(i.iban,2) || ')'");
  });
  it("bankaggregaat bevat alleen banknamen en aantallen, ook buitenlands", () => {
    const g = bankGroupsFromAggregate([
      { bank: "ING", aantal: 40, totaal_leden: 100 },
      { bank: "Rabobank", aantal: 50, totaal_leden: 100 },
      { bank: "Buitenlands (BE)", aantal: 3, totaal_leden: 100 },
      { bank: "Onbekend", aantal: 7, totaal_leden: 100 },
    ]);
    expect(g).toEqual([
      { bank: "Rabobank", aantal: 50, pct: 50 },
      { bank: "ING", aantal: 40, pct: 40 },
      { bank: "Buitenlands (BE)", aantal: 3, pct: 3 },
      { bank: "Onbekend", aantal: 7, pct: 7 },
    ]);
    expect(JSON.stringify(g)).not.toMatch(/NL\d{2}|Overig \(\d/);
  });
  it("betaalverwerkers: Anders achteraan, server-pct ongewijzigd", () => {
    expect(pspGroupsFromAggregate([
      { naam: "Anders", aantal: 9, pct: 30 },
      { naam: "CCV", aantal: 5, pct: 17 },
      { naam: "Worldline", aantal: 16, pct: 53 },
    ])).toEqual([
      { naam: "Worldline", aantal: 16, pct: 53 },
      { naam: "CCV", aantal: 5, pct: 17 },
      { naam: "Anders", aantal: 9, pct: 30 },
    ]);
  });
});

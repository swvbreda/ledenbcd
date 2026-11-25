import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
afterEach(cleanup);
import { useState } from "react";
import ContributieInkomsten2027, { type Scenario } from "../ContributieInkomsten2027";

const staffel = [
  { label: "1 locatie", amount: 3000 }, { label: "2–3 locaties", amount: 4500 }, { label: "4–6 locaties", amount: 6000 },
  { label: "7–10 locaties", amount: 8000 }, { label: "Meer dan 10 locaties", amount: 10000 },
];
const rows = [
  { label: "1 locatie", count: 103, amount: 3000 }, { label: "2–3 locaties", count: 11, amount: 4500 },
  { label: "4–6 locaties", count: 6, amount: 6000 }, { label: "7–10 locaties", count: 1, amount: 8000 },
];
const digits = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));

function Harness() {
  const [s, set] = useState<Scenario>("full");
  return <ContributieInkomsten2027 rows={rows} staffel={staffel} scenario={s} onScenario={set} />;
}

describe("Contributie-inkomsten 2027", () => {
  it("toont 121 leden/groepen (103 + 18) en beide scenario's", () => {
    render(<Harness />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/121.*103 met 1 shop.*18 groepen/);
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(402500);
    expect(screen.getByText("Meer dan 10 locaties").closest("tr")?.textContent).toMatch(/00€\s?10\.000€\s?0/);
    fireEvent.click(screen.getByRole("radio", { name: "50% van de verhoging" }));
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(382750);
    expect(screen.getByText("2–3 locaties").closest("tr")?.textContent).toMatch(/3\.750/);
  });
});

const groups = [
  [1,"The Bulldog",5],[5,"Green House",5],[8,"Coffeeshop Relax",2],[9,"Boere Jongens",4],[20,"Easy Times",2],[21,"Hunters",9],
  [30,"Siberië",5],[35,"Dampkring The Original",2],[57,"Kadinsky",3],[60,"7th heaven",2],[62,"Terps Army",2],[66,"The Plug",6],
  [67,"Taffne",2],[86,"Coffeeshop Aarden",3],[99,"NCC Power Flower",2],[117,"Coffeeshop 010 B.V.",5],[119,"Out of time",2],[150,"GOA",2],
].map(([id, name, shops]) => ({ id: id as number, name: name as string, shops: shops as number }));

describe("Coffeeshops en groepen 2027", () => {
  it("18 groepen, 63 shops, 166 totaal en verdeling 11/6/1", async () => {
    const { contributieRows } = await import("../ContributieInkomsten2027");
    const t = contributieRows(rows, staffel, "full", groups);
    expect(groups.length).toBe(18);
    expect(groups.reduce((s, g) => s + g.shops, 0)).toBe(63);
    expect(t.shops).toBe(166);
    expect(t.lines.map((l) => l.shops)).toEqual([103, 24, 30, 9, 0]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual([11, 6, 1, 0]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual(t.lines.slice(1).map((l) => l.count));
    expect(t.total).toBe(402500);
    expect(contributieRows(rows, staffel, "half", groups).total).toBe(382750);
  });
  it("toont 166 coffeeshops en groepsnamen met link", () => {
    render(<ContributieInkomsten2027 rows={rows} staffel={staffel} scenario="half" onScenario={() => {}} groups={groups} />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/166 coffeeshops in deze raming.*121.*103 met 1 shop.*18 groepen/);
    expect(screen.getByTestId("contrib-shops").textContent).toBe("166");
    fireEvent.click(screen.getByText("Welke leden hebben meerdere shops?"));
    expect(screen.getByRole("link", { name: "Hunters" }).getAttribute("href")).toBe("/leden/21");
    expect(screen.getByText(/7–10 locaties: 1 groep, 9 shops/).textContent).toMatch(/5\.500/);
  });
});

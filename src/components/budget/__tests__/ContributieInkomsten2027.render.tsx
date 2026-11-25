import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
afterEach(cleanup);
import ContributieInkomsten2027 from "../ContributieInkomsten2027";

const staffel = [
  { label: "1 locatie", amount: 3000 }, { label: "2–3 locaties", amount: 4500 }, { label: "4–6 locaties", amount: 6000 },
  { label: "7–10 locaties", amount: 8000 }, { label: "Meer dan 10 locaties", amount: 10000 },
];
const rows = [
  { label: "1 locatie", count: 102, amount: 3000 }, { label: "2–3 locaties", count: 11, amount: 4500 },
  { label: "4–6 locaties", count: 6, amount: 6000 }, { label: "7–10 locaties", count: 0, amount: 8000 }, { label: "Meer dan 10 locaties", count: 1, amount: 10000 },
];
const digits = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));

describe("Contributie-inkomsten 2027", () => {
  it("toont alleen de volledige staffel: 401.500, geen 50%-knop of -tekst", () => {
    const { container } = render(<ContributieInkomsten2027 rows={rows} staffel={staffel} />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/^120 leden\/groepen/);
    void ("120 leden/groepen · 169 coffeeshops");
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(401500);
    expect(screen.getByText("Meer dan 10 locaties").closest("tr")?.textContent).toMatch(/locaties10€\s?10\.000€\s?10\.000/);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(container.textContent).not.toMatch(/50%|383\.750|28\.650|verhoging/);
  });
});

const groups = [
  [1,"The Bulldog",5],[5,"Green House",5],[8,"Coffeeshop Relax",2],[9,"Boere Jongens",4],[20,"Easy Times",2],[21,"Hunters",13],
  [30,"Siberië",5],[35,"Dampkring The Original",2],[57,"Kadinsky",3],[60,"7th heaven",2],[62,"Terps Army",2],[66,"The Plug",6],
  [67,"Taffne",2],[86,"Coffeeshop Aarden",3],[99,"NCC Power Flower",2],[117,"Coffeeshop 010 B.V.",5],[119,"Out of time",2],[150,"GOA",2],
].map(([id, name, shops]) => ({ id: id as number, name: name as string, shops: shops as number }));

describe("Coffeeshops en groepen 2027", () => {
  it("18 groepen, 67 shops, 169 totaal en verdeling 11/6/0/1", async () => {
    const { contributieRows } = await import("../ContributieInkomsten2027");
    const t = contributieRows(rows, staffel, groups);
    expect(groups.length).toBe(18);
    expect(groups.reduce((s, g) => s + g.shops, 0)).toBe(67);
    expect(t.shops).toBe(169);
    expect(t.minimum).toBe(false);
    expect(t.lines.map((l) => l.shops)).toEqual([102, 24, 30, 0, 13]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual([11, 6, 0, 1]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual(t.lines.slice(1).map((l) => l.count));
    expect(t.total).toBe(401500);
  });
  it("toont rustig overzicht: 120/169, Hunters 13, geen rekenbrug of voorbehouden", () => {
    const { container } = render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} />);
    expect(screen.getByRole("heading", { name: "Contributieraming 2027" })).toBeTruthy();
    expect(screen.getByTestId("contrib-shops").textContent).toBe("169");
    fireEvent.click(screen.getByText("Welke leden hebben meerdere shops?"));
    expect(screen.getByRole("link", { name: "Hunters" }).getAttribute("href")).toBe("/leden/21");
    expect(screen.getByText(/Meer dan 10 locaties: 1 groep, 13 shops/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Aansluiting|som per groep|gegarandeerd|Kerngegevens|controlepunt|registraties/i);
    expect(screen.getByText("Tyson nog niet meegerekend; contributiebedrag volgt.")).toBeTruthy();
  });
});

const aansluiting = {
  start: { label: "Geregistreerde coffeeshopvermeldingen", aantal: 181 },
  stappen: [{ label: "leads", delta: -10 }, { label: "uitgesloten", delta: -5 }, { label: "Plug dubbel", delta: -1 }, { label: "Hunters", delta: 4 }],
  tussenstappen: [{ naStap: 0, label: "bij 125 leden" }],
  kerngegevensNoot: "Kerngegevens 169",
};
describe("Aansluiting vestigingen 2027", () => {
  it("181 − 10 − 5 − 1 + 4 = 169", async () => {
    const { aansluitingTotalen, contributieRows } = await import("../ContributieInkomsten2027");
    const a = aansluitingTotalen(aansluiting);
    expect(a.stappen.map((s) => s.totaal)).toEqual([171, 166, 165, 169]);
    expect(a.eind).toBe(169);
    expect(a.eind).toBe(contributieRows(rows, staffel, groups).shops);
  });
});

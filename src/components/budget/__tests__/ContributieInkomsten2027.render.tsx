import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
afterEach(cleanup);
import ContributieInkomsten2027 from "../ContributieInkomsten2027";

const staffel = [
  { label: "1 locatie", amount: 3000 }, { label: "2–3 locaties", amount: 4500 }, { label: "4–6 locaties", amount: 6000 },
  { label: "7–10 locaties", amount: 8000 }, { label: "Meer dan 10 locaties", amount: 10000 },
];
const rows = [
  { label: "1 locatie", count: 103, amount: 3000 }, { label: "2–3 locaties", count: 11, amount: 4500 },
  { label: "4–6 locaties", count: 6, amount: 6000 }, { label: "7–10 locaties", count: 0, amount: 8000 }, { label: "Meer dan 10 locaties", count: 1, amount: 10000 },
];
const digits = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));

describe("Contributie-inkomsten 2027", () => {
  it("toont alleen de volledige staffel: 404.500, geen 50%-knop of -tekst", () => {
    const { container } = render(<ContributieInkomsten2027 rows={rows} staffel={staffel} />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/121.*103 met 1 shop.*18 groepen/);
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(404500);
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
  it("18 groepen, 67 shops, 170 totaal en verdeling 11/6/0/1", async () => {
    const { contributieRows } = await import("../ContributieInkomsten2027");
    const t = contributieRows(rows, staffel, groups);
    expect(groups.length).toBe(18);
    expect(groups.reduce((s, g) => s + g.shops, 0)).toBe(67);
    expect(t.shops).toBe(170);
    expect(t.minimum).toBe(false);
    expect(t.lines.map((l) => l.shops)).toEqual([103, 24, 30, 0, 13]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual([11, 6, 0, 1]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual(t.lines.slice(1).map((l) => l.count));
    expect(t.total).toBe(404500);
  });
  it("toont 170 coffeeshops, registratie en Hunters 13", () => {
    render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} registratie={{ geregistreerd: 125, uitgesloten: [{ id: 32, name: "Scolo", reden: "alleen bij GOA meegerekend" }, { id: 125, name: "Baba", reden: "eerder uitgesloten" }, { id: 140, name: "Demo", reden: "testrecord" }, { id: 144, name: "Tyson", reden: "bedrag wacht op bevestiging" }] }} />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/^170 coffeeshops in deze raming.*121.*103 met 1 shop.*18 groepen/);
    expect(screen.getByTestId("contrib-shops").textContent).toBe("170");
    fireEvent.click(screen.getByText("Welke leden hebben meerdere shops?"));
    expect(screen.getByRole("link", { name: "Hunters" }).getAttribute("href")).toBe("/leden/21");
    expect(screen.getByText(/Meer dan 10 locaties: 1 groep, 13 shops/).textContent).toMatch(/10\.000/);
    expect(screen.queryByText(/minimaal|exact onbekend/i)).toBeNull();
    expect(screen.getByText("13 shops")).toBeTruthy();
    expect(screen.getByTestId("contrib-registratie").textContent).toMatch(/125 registraties − 4 niet afzonderlijk geraamd.*Demo: testrecord.*= 121 ramingsleden\/groepen/);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
afterEach(cleanup);
import ContributieInkomsten2027 from "../ContributieInkomsten2027";

const staffel = [
  { label: "1 locatie", amount: 3000 }, { label: "2–3 locaties", amount: 4500 }, { label: "4–6 locaties", amount: 6000 },
  { label: "7–10 locaties", amount: 8000 }, { label: "Meer dan 10 locaties", amount: 10000 },
];
const rows = [
  { label: "1 locatie", count: 104, amount: 3000 }, { label: "2–3 locaties", count: 11, amount: 4500 },
  { label: "4–6 locaties", count: 6, amount: 6000 }, { label: "7–10 locaties", count: 0, amount: 8000 }, { label: "Meer dan 10 locaties", count: 1, amount: 10000 },
];
const digits = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));

describe("Contributie-inkomsten 2027", () => {
  it("toont alleen de volledige staffel: 407.500, geen 50%-knop of -tekst", () => {
    const { container } = render(<ContributieInkomsten2027 rows={rows} staffel={staffel} />);
    expect(screen.getByTestId("contrib-summary").textContent).toMatch(/^122 leden\/groepen/);
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(407500);
    expect(screen.getByText("Meer dan 10 locaties").closest("tr")?.textContent).toMatch(/locaties10€\s?10\.000€\s?10\.000/);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(container.textContent).not.toMatch(/50%|383\.750|28\.650|verhoging/);
  });
});

const groups = [
  [1,"The Bulldog",5],[5,"Green House",5],[8,"Coffeeshop Relax",2],[9,"Boere Jongens",4],[20,"Easy Times",2],[21,"Hunters",13],
  [30,"Siberië",5],[35,"Dampkring The Original",2],[57,"Kadinsky",3],[60,"7th heaven",2],[62,"Terps Army",2],[66,"The Plug",6],
  [67,"Taffne",2],[86,"Coffeeshop Aarden",3],[99,"NCC Power Flower",2],[117,"Coffeeshop 010 B.V.",5],[119,"Out of time",2],[144,"Tyson",2],
].map(([id, name, shops]) => ({ id: id as number, name: name as string, shops: shops as number }));

describe("Coffeeshops en groepen 2027", () => {
  it("18 groepen, 67 shops, 171 totaal en verdeling 11/6/0/1", async () => {
    const { contributieRows } = await import("../ContributieInkomsten2027");
    const t = contributieRows(rows, staffel, groups);
    expect(groups.length).toBe(18);
    expect(groups.reduce((s, g) => s + g.shops, 0)).toBe(67);
    expect(t.shops).toBe(171);
    expect(t.minimum).toBe(false);
    expect(t.lines.map((l) => l.shops)).toEqual([104, 24, 30, 0, 13]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual([11, 6, 0, 1]);
    expect(t.lines.slice(1).map((l) => l.members.length)).toEqual(t.lines.slice(1).map((l) => l.count));
    expect(t.total).toBe(407500);
  });
  it("staffelregels openen een venster met de juiste leden; lege staffel is niet klikbaar", async () => {
    const { RAMINGSLEDEN_2027: leden } = await import("@/lib/begroting2027Concept.server");
    const { container } = render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} leden={leden} />);
    expect(leden).toHaveLength(122);
    expect(leden.reduce((t, g) => t + g.shops, 0)).toBe(171);
    expect(screen.getByTestId("contrib-summary").textContent).toBe("122 leden/groepen · 171 coffeeshops");
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(407500);
    expect(container.textContent).not.toMatch(/Welke leden hebben meerdere shops|Aansluiting|controlepunt/i);
    const row = (label: string) => screen.getByText(label).closest("tr")!;
    fireEvent.keyDown(row("1 locatie"), { key: "Enter" });
    expect(screen.getByTestId("staffel-dialog-summary").textContent).toMatch(/^104 leden\/groepen · 104 coffeeshops/);
    expect(screen.getByTestId("staffel-dialog-list").querySelectorAll("li")).toHaveLength(104);
    expect(screen.getByRole("link", { name: "Coffeeshop Scolo" }).getAttribute("href")).toBe("/leden/32");
    expect(screen.queryByRole("link", { name: "Demo Coffeeshop" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    cleanup();
    render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} leden={leden} />);
    fireEvent.keyDown(screen.getByText("2–3 locaties").closest("tr")!, { key: " " });
    expect(screen.getByTestId("staffel-dialog-list").querySelectorAll("li")).toHaveLength(11);
    expect(screen.getByRole("link", { name: "Coffeeshop Tyson" }).closest("li")?.textContent).toMatch(/2 shops/);
    cleanup();
    render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} leden={leden} />);
    fireEvent.click(screen.getByText("Meer dan 10 locaties").closest("tr")!);
    expect(screen.getByRole("link", { name: "Hunters" }).getAttribute("href")).toBe("/leden/21");
    expect(screen.getByTestId("staffel-dialog-summary").textContent).toMatch(/^1 lid\/groep · 13 coffeeshops/);
    cleanup();
    render(<ContributieInkomsten2027 rows={rows} staffel={staffel} groups={groups} leden={leden} />);
    const empty = screen.getByText("7–10 locaties").closest("tr")!;
    expect(empty.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(empty);
    expect(screen.queryByTestId("staffel-dialog-list")).toBeNull();
  });
});

const aansluiting = {
  start: { label: "Geregistreerde coffeeshopvermeldingen", aantal: 181 },
  stappen: [{ label: "leads", delta: -10 }, { label: "uitgesloten", delta: -3 }, { label: "Plug dubbel", delta: -1 }, { label: "Hunters", delta: 4 }, { label: "Tyson", delta: 1 }, { label: "GOA", delta: -1 }],
  tussenstappen: [{ naStap: 0, label: "bij 125 leden" }],
  kerngegevensNoot: "Kerngegevens 169",
};
describe("Aansluiting vestigingen 2027", () => {
  it("181 − 10 − 3 − 1 + 4 + 1 − 1 = 171", async () => {
    const { aansluitingTotalen, contributieRows } = await import("../ContributieInkomsten2027");
    const a = aansluitingTotalen(aansluiting);
    expect(a.stappen.map((s) => s.totaal)).toEqual([171, 168, 167, 171, 172, 171]);
    expect(a.eind).toBe(171);
    expect(a.eind).toBe(contributieRows(rows, staffel, groups).shops);
  });
});

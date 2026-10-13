import { describe, it, expect } from "vitest";
import {
  buildTree, resolveFinanceLabel, unlinkedProjects, dossierScope, projectInScope, diffLinks,
  financeDossierHref, parseFinanceSearch, type RegisterDossier, type FinanceAlias,
} from "@/lib/dossierRegister";

const d = (id: string, name: string, parent_id: string | null = null, sort_order = 0): RegisterDossier =>
  ({ id, name, parent_id, sort_order, jaarplan_kind: null, jaarplan_section: null, jaarplan_pages: null, note: null, archived_at: null });

const aliases: FinanceAlias[] = [
  ["ams", "Amsterdam i-criterium"], ["wl", "Worldline"], ["sv", "Schaarse vergunningen"], ["pcn", "Samenwerking PCN"],
  ["sbi", "SBI"], ["verk", "Verkiezingen"], ["lobby", "Lobby"], ["bank", "Banken"], ["fin", "Boekhouding"],
].map(([dossier_id, label]) => ({ dossier_id, label }));

describe("financiële labels", () => {
  it("koppelt de 7 actuele en 2 legacy labels exact", () => {
    expect(resolveFinanceLabel("Amsterdam i-criterium", aliases)).toBe("ams");
    expect(resolveFinanceLabel("Worldline", aliases)).toBe("wl");
    expect(resolveFinanceLabel("Schaarse vergunningen", aliases)).toBe("sv");
    expect(resolveFinanceLabel("Samenwerking PCN", aliases)).toBe("pcn");
    expect(resolveFinanceLabel("SBI", aliases)).toBe("sbi");
    expect(resolveFinanceLabel("Verkiezingen", aliases)).toBe("verk");
    expect(resolveFinanceLabel("Lobby", aliases)).toBe("lobby");
    expect(resolveFinanceLabel("Banken", aliases)).toBe("bank");
    expect(resolveFinanceLabel("Boekhouding", aliases)).toBe("fin");
  });
  it("koppelt nooit fuzzy: andere spelling, hoofdletters of contributie blijven ongekoppeld", () => {
    expect(resolveFinanceLabel("Schaarsevergunningen", aliases)).toBeNull();
    expect(resolveFinanceLabel("worldline", aliases)).toBeNull();
    expect(resolveFinanceLabel("Wordline", aliases)).toBeNull();
    expect(resolveFinanceLabel("Contributie · Oya (#47)", aliases)).toBeNull();
    expect(resolveFinanceLabel("Nabetaling", aliases)).toBeNull();
  });
  it("negeert alleen witruimte aan de randen", () => {
    expect(resolveFinanceLabel("  SBI ", aliases)).toBe("sbi");
  });
});

describe("hiërarchie en projecten", () => {
  const ds = [d("b", "Banken", null, 20), d("w", "Worldline", "b", 21), d("a", "Amsterdam", null, 10)];
  const links = [{ dossier_id: "w", project_id: "p1" }, { dossier_id: "a", project_id: "p2" }];
  it("bouwt hoofddossiers met subdossiers op volgorde", () => {
    const t = buildTree(ds);
    expect(t.map((x) => x.id)).toEqual(["a", "b"]);
    expect(t[1].children.map((x) => x.id)).toEqual(["w"]);
  });
  it("ongekoppelde projecten komen onder Overige projecten", () => {
    const ps = [{ id: "p1", title: "x", archived_at: null }, { id: "p3", title: "z", archived_at: "2026-01-01" }];
    expect(unlinkedProjects(ps, links).map((p) => p.id)).toEqual(["p3"]);
  });
  it("dossierfilter op hoofddossier omvat subdossiers", () => {
    const s = dossierScope("b", ds);
    expect(projectInScope("p1", s, links)).toBe(true);
    expect(projectInScope("p2", s, links)).toBe(false);
  });
  it("berekent omkeerbare koppelwijzigingen", () => {
    expect(diffLinks(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
  });
});

describe("deeplinks Financiën", () => {
  const years = [2026, 2025];
  it("bouwt en leest tab/jaar/dossier terug", () => {
    const href = financeDossierHref("Schaarse vergunningen", 2026);
    const p = parseFinanceSearch(new URLSearchParams(href.split("?")[1]), years, 2026);
    expect(p).toEqual({ tab: "dossiers", year: 2026, dossier: "Schaarse vergunningen" });
  });
  it("valt terug bij ongeldige waarden", () => {
    const p = parseFinanceSearch(new URLSearchParams("tab=hack&year=1999&dossier="), years, 2026);
    expect(p).toEqual({ tab: "dashboard", year: 2026, dossier: null });
  });
});

import { filterTree } from "@/lib/dossierRegister";
describe("dossierfilter in groepsweergave", () => {
  const tree = buildTree([d("b", "Banken", null, 20), d("w", "Worldline", "b", 21), d("v", "Visa", "b", 22), d("a", "Amsterdam", null, 10), d("e", "Leeg", null, 30)]);
  it("hoofddossier toont alleen die groep met alle subdossiers", () => {
    const t = filterTree(tree, "b");
    expect(t.map((x) => x.id)).toEqual(["b"]);
    expect(t[0].children.map((c) => c.id)).toEqual(["w", "v"]);
  });
  it("subdossier toont ouder met uitsluitend dat subdossier", () => {
    const t = filterTree(tree, "v");
    expect(t.map((x) => x.id)).toEqual(["b"]);
    expect(t[0].children.map((c) => c.id)).toEqual(["v"]);
  });
  it("leeg dossier toont alleen die lege groep; zonder filter alle groepen", () => {
    expect(filterTree(tree, "e").map((x) => x.id)).toEqual(["e"]);
    expect(filterTree(tree, null).map((x) => x.id)).toEqual(["a", "b", "e"]);
  });
});

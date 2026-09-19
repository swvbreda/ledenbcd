import { describe, expect, it } from "vitest";
import {
  buildDryRunReport,
  detectSchemaVersion,
  isV2,
  mapShopRow,
  shopCounts,
  splitLegacyAdres,
} from "./registerMapping";

const v2Shop = {
  id: "bron-1",
  naam_coffeeshop: "Coffeeshop Kadinsky",
  straat: "Rosmarijnsteeg",
  huisnummer: "9",
  huisnummer_toevoeging: "A",
  volledig_adres: "Rosmarijnsteeg 9A, Amsterdam",
  postcode: "1012 RP",
  plaats: "Amsterdam",
  gemeente_id: "g-1",
  gemeentenaam: "Amsterdam",
  provincie: "Noord-Holland",
  latitude: 52.3702,
  longitude: 4.8952,
  bag_pand_id: "0363100012168052",
  bag_verblijfsobject_id: "0363010000740855",
  status: "actief",
  telt_mee: true,
  is_ruis: false,
  exploitatie_status: "in_exploitatie",
  controle_nodig: false,
  is_baseline_shop: true,
};

const v2Ruis = {
  id: "bron-2",
  naam: "Dubbel dossier",
  straat: "Teststraat",
  huisnummer: "1",
  plaats: "Utrecht",
  status: "actief",
  telt_mee: false,
  uitsluitreden: "Ruis — dubbel dossier",
  is_ruis: true,
  ruis_reden: "dubbel dossier",
  exploitatie_status: "onbekend",
  controle_nodig: true,
  is_baseline_shop: false,
};

const v1Shop = {
  id: "bron-3",
  naam: "Oude Import",
  adres: "Kerkstraat 12B",
  plaats: "Tilburg",
  status: "actief",
};

describe("bronversie", () => {
  it("herkent v2 en behandelt een ontbrekende versie als v1", () => {
    expect(detectSchemaVersion({ schema_version: "2.0" })).toBe("2.0");
    expect(isV2(detectSchemaVersion({ schema_version: "2.0" }))).toBe(true);
    expect(detectSchemaVersion({})).toBe("1.0");
    expect(isV2(detectSchemaVersion({}))).toBe(false);
  });
});

describe("v2-mapping", () => {
  const row = mapShopRow(v2Shop, {
    gemeente: { naam: "Amsterdam", provincie: "Noord-Holland" },
    schemaVersion: "2.0",
    now: "2026-01-01T00:00:00.000Z",
  });

  it("neemt straat en huisnummer rechtstreeks over (niet het volledige adres)", () => {
    expect(row.straat).toBe("Rosmarijnsteeg");
    expect(row.huisnummer).toBe("9");
    expect(row.huisnummer_toevoeging).toBe("A");
    expect(row.straat).not.toContain("9A");
  });

  it("neemt coördinaten en BAG-velden over", () => {
    expect(row.latitude).toBeCloseTo(52.3702);
    expect(row.longitude).toBeCloseTo(4.8952);
    expect(row.bag_pand_id).toBe("0363100012168052");
    expect(row.bag_verblijfsobject_id).toBe("0363010000740855");
  });

  it("legt de centrale classificatie typed vast", () => {
    expect(row.telt_mee).toBe(true);
    expect(row.exploitatie_status_bron).toBe("in_exploitatie");
    expect(row.controle_nodig_bron).toBe(false);
    expect(row.is_baseline_shop_bron).toBe(true);
    expect(row.bron_schema_version).toBe("2.0");
    expect(row.gemeente).toBe("Amsterdam");
    expect(row.provincie).toBe("Noord-Holland");
  });

  it("zet niet-meetellende dossiers op telt_mee false met reden", () => {
    const ruis = mapShopRow(v2Ruis, { schemaVersion: "2.0" });
    expect(ruis.telt_mee).toBe(false);
    expect(ruis.uitsluitreden).toBe("Ruis — dubbel dossier");
    expect(shopCounts(ruis)).toBe(false);
  });
});

describe("v1-fallback", () => {
  const row = mapShopRow(v1Shop, { schemaVersion: "1.0" });

  it("laat telt_mee leeg zodat de legacyregel blijft gelden", () => {
    expect(row.telt_mee).toBeNull();
    expect(row.uitsluitreden).toBeNull();
    expect(shopCounts(row)).toBe(true);
  });

  it("splitst het samengestelde adres alleen als fallback", () => {
    expect(row.straat).toBe("Kerkstraat");
    expect(row.huisnummer).toBe("12");
    expect(row.huisnummer_toevoeging).toBe("B");
    expect(splitLegacyAdres("Damstraat 5").huisnummer).toBe("5");
    expect(splitLegacyAdres(null).straat).toBeNull();
  });

  it("past de legacyregel toe op ruis en gesloten dossiers", () => {
    const gesloten = mapShopRow({ ...v1Shop, id: "x", status: "gesloten" }, { schemaVersion: "1.0" });
    const ruis = mapShopRow({ ...v1Shop, id: "y", is_ruis: true }, { schemaVersion: "1.0" });
    expect(shopCounts(gesloten)).toBe(false);
    expect(shopCounts(ruis)).toBe(false);
  });
});

describe("tellingen", () => {
  const rows = [
    mapShopRow(v2Shop, { schemaVersion: "2.0" }),
    mapShopRow(v2Ruis, { schemaVersion: "2.0" }),
    mapShopRow({ ...v2Shop, id: "bron-4", telt_mee: false, uitsluitreden: "Aanvraag" }, { schemaVersion: "2.0" }),
  ];

  it("telt uitsluitend dossiers met telt_mee true", () => {
    expect(rows.filter(shopCounts)).toHaveLength(1);
  });

  it("bewaart alle dossiers, ook de niet-meetellende", () => {
    expect(rows).toHaveLength(3);
  });

  it("vervallen dossiers tellen nooit mee", () => {
    expect(shopCounts({ ...rows[0], vervallen: true })).toBe(false);
  });
});

describe("droogloop", () => {
  const payload = {
    schema_version: "2.0",
    coffeeshops: [v2Shop, v2Ruis],
    public_coffeeshops: [v2Shop],
    counts: { total: 2, public_total: 1 },
  };
  const rows = payload.coffeeshops.map((s) => mapShopRow(s, { schemaVersion: "2.0" }));

  it("rapporteert bronversie, totalen en ontbrekende velden zonder te schrijven", () => {
    const rapport = buildDryRunReport(payload, rows, []);
    expect(rapport.schema_version).toBe("2.0");
    expect(rapport.v2).toBe(true);
    expect(rapport.totaal_dossiers).toBe(2);
    expect(rapport.public_total).toBe(1);
    expect(rapport.telt_mee_true).toBe(1);
    expect(rapport.telt_mee_false).toBe(1);
    expect(rapport.telt_mee_onbekend).toBe(0);
    expect(rapport.zonder_huisnummer).toBe(0);
    expect(rapport.zonder_coordinaten).toBe(1); // het ruisdossier heeft geen coördinaten
  });

  it("meldt bestaande koppelingen die buiten de meetellende set vallen", () => {
    const rapport = buildDryRunReport(payload, rows, ["bron-2"]);
    expect(rapport.bestaande_koppelingen).toBe(1);
    expect(rapport.koppelingen_buiten_publieke_set).toBe(1);
    expect(rapport.voorbeelden_buiten_publieke_set[0]).toContain("Dubbel dossier");
  });

  it("laat bevestigde koppelingen met een meetellend dossier ongemoeid", () => {
    const rapport = buildDryRunReport(payload, rows, ["bron-1"]);
    expect(rapport.koppelingen_buiten_publieke_set).toBe(0);
  });
});

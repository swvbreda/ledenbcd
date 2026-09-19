import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "FinancienPage.tsx"), "utf8");

describe("FinancienPage tab layout", () => {
  it("heeft geen Informer-tab meer", () => {
    expect(source).not.toContain('value="informer"');
    expect(source).not.toContain("InformerSyncTab");
  });

  it("houdt Controle & sync als centraal tabblad", () => {
    expect(source).toContain('value="controle"');
  });

  it("heeft exact 7 tabbladen", () => {
    const triggers = source.match(/<TabsTrigger value="/g) || [];
    expect(triggers).toHaveLength(7);
  });

  it("gebruikt een responsieve grid zonder overflow-klassen", () => {
    expect(source).toContain('className="grid h-auto w-full max-w-full grid-cols-2');
    expect(source).toContain("lg:grid-cols-7");
    expect(source).not.toContain("sm:inline-flex");
    expect(source).not.toContain("sm:w-auto");
    expect(source).not.toContain("flex-nowrap");
  });

  it("laat alle triggers afbreken en meeschalen", () => {
    const triggerClasses = [...source.matchAll(/<TabsTrigger value="[^"]+" className="([^"]+)"/g)].map((m) => m[1]);
    expect(triggerClasses).toHaveLength(7);
    for (const cls of triggerClasses) {
      expect(cls).toContain("min-w-0");
      expect(cls).toContain("h-auto");
      expect(cls).toContain("whitespace-normal");
      expect(cls).toContain("text-center");
    }
  });
});

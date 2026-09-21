import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { directoryAccess } from "@/lib/memberDirectory";

const base = { isAdmin: false, isBoard: false, isExtern: false, isInhuur: false, linkedMemberIds: [] as number[] };

describe("directoryAccess", () => {
  it("beheer leest het volledige ledenbestand rechtstreeks", () => {
    expect(directoryAccess({ ...base, isAdmin: true, linkedMemberIds: [5] })).toEqual({
      canReadAll: true,
      canUseDirectory: false,
    });
  });

  it("bestuurslid met eigen ledenkoppeling leest eveneens alles rechtstreeks", () => {
    expect(directoryAccess({ ...base, isBoard: true, linkedMemberIds: [5] })).toEqual({
      canReadAll: true,
      canUseDirectory: false,
    });
  });

  it("gewoon lid met koppeling krijgt de geschoonde directory", () => {
    expect(directoryAccess({ ...base, linkedMemberIds: [9] })).toEqual({
      canReadAll: false,
      canUseDirectory: true,
    });
  });

  it("extern, inhuur en accounts zonder koppeling krijgen geen directory", () => {
    expect(directoryAccess({ ...base, isExtern: true, linkedMemberIds: [9] }).canUseDirectory).toBe(false);
    expect(directoryAccess({ ...base, isInhuur: true }).canUseDirectory).toBe(false);
    expect(directoryAccess({ ...base }).canUseDirectory).toBe(false);
  });
});

describe("ledenoverzichten verbergen gevoelige gegevens voor gewone leden", () => {
  it("de ledentabel toont eigenaar/contactpersoon alleen aan bestuur of beheer", () => {
    const source = readFileSync("src/components/MemberTable.tsx", "utf8");
    expect(source).toContain("const canSeeDetails = isAdmin || isBoard || isInhuur;");
  });

  it("de ledenpagina toont contact-, eigenaars- en KvK-gegevens alleen bij eigen rij of bestuur/beheer", () => {
    const source = readFileSync("src/pages/MemberDetail.tsx", "utf8");
    expect(source).toContain("const canSeeContacts = isAdmin || isBoard || isInhuur || isOwnProfile;");
    expect(source).toContain("loc.vergunninghouder && !canSeeRegister && canSeeOwnerInfo");
    expect(source).toContain("{loc.kvk && canSeeOwnerInfo && (");
  });

  it("de ledendirectory vraagt de database om geschoonde gegevens", () => {
    const source = readFileSync("src/contexts/MembersDataContext.tsx", "utf8");
    expect(source).toContain('supabase.rpc("get_members_directory")');
    expect(source).toContain("mergeDirectory(ownRows");
  });
});

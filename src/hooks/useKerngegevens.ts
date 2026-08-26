import { useMemo } from "react";
import type { Member, Location } from "@/data/types";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { useRegisterLinks } from "@/hooks/useCoffeeshopRegister";
import { isRealLocation, memberLocationCount, countLocations } from "@/lib/locationCount";
import { getGemeente } from "@/data/gemeenteMapping";
import { getMembershipYears } from "@/lib/membership";
import { bankFromIban, UNKNOWN_BANK, normalizeIban } from "@/lib/bankFromIban";

export type BankGroep = {
  bank: string;
  leden: Member[];
  aantal: number;
  pct: number;
};

export type OmvangBucket = {
  label: string;
  aantal: number;
  leden: Member[];
};

export type GemeenteRij = {
  gemeente: string;
  vestigingen: number;
  leden: number;
};

export type UboRij = {
  naam: string;
  vestigingen: number;
  leden: string[];
};

export function useKerngegevens(enabled = true) {
  const { rawMembers, isLoading: membersLoading } = useMembersData();
  const { members, isLoading: editsLoading } = useMergedMembers(rawMembers);
  const { data: links = [], isLoading: linksLoading } = useRegisterLinks(enabled);

  const gekoppeldeVestigingen = useMemo(
    () => links.filter((l) => l.status === "bevestigd").length,
    [links],
  );

  const result = useMemo(() => {
    const leden = members ?? [];
    const totaalLeden = leden.length;
    const totaalVestigingen = countLocations(leden);
    const gemiddeld = totaalLeden ? totaalVestigingen / totaalLeden : 0;

    // --- Banken -------------------------------------------------------
    const bankMap = new Map<string, Member[]>();
    for (const m of leden) {
      const ibans = (m.ibans ?? []).map(normalizeIban).filter(Boolean);
      const banken = Array.from(new Set(ibans.map((i) => bankFromIban(i))));
      const keys = banken.length ? banken : [UNKNOWN_BANK];
      for (const b of keys) {
        const list = bankMap.get(b) ?? [];
        list.push(m);
        bankMap.set(b, list);
      }
    }
    const bankGroepen: BankGroep[] = Array.from(bankMap.entries())
      .map(([bank, ledenLijst]) => ({
        bank,
        leden: ledenLijst,
        aantal: ledenLijst.length,
        pct: totaalLeden ? Math.round((ledenLijst.length / totaalLeden) * 100) : 0,
      }))
      .sort((a, b) => {
        if (a.bank === UNKNOWN_BANK) return 1;
        if (b.bank === UNKNOWN_BANK) return -1;
        return b.aantal - a.aantal;
      });
    const metIban = leden.filter((m) => (m.ibans ?? []).length > 0).length;

    // --- Omvang -------------------------------------------------------
    const buckets: { label: string; test: (n: number) => boolean }[] = [
      { label: "1 vestiging", test: (n) => n === 1 },
      { label: "2 vestigingen", test: (n) => n === 2 },
      { label: "3–5 vestigingen", test: (n) => n >= 3 && n <= 5 },
      { label: "6+ vestigingen", test: (n) => n >= 6 },
    ];
    const omvang: OmvangBucket[] = buckets.map((b) => {
      const groep = leden.filter((m) => b.test(memberLocationCount(m)));
      return { label: b.label, aantal: groep.length, leden: groep };
    });
    const multiShop = leden.filter((m) => memberLocationCount(m) > 1);
    const topLeden = [...leden]
      .map((m) => ({ member: m, vestigingen: memberLocationCount(m) }))
      .sort((a, b) => b.vestigingen - a.vestigingen)
      .slice(0, 10);

    // --- Geografie ----------------------------------------------------
    const perGemeente = new Map<string, { vestigingen: number; leden: Set<number> }>();
    const gemeentenPerLid = new Map<number, Set<string>>();
    for (const m of leden) {
      const locs = (m.locaties ?? []).filter(isRealLocation);
      const effectief: Location[] = locs.length ? locs : [{ naam: m.naam, plaats: m.plaats }];
      const set = new Set<string>();
      for (const loc of effectief) {
        const plaats = (loc.plaats || m.plaats || "").trim();
        if (!plaats) continue;
        const gem = getGemeente(plaats);
        set.add(gem);
        const entry = perGemeente.get(gem) ?? { vestigingen: 0, leden: new Set<number>() };
        entry.vestigingen += 1;
        entry.leden.add(m.id);
        perGemeente.set(gem, entry);
      }
      gemeentenPerLid.set(m.id, set);
    }
    const gemeenteRijen: GemeenteRij[] = Array.from(perGemeente.entries())
      .map(([gemeente, v]) => ({ gemeente, vestigingen: v.vestigingen, leden: v.leden.size }))
      .sort((a, b) => b.vestigingen - a.vestigingen);
    const ledenMeerdereGemeenten = Array.from(gemeentenPerLid.values()).filter((s) => s.size > 1).length;

    // --- Historie -----------------------------------------------------
    const decennia = new Map<string, number>();
    let metOprichting = 0;
    for (const m of leden) {
      for (const loc of (m.locaties ?? []).filter(isRealLocation)) {
        const jaarStr = (loc.oprichtingsDatum || "").slice(0, 4);
        const jaar = Number(jaarStr);
        if (!Number.isFinite(jaar) || jaar < 1900) continue;
        metOprichting += 1;
        const dec = `${Math.floor(jaar / 10) * 10}s`;
        decennia.set(dec, (decennia.get(dec) ?? 0) + 1);
      }
    }
    const decenniaRijen = Array.from(decennia.entries())
      .map(([label, aantal]) => ({ label, aantal }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const duurBuckets = [
      { label: "< 5 jaar", test: (n: number) => n < 5 },
      { label: "5–9 jaar", test: (n: number) => n >= 5 && n < 10 },
      { label: "10–19 jaar", test: (n: number) => n >= 10 && n < 20 },
      { label: "20+ jaar", test: (n: number) => n >= 20 },
    ];
    const jaren = leden
      .map((m) => getMembershipYears(m))
      .filter((n): n is number => typeof n === "number");
    const duurRijen = duurBuckets.map((b) => ({
      label: b.label,
      aantal: jaren.filter(b.test).length,
    }));
    const gemiddeldeDuur = jaren.length
      ? Math.round((jaren.reduce((s, n) => s + n, 0) / jaren.length) * 10) / 10
      : 0;

    // --- UBO ----------------------------------------------------------
    const uboMap = new Map<string, { vestigingen: number; leden: Set<string> }>();
    let vestigingenMetUbo = 0;
    for (const m of leden) {
      for (const loc of (m.locaties ?? []).filter(isRealLocation)) {
        const ubos = (loc.ubo ?? []).filter((u) => u?.naam?.trim());
        if (!ubos.length) continue;
        vestigingenMetUbo += 1;
        const uniek = new Set(ubos.map((u) => u.naam.trim()));
        for (const naam of uniek) {
          const entry = uboMap.get(naam) ?? { vestigingen: 0, leden: new Set<string>() };
          entry.vestigingen += 1;
          entry.leden.add(m.naam);
          uboMap.set(naam, entry);
        }
      }
    }
    const uboRijen: UboRij[] = Array.from(uboMap.entries())
      .map(([naam, v]) => ({ naam, vestigingen: v.vestigingen, leden: Array.from(v.leden) }))
      .filter((r) => r.vestigingen > 1)
      .sort((a, b) => b.vestigingen - a.vestigingen);

    return {
      totaalLeden,
      totaalVestigingen,
      gemiddeld,
      gekoppeldeVestigingen,
      bankGroepen,
      metIban,
      omvang,
      multiShop: multiShop.length,
      topLeden,
      gemeenteRijen,
      ledenMeerdereGemeenten,
      decenniaRijen,
      metOprichting,
      duurRijen,
      gemiddeldeDuur,
      vestigingenMetUbo,
      uboRijen,
      uniekeUbos: uboMap.size,
    };
  }, [members, gekoppeldeVestigingen]);

  return {
    ...result,
    isLoading: membersLoading || editsLoading || linksLoading,
  };
}

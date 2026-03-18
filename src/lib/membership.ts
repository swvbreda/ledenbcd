import type { Member } from "@/data/types";

type MemberYearsSource = Pick<Member, "jarenLid" | "lidSinds">;

export const getMembershipYears = (member: MemberYearsSource): number | null => {
  if (typeof member.lidSinds === "number") {
    const years = new Date().getFullYear() - member.lidSinds;
    return years >= 0 ? years : null;
  }

  return typeof member.jarenLid === "number" ? member.jarenLid : null;
};

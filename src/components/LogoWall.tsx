import { useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useRegisterLogos } from "@/hooks/useRegisterLogos";
import { useMembersData } from "@/contexts/MembersDataContext";

/**
 * Logowand met de aangesloten coffeeshops. De logo's komen automatisch uit het
 * register; er hoeft niets handmatig te worden geüpload.
 */
const LogoWall = () => {
  const navigate = useNavigate();
  const { data: registerLogos } = useRegisterLogos();
  const { rawMembers } = useMembersData();

  const items = useMemo(() => {
    if (!registerLogos) return [];
    const namen = new Map(rawMembers.map((m) => [m.id, m.naam]));
    const gezien = new Set<string>();
    const list: Array<{ memberId: number; naam: string; url: string }> = [];
    for (const row of registerLogos.rows) {
      const naam = namen.get(row.member_id);
      if (!naam || gezien.has(row.logo_url)) continue;
      gezien.add(row.logo_url);
      list.push({ memberId: row.member_id, naam, url: row.logo_url });
    }
    return list.sort((a, b) => a.naam.localeCompare(b.naam));
  }, [registerLogos, rawMembers]);

  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-5 space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display uppercase text-sm">Aangesloten coffeeshops</h2>
        <span className="text-xs text-muted-foreground">{items.length} logo's</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
        {items.map((item) => (
          <button
            key={`${item.memberId}-${item.url}`}
            type="button"
            title={item.naam}
            onClick={() => navigate(`/leden/${item.memberId}`)}
            className="aspect-square rounded-md border border-border bg-background p-2 hover:border-primary transition-colors"
          >
            <img
              src={item.url}
              alt={`Logo ${item.naam}`}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default LogoWall;

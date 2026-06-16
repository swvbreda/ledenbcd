import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, Search, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useWhatsAppPreferences, useSetWhatsAppPreference } from "@/hooks/useWhatsApp";

const WhatsAppInstellingen = () => {
  const { rawMembers } = useMembersData();
  const { data: prefs = {}, isLoading } = useWhatsAppPreferences();
  const setPref = useSetWhatsAppPreference();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rawMembers
      .filter((m) => {
        if (!q) return true;
        return (
          (m.naam || "").toLowerCase().includes(q) ||
          (m.bedrijfsnaam || "").toLowerCase().includes(q) ||
          (m.plaats || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.naam || "").localeCompare(b.naam || ""));
  }, [rawMembers, query]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-brand-red/10 p-2 shrink-0">
            <Settings className="text-brand-red" size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-base">WhatsApp-voorkeuren per lid</h2>
            <p className="text-sm text-muted-foreground">
              Standaard ontvangen alle leden WhatsApp-notificaties. Zet uit voor leden die dat niet willen.
              Geblokkeerde nummers kunnen ons ook niet meer berichten.
            </p>
          </div>
        </div>

        <Input
          placeholder="Zoek lid…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md mb-3"
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md max-h-[500px] overflow-y-auto">
            {filtered.map((m) => {
              const pref = prefs[m.id];
              const optedIn = pref?.opted_in ?? true;
              const blocked = pref?.blocked ?? false;
              return (
                <li key={m.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/leden/${m.id}`} className="font-medium text-sm hover:text-brand-red">
                      {m.naam || m.bedrijfsnaam || `Lid #${m.id}`}
                    </Link>
                    {m.plaats && <span className="text-xs text-muted-foreground"> · {m.plaats}</span>}
                    {m.telefoon && (
                      <p className="text-xs text-muted-foreground font-mono">{m.telefoon}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Opt-in</span>
                      <Switch
                        checked={optedIn}
                        disabled={setPref.isPending}
                        onCheckedChange={(v) => setPref.mutate({ member_id: m.id, opted_in: v })}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Shield size={12} className={blocked ? "text-brand-red" : "text-muted-foreground"} />
                      <Switch
                        checked={blocked}
                        disabled={setPref.isPending}
                        onCheckedChange={(v) => setPref.mutate({ member_id: m.id, blocked: v })}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WhatsAppInstellingen;
import { Badge } from "@/components/ui/badge";
import type { RegisterLink, RegisterShop, RegisterUbo } from "@/hooks/useCoffeeshopRegister";
import type { UboEntry } from "@/data/types";

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

const Row = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-foreground ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </span>
    </div>
  );
};


const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
);

export type LocationRegisterInfoProps = {
  link?: RegisterLink | null;
  shop?: RegisterShop | null;
  /** UBO-keten die bij het lid is opgeslagen. */
  memberUbo?: UboEntry[] | null;
  /** UBO-keten uit het register voor de gekoppelde vestiging. */
  registerUbo?: RegisterUbo[] | null;
  /** KvK-nummer zoals handmatig vastgelegd bij de locatie (heeft voorrang). */
  memberKvk?: string | null;
  /** Website van deze vestiging zoals vastgelegd bij het lid (heeft voorrang). */
  memberWebsite?: string | null;
};

/** Toont een nette URL zonder protocol, trailing slash en tracking-parameters. */
export const cleanUrl = (url?: string | null) => {
  if (!url) return null;
  const stripped = url.split(/[?#]/)[0];
  return stripped.replace(/^https?:\/\//, "").replace(/\/$/, "") || null;
};


/**
 * KvK-, UBO- en registergegevens van één vestiging, in een vaste volgorde zodat
 * alle locatiekaarten dezelfde opbouw en uitlijning houden.
 */
const LocationRegisterInfo = ({
  link,
  shop,
  memberUbo,
  registerUbo,
  memberKvk,
  memberWebsite,
}: LocationRegisterInfoProps) => {
  const kvk = memberKvk?.trim() || shop?.kvk_nummer || null;
  const vestigingsnummer = shop?.kvk_vestigingsnummer || null;
  const vestigingDatum = fmt(shop?.kvk_vestiging_datum);
  const websiteRaw = memberWebsite?.trim() || shop?.website || null;
  const websiteLabel = cleanUrl(websiteRaw);

  const ubo: UboEntry[] =
    memberUbo && memberUbo.length > 0
      ? memberUbo
      : (registerUbo ?? []).map((u) => ({
          naam: u.naam,
          kvk: u.kvk_nummer,
          niveau: u.niveau,
          soort: u.soort,
          uiteindelijkBelanghebbende: u.is_uiteindelijk,
          toelichting: u.toelichting,
        }));

  const adres = shop
    ? [shop.straat, shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join(" ")
    : "";

  return (
    <div className="mt-3 flex flex-1 flex-col gap-3">
      {/* KvK-gegevens: alleen tonen als we iets weten */}
      {(kvk || vestigingsnummer || vestigingDatum || websiteLabel) && (
        <div className="border-t border-border pt-2.5 space-y-1">
          <SectionTitle>KvK</SectionTitle>
          <Row label="KvK-nummer" value={kvk} mono />
          <Row label="Vestigingsnr." value={vestigingsnummer} mono />
          <Row label="Vestiging sinds" value={vestigingDatum} />
          {websiteLabel && (
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs">
              <span className="text-muted-foreground">Website</span>
              <a
                href={websiteRaw!.startsWith("http") ? websiteRaw! : `https://${websiteRaw}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-words text-foreground hover:underline"
              >
                {websiteLabel}
              </a>
            </div>
          )}
        </div>
      )}


      {/* Eigendomsketen */}
      {ubo.length > 0 && (
        <div className="border-t border-border pt-2.5 space-y-1">
          <SectionTitle>Eigendomsketen (UBO)</SectionTitle>
          <ul className="space-y-0.5">
            {ubo.map((u, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span style={{ paddingLeft: `${(u.niveau ?? 0) * 10}px` }}>
                  {u.naam}
                  {u.kvk && <span className="font-mono tabular-nums"> · KvK {u.kvk}</span>}
                  {u.uiteindelijkBelanghebbende && (
                    <span className="ml-1 font-medium text-primary">· UBO</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Register */}
      <div className="mt-auto border-t border-border pt-2.5 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>Register</SectionTitle>
          {link && shop ? (
            <Badge variant={link.status === "bevestigd" ? "default" : "secondary"} className="text-[10px]">
              {link.status === "bevestigd" ? "Bevestigd" : "Voorstel"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Niet gekoppeld
            </Badge>
          )}
        </div>

        {link && shop && (
          <>
            <Row
              label="Dossier"
              value={[shop.naam, adres || null, shop.plaats].filter(Boolean).join(" · ") || null}
            />
            <Row label="Vergunninghouder" value={shop.vergunninghouder} />
            {shop.exploitant && shop.exploitant !== shop.vergunninghouder && (
              <Row label="Exploitant" value={shop.exploitant} />
            )}
            <Row
              label="Vergunning"
              value={
                [shop.vergunningnummer, shop.vergunningverlening ? `sinds ${fmt(shop.vergunningverlening)}` : null]
                  .filter(Boolean)
                  .join(" · ") || null
              }
            />
            <Row label="Status" value={shop.status} />
          </>
        )}

      </div>
    </div>
  );
};

export default LocationRegisterInfo;

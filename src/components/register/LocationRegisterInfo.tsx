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
  /** Vergunninghoudende onderneming zoals vastgelegd bij de locatie (heeft voorrang). */
  memberVergunninghouder?: string | null;
  /** Exploitant zoals vastgelegd bij de locatie (heeft voorrang). */
  memberExploitant?: string | null;
  /** Vestigingsnummer zoals vastgelegd bij de locatie (heeft voorrang). */
  memberVestigingsnummer?: string | null;
  /** Website van deze vestiging zoals vastgelegd bij het lid (heeft voorrang). */
  memberWebsite?: string | null;
  /** Logo zoals vastgelegd bij het lid (heeft voorrang op het registerlogo). */
  memberLogo?: string | null;
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
  memberVergunninghouder,
  memberExploitant,
  memberVestigingsnummer,
  memberWebsite,
  memberLogo,
}: LocationRegisterInfoProps) => {
  const kvk = memberKvk?.trim() || shop?.kvk_nummer || null;
  const vergunninghouder = memberVergunninghouder?.trim() || shop?.vergunninghouder || null;
  const exploitantRaw = memberExploitant?.trim() || shop?.exploitant || null;
  const exploitant = exploitantRaw && exploitantRaw !== vergunninghouder ? exploitantRaw : null;
  const vestigingsnummer = memberVestigingsnummer?.trim() || shop?.kvk_vestigingsnummer || null;
  const vestigingDatum = fmt(shop?.kvk_vestiging_datum);
  const websiteRaw = memberWebsite?.trim() || shop?.website || null;
  const websiteLabel = cleanUrl(websiteRaw);
  const logo = memberLogo?.trim() || shop?.logo_url || null;
  const socials = shop?.socials ?? null;
  const instagram = socials?.instagram ?? null;
  const facebook = socials?.facebook ?? null;


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
      {logo && (
        <img
          src={logo}
          alt="Logo vestiging"
          loading="lazy"
          className="h-10 w-auto max-w-[9rem] self-start object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {/* Onderneming: de B.V. achter deze vestiging */}
      <div className="border-t border-border pt-2.5 space-y-1">
        <SectionTitle>Onderneming</SectionTitle>
        <Row label="Vergunninghouder" value={vergunninghouder ?? "Onbekend"} />
        <Row label="Exploitant" value={exploitant} />
        <Row label="KvK-nummer" value={kvk} mono />
        <Row label="Vestigingsnr." value={vestigingsnummer} mono />
        <Row label="Vestiging sinds" value={vestigingDatum} />
      </div>

      {/* Contactgegevens van deze vestiging */}
      {websiteLabel && (
        <div className="border-t border-border pt-2.5 space-y-1">
          <SectionTitle>Contact</SectionTitle>

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


      {(instagram || facebook) && (
        <div className="border-t border-border pt-2.5 space-y-1">
          <SectionTitle>Social media</SectionTitle>
          {[["Instagram", instagram], ["Facebook", facebook]].map(([label, url]) =>
            url ? (
              <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <a
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 break-words text-foreground hover:underline"
                >
                  {cleanUrl(url as string)}
                </a>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Eigendomsketen */}
      {ubo.length > 0 && (
        <div className="border-t border-border pt-2.5 space-y-1">
          <SectionTitle>Eigendomsketen</SectionTitle>
          <ul className="space-y-0.5">
            {ubo.map((u, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span style={{ paddingLeft: `${(u.niveau ?? 0) * 10}px` }}>
                  {u.naam}
                  {u.kvk && <span className="font-mono tabular-nums"> · KvK {u.kvk}</span>}
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

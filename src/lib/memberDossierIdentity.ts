/** Current canonical rows own their IDs; historical conversions never override them. */
export function memberDossierRedirect(
  id: number,
  currentIds: number[],
  conversions: Array<{ lead_id: number; lidnummer: number }>,
): number | undefined {
  if (!Number.isSafeInteger(id) || id <= 0 || currentIds.includes(id)) return undefined;
  const targets = [...new Set(conversions.filter(c => c.lead_id === id).map(c => c.lidnummer))];
  if (targets.length !== 1) return undefined;
  const target = targets[0];
  if (target !== id && currentIds.includes(target)) return target;
  return undefined;
}

type Shop = { id: number; naam: string; plaats: string };
type Signup = { matched_member_id?: number | null; coffeeshop_name: string; city: string; match_status?: string | null };
const normalize = (value: string) => value.trim().toLowerCase();
// Mirror normalize_shop_naam for navigation only; never use this to grant access.
const normalizeShopName = (value: string) => value.toLowerCase()
  .replace(/[áàâäãåéèêëíìîïóòôöõúùûüçñ]/g, char =>
    'aaaaaaeeeeiiiiooooouuuucn'['áàâäãåéèêëíìîïóòôöõúùûüçñ'.indexOf(char)] ?? char)
  .replace(/\b(coffeeshop|koffieshop|coffee shop|shop|de|het|the|bv|b\.v\.)\b/g, ' ')
  .replace(/[^a-z0-9]/g, '');

/** This selects an admin navigation target, not an account-access grant. */
export function resolveSignupDossier<T extends Shop>(signup: Signup, dossiers: T[]): { member?: T; blocked: boolean } {
  const sameShop = (m: Shop) => !!normalizeShopName(signup.coffeeshop_name) && !!normalize(signup.city)
    && normalizeShopName(m.naam) === normalizeShopName(signup.coffeeshop_name) && normalize(m.plaats) === normalize(signup.city);
  if (signup.matched_member_id != null) {
    const member = dossiers.find(m => m.id === signup.matched_member_id);
    return member && sameShop(member) ? { member, blocked: false } : { blocked: true };
  }
  if (signup.match_status === 'review') return { blocked: true };
  const matches = dossiers.filter(sameShop);
  return matches.length > 1 ? { blocked: true } : { member: matches[0], blocked: false };
}
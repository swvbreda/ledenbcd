/** Pure decision function mirrors the server's active-member lookup. */
export function eligibleMemberId(email: string, matches: Array<{ memberId: number; active: boolean }>): number | null {
  const unique = [...new Set(matches.filter(m => m.active).map(m => m.memberId))];
  return email === email.trim().toLowerCase() && unique.length === 1 ? unique[0] : null;
}

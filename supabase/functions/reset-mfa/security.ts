export function recentAal2(claims: Record<string, unknown>, userId: string, now: number): boolean {
 if(claims.sub!==userId||claims.aal!=='aal2'||typeof claims.exp!=='number'||claims.exp<=now)return false;
 if(!Array.isArray(claims.amr))return false;
 return claims.amr.some((entry:unknown)=>{
  if(!entry||typeof entry!=='object')return false;
  const x=entry as Record<string,unknown>;
  return x.method==='totp'&&typeof x.timestamp==='number'&&x.timestamp<=now&&now-x.timestamp<=300;
 });
}

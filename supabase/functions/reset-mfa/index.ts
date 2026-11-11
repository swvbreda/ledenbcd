import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { recentAal2 } from './security.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!url||!key||!token)return json({error:'Niet ingelogd.'},401);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:user,error}=await client.auth.getUser(token);
  if(error||!user.user)return json({error:'Ongeldige sessie.'},401);
  // getClaims cryptographically verifies the JWT (including legacy HS256 via Auth); never decode-only.
  const {data:verified,error:claimsError}=await client.auth.getClaims(token);
  if(claimsError||!verified||!recentAal2(verified.claims,user.user.id,Math.floor(Date.now()/1000)))return json({error:'Verifieer uw authenticator opnieuw. Voor een verloren factor: neem contact op met het secretariaat voor beheerherstel.'},403);
  const p=await req.json();
  if(typeof p.factorId!=='string'||!user.user.factors?.some(f=>f.id===p.factorId&&f.factor_type==='totp'))return json({error:'Selecteer één eigen authenticator.'},400);
  // Auth enforces ownership/AAL2 itself; there is no privileged delete or bulk reset.
  const r=await fetch(url+'/auth/v1/factors/'+encodeURIComponent(p.factorId),{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+token}});
  if(!r.ok)return json({error:'Authenticator kon niet worden verwijderd.'},r.status===401?401:403);
  return json({success:true,unenrolled:1});
 }catch{return json({error:'Verwijderen kon niet worden verwerkt.'},400);}
});

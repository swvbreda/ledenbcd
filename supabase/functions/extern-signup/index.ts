import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key)throw new Error('Configuration unavailable');
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return json({error:'Bevestig eerst uw e-mailadres en log in.'},401);
  const client=createClient(url,key,{accessToken:async()=>token,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
  if(!r.ok)return json({error:'Ongeldige sessie.'},401);
  const u=await r.json();if(!u.id||!u.email_confirmed_at)return json({error:'Bevestig eerst uw e-mailadres.'},403);
  const p=await req.json();
  const {data,error}=await client.rpc('submit_verified_external_signup',{p_name:p.organization_name,p_type:p.organization_type,p_contact:p.contact_name});
  if(error)return json({error:'Aanvraag niet toegestaan. Bevestig uw e-mailadres; bestaande organisaties worden alleen door beheer gekoppeld.'},403);
  return json({success:true,approvalRequired:true,orgId:data});
 }catch{return json({error:'Aanvraag kon niet worden verwerkt.'},400);}
});

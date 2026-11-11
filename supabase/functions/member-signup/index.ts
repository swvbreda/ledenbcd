import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { registerAllowedMember } from './signup.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response(null,{headers:cors});
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 try {
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key) throw new Error('Configuration unavailable');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const result=await registerAllowedMember(await req.json(),{
   confirmationEnabled:async()=>{const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});if(!r.ok)return false;return (await r.json()).mailer_autoconfirm===false;},
   signUp:async(email,password)=>{const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:'https://leden.coffeeshopbond.nl/login'}});if(error)throw error;return {hasSession:!!data.session};}
  });
  return json(result.body,result.status);
 } catch {return json({error:'Registratie kon niet worden verwerkt. Probeer later opnieuw.'},400);}
});

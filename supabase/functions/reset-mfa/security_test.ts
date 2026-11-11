import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { recentAal2 } from './security.ts';
const now=2000;
Deno.test('AAL1 cannot remove factors',()=>assertEquals(recentAal2({sub:'self',aal:'aal1',exp:3000,amr:[{method:'password',timestamp:now}]},'self',now),false));
Deno.test('recent verified AAL2 self allowed',()=>assertEquals(recentAal2({sub:'self',aal:'aal2',exp:3000,amr:[{method:'totp',timestamp:1800}]},'self',now),true));
Deno.test('stale future expired missing and other identity refused',()=>{for(const x of [{sub:'other',aal:'aal2',exp:3000,amr:[{method:'totp',timestamp:now}]},{sub:'self',aal:'aal2',exp:1999,amr:[{method:'totp',timestamp:now}]},{sub:'self',aal:'aal2',exp:3000,amr:[{method:'totp',timestamp:1600}]},{sub:'self',aal:'aal2',exp:3000,amr:[{method:'totp',timestamp:2001}]},{}])assertEquals(recentAal2(x,'self',now),false)});

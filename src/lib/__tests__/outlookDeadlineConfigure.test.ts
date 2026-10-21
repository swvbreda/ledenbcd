import { afterEach,describe,it,expect,vi } from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),token:vi.fn(),calendar:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc:m.rpc}}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('../plannerGraph.server',()=>({readGraphConfig:()=>({}),getAppToken:m.token}));
vi.mock('../outlookDeadlineGraph.server',()=>({deadlineGraph:()=>({calendar:m.calendar})}));
import { configureDeadlineHandler } from '../outlookDeadlines.functions';
const context=()=>({userId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',supabase:{rpc:vi.fn(async()=>({data:true,error:null})),from:()=>({select:()=>({not:()=>({not:()=>({limit:async()=>({data:[{user_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',entra_id:'cccccccc-cccc-cccc-cccc-cccccccccccc'}],error:null})})})})})}});
function setup(){
 vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','true');vi.stubEnv('INTERNAL_WEBHOOK_SECRET','fixture');
 m.rpc.mockImplementation(async name=>name==='outlook_deadline_scheduler_status'?{data:{installed:true,vaultConfigured:true},error:null}:{data:null,error:null});
 m.token.mockResolvedValue({token:'fixture',roles:['Calendars.ReadWrite']});m.calendar.mockResolvedValue({id:'cal',canEdit:true});
}
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
describe('reviewed configure adapter',()=>{
 it('same existing switch calls atomic configure only after mailbox checks',async()=>{setup();await configureDeadlineHandler({data:{enabled:true,confirm:true},context:context()});expect(m.calendar).toHaveBeenCalledWith('cccccccc-cccc-cccc-cccc-cccccccccccc');expect(m.rpc).toHaveBeenLastCalledWith('outlook_deadline_configure',{_enabled:true,_actor:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});});
 it.each(['absent','error','vault'])('%s installation refuses before Microsoft',async mode=>{setup();m.rpc.mockResolvedValue({data:{installed:mode!=='absent',vaultConfigured:mode!=='vault'},error:mode==='error'?{}:null});await expect(configureDeadlineHandler({data:{enabled:true,confirm:true},context:context()})).rejects.toThrow('deadlineplanning');expect(m.token).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledTimes(1);});
 it('nonadmin cannot load privileged configure',async()=>{setup();const c=context();c.supabase.rpc.mockResolvedValue({data:false,error:null});await expect(configureDeadlineHandler({data:{enabled:true,confirm:true},context:c})).rejects.toThrow('beheerders');expect(m.rpc).not.toHaveBeenCalled();});
 it('release off refuses before Microsoft/privileged RPC',async()=>{setup();vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','false');await expect(configureDeadlineHandler({data:{enabled:true,confirm:true},context:context()})).rejects.toThrow('Activatie');expect(m.rpc).not.toHaveBeenCalled();expect(m.token).not.toHaveBeenCalled();});
 it('disable calls same transaction without release/config/mailbox dependencies',async()=>{setup();vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','false');vi.stubEnv('INTERNAL_WEBHOOK_SECRET','');await configureDeadlineHandler({data:{enabled:false,confirm:true},context:context()});expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.rpc).toHaveBeenCalledWith('outlook_deadline_configure',{_enabled:false,_actor:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});expect(m.token).not.toHaveBeenCalled();expect(m.calendar).not.toHaveBeenCalled();});
 it('mailbox failure never configures',async()=>{setup();m.calendar.mockResolvedValue({id:'',canEdit:true});await expect(configureDeadlineHandler({data:{enabled:true,confirm:true},context:context()})).rejects.toThrow('agenda');expect(m.rpc).toHaveBeenCalledTimes(1);});
});

import {describe,it,expect,vi,afterEach} from 'vitest';
import {getAuthBearer,setAuthBearer} from '../authBearer';
const mocked=vi.hoisted(()=>({getSession:vi.fn(),handler:null as null|((args:{next:ReturnType<typeof vi.fn>})=>Promise<unknown>)}));
vi.mock('@tanstack/react-start',()=>({createMiddleware:()=>({client:(fn:any)=>{mocked.handler=fn;return fn;}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:mocked.getSession}}}));
import '../supabaseAuthAttacher';
afterEach(()=>{setAuthBearer(null);vi.clearAllMocks();});
describe('auth delivered bearer transport',()=>{
 it('sends delivered token without waiting for blocked broker storage',async()=>{setAuthBearer('synthetic-delivered');mocked.getSession.mockImplementation(()=>new Promise(()=>{}));const next=vi.fn().mockResolvedValue('sent');await mocked.handler?.({next});expect(next).toHaveBeenCalledWith({headers:{Authorization:'Bearer synthetic-delivered'}});expect(mocked.getSession).not.toHaveBeenCalled();});
 it('replaces refreshed bearer and clears it on sign-out',()=>{setAuthBearer('synthetic-old');setAuthBearer('synthetic-new');expect(getAuthBearer()).toBe('synthetic-new');setAuthBearer(null);expect(getAuthBearer()).toBeNull();});
 it('uses ordinary session lookup when no Auth event has arrived',async()=>{mocked.getSession.mockResolvedValue({data:{session:{access_token:'synthetic-fallback'}}});const next=vi.fn().mockResolvedValue('sent');await mocked.handler?.({next});expect(next).toHaveBeenCalledWith({headers:{Authorization:'Bearer synthetic-fallback'}});});
});
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MinutesTaskControls} from '../MinutesTaskStatus';
import type {MinutesTasksResult} from '@/lib/boardMinutesTasks';
const mocks=vi.hoisted(()=>({load:vi.fn(),activate:vi.fn(),assign:vi.fn(),complete:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/router-compat',()=>({Link:({children,to}:any)=><a href={to}>{children}</a>}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(f:any)=>f}));
vi.mock('@/lib/boardMinutesTasks.functions',()=>({loadMinutesTasks:mocks.load,activateMinutesTasks:mocks.activate,assignMinutesTask:mocks.assign,setMinutesTaskStatus:mocks.complete}));
vi.mock('@/lib/internalWork',()=>({completeTaskLocally:mocks.complete}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({update:mocks.update})}}));
vi.mock('@/lib/callerClient',()=>({callerSupabase:async()=>({from:()=>({update:mocks.update})})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const row={action_id:'a',row_index:0,action:'Synthetic task',owner:'Tester + betrokken bestuursleden',deadline:'',task_id:'t',status:'te_doen',can_status:true,assignees:[{user_id:'u',name:'Tester'}],needs_assignment:true,completed_by:null,completed_name:null,completed_at:null};
function mount(value:MinutesTasksResult,canActivate=false){mocks.load.mockResolvedValue(value);return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MinutesTaskControls versionId="v" userId="u" canActivate={canActivate}/></QueryClientProvider>);}
describe('private minutes task controls',()=>{
 it('assigned non-admin completes one shared task without management rights',async()=>{mount({enabled:true,can_manage:false,rows:[{...row,owner:'Bestuur',collective_board:true,board_responsibles:[{user_id:'u',name:'Tester'},{user_id:null,name:'No account'}]}],staff:[]});fireEvent.click(await screen.findByRole('button',{name:'Afronden'}));await waitFor(()=>expect(mocks.complete).toHaveBeenCalledTimes(1));expect(mocks.complete).toHaveBeenCalledWith({data:{taskId:'t',completed:true}});expect(screen.queryByRole('button',{name:'Toewijzing'})).toBeNull();expect(screen.queryByRole('link',{name:'Taak openen'})).toBeNull();});
 it('unassigned board readers see projected status without task mutation commands',async()=>{mount({enabled:true,can_manage:false,rows:[{...row,can_status:false}],staff:[]});await screen.findByText('Synthetic task');expect(screen.queryByRole('button',{name:'Afronden'})).toBeNull();expect(screen.queryByRole('button',{name:'Toewijzing'})).toBeNull();expect(screen.getByText(/Overige toewijzing nodig/)).toBeTruthy();});
 it('admin completion uses the same status RPC',async()=>{mount({enabled:true,can_manage:true,rows:[row],staff:[]});fireEvent.click(await screen.findByRole('button',{name:'Afronden'}));await waitFor(()=>expect(mocks.complete).toHaveBeenCalledWith({data:{taskId:'t',completed:true}}));expect(screen.getByRole('link',{name:'Taak openen'}).getAttribute('href')).toBe('/projecten?task=t');});
 it('activation requires explicit confirmation and only operates on current version',async()=>{mount({enabled:false,can_manage:true,rows:[],staff:[]},true);fireEvent.click(await screen.findByRole('button',{name:'15 conceptacties aan taken koppelen'}));expect(mocks.activate).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Bevestig taakregistratie'}));await waitFor(()=>expect(mocks.activate).toHaveBeenCalledWith({data:{versionId:'v',confirm:true}}));});
 it('assigned non-admin reopens the same task',async()=>{mount({enabled:true,can_manage:false,rows:[{...row,status:'afgerond',completed_name:'Tester',completed_at:'2026-11-09T12:00:00Z'}],staff:[]});fireEvent.click(await screen.findByRole('button',{name:'Heropenen'}));await waitFor(()=>expect(mocks.complete).toHaveBeenCalledWith({data:{taskId:'t',completed:false}}));expect(mocks.update).not.toHaveBeenCalled();});
});
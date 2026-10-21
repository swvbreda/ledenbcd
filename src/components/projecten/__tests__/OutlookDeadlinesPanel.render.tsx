import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
const {status,configure,dispatch}=vi.hoisted(()=>({status:vi.fn(),configure:vi.fn(),dispatch:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'admin'}})}));
vi.mock('@/lib/outlookDeadlines.functions',()=>({outlookDeadlineStatus:status,configureOutlookDeadlines:configure,dispatchOutlookDeadlines:dispatch}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(f:unknown)=>f}));
import Panel from '../OutlookDeadlinesPanel';
afterEach(cleanup);
describe('Outlook deadline settings',()=>{
 it('disabled until reviewed, no dispatch on opening',async()=>{
 status.mockResolvedValue({enabled:false,releaseReady:false,mappings:0,rows:[]});
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[]}/></QueryClientProvider>);
 expect(await screen.findByText('Synchronisatie uit')).toBeTruthy();expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Deadline-items bijwerken'}) as HTMLButtonElement).disabled).toBe(true);expect(dispatch).not.toHaveBeenCalled();expect(configure).not.toHaveBeenCalled();
 });
 it('uncertain outcome remains visible',async()=>{
 status.mockResolvedValue({enabled:false,releaseReady:false,mappings:0,rows:[{task_id:'t',state:'uncertain',last_error:'Controleer Outlook',updated_at:''}]});
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[{id:'t',title:'Deadline'}]}/></QueryClientProvider>);
 expect(await screen.findByText(/Uitkomst onbekend/)).toBeTruthy();expect(dispatch).not.toHaveBeenCalled();
 });
});

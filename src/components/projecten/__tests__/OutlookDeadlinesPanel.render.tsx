import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
const {status,configure,dispatch}=vi.hoisted(()=>({status:vi.fn(),configure:vi.fn(),dispatch:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'admin'}})}));
vi.mock('@/lib/outlookDeadlines.functions',()=>({outlookDeadlineStatus:status,configureOutlookDeadlines:configure,dispatchOutlookDeadlines:dispatch}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(f:unknown)=>f}));
import Panel from '../OutlookDeadlinesPanel';
afterEach(()=>{cleanup();vi.clearAllMocks();vi.restoreAllMocks();});
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
 it.each([null,{installed:false,armed:false,active:false,vaultConfigured:true},{installed:true,armed:false,active:false,vaultConfigured:false}])('refuses activation when installation unavailable',async scheduler=>{
 status.mockResolvedValue({enabled:false,releaseReady:true,internalConfigured:true,scheduler,mappings:1,rows:[]});
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[]}/></QueryClientProvider>);
 await screen.findByText('Synchronisatie uit');expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);expect(configure).not.toHaveBeenCalled();
 });
 it('reviewed switch calls enable only after explicit confirmation',async()=>{
 status.mockResolvedValue({enabled:false,releaseReady:true,internalConfigured:true,scheduler:{installed:true,armed:false,active:false,vaultConfigured:true},mappings:1,rows:[]});configure.mockResolvedValue({enabled:true});vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[]}/></QueryClientProvider>);
 await screen.findByText('Synchronisatie uit');fireEvent.click(screen.getByRole('switch'));
 await waitFor(()=>expect(configure).toHaveBeenCalledWith({data:{enabled:true,confirm:true}}));expect(dispatch).not.toHaveBeenCalled();
 });
 it('pause remains available when release/install checks fail',async()=>{
 status.mockResolvedValue({enabled:true,releaseReady:false,internalConfigured:false,scheduler:null,mappings:0,rows:[]});configure.mockResolvedValue({enabled:false});vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[]}/></QueryClientProvider>);
 await screen.findByText('Synchronisatie aan');expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(false);fireEvent.click(screen.getByRole('switch'));
 await waitFor(()=>expect(configure).toHaveBeenCalledWith({data:{enabled:false,confirm:true}}));
 });
 it('failed enable does not optimistically enable the switch',async()=>{
 status.mockResolvedValue({enabled:false,releaseReady:true,internalConfigured:true,scheduler:{installed:true,armed:false,active:false,vaultConfigured:true},mappings:1,rows:[]});configure.mockRejectedValue(new Error('Deadlineplanning ontbreekt'));vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<QueryClientProvider client={new QueryClient()}><Panel tasks={[]}/></QueryClientProvider>);
 await screen.findByText('Synchronisatie uit');fireEvent.click(screen.getByRole('switch'));
 await screen.findByRole('alert');expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');expect(dispatch).not.toHaveBeenCalled();
 });
});

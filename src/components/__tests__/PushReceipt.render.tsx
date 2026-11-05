import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const mocks = vi.hoisted(() => ({
  clear: vi.fn().mockResolvedValue(undefined), register: vi.fn().mockResolvedValue(undefined),
  permission: vi.fn().mockResolvedValue({receive:'granted'}), upsert: vi.fn().mockResolvedValue({error:null}),
  events: new Map<string,(value: any)=>void>(), removals: [] as Array<ReturnType<typeof vi.fn>>,
}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'isolated-viewer'}})}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({upsert:mocks.upsert})}}));
vi.mock('@capacitor/app',()=>({App:{addListener:async(name:string,fn:(v:any)=>void)=>{
  mocks.events.set(name,fn);const remove=vi.fn().mockResolvedValue(undefined);mocks.removals.push(remove);return {remove};
}}}));
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:{
  removeAllDeliveredNotifications:mocks.clear,register:mocks.register,requestPermissions:mocks.permission,
  addListener:async(name:string,fn:(v:any)=>void)=>{mocks.events.set(name,fn);const remove=vi.fn().mockResolvedValue(undefined);mocks.removals.push(remove);return {remove};},
}}));
beforeEach(()=>{vi.clearAllMocks();mocks.permission.mockResolvedValue({receive:'granted'});mocks.upsert.mockResolvedValue({error:null});mocks.clear.mockResolvedValue(undefined);mocks.register.mockResolvedValue(undefined);mocks.events.clear();mocks.removals=[];localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('native push receipt lifecycle (isolated plugin, no provider)',()=>{
  it('does not erase a newly received foreground alert or expose its payload',async()=>{
    const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
    renderHook(()=>usePushNotifications());
    await waitFor(()=>expect(mocks.register).toHaveBeenCalledTimes(1));
    const baseline=mocks.clear.mock.calls.length;
    mocks.events.get('pushNotificationReceived')?.({title:'private fixture',body:'private fixture'});
    expect(mocks.clear).toHaveBeenCalledTimes(baseline);
    expect(log).toHaveBeenCalledWith('Push notification received');
  });
  it('keeps existing resume cleanup and listener teardown',async()=>{
    const {unmount}=renderHook(()=>usePushNotifications());
    await waitFor(()=>expect(mocks.register).toHaveBeenCalledTimes(1));
    const baseline=mocks.clear.mock.calls.length;
    mocks.events.get('appStateChange')?.({isActive:false});
    expect(mocks.clear).toHaveBeenCalledTimes(baseline);
    mocks.events.get('appStateChange')?.({isActive:true});
    expect(mocks.clear).toHaveBeenCalledTimes(baseline+1);
    unmount();
    for(const remove of mocks.removals) expect(remove).toHaveBeenCalledTimes(1);
  });
  it('keeps opt-out and saves registration only for the authenticated fixture identity',async()=>{
    localStorage.setItem('bcd-push-disabled','true');
    renderHook(()=>usePushNotifications());
    await waitFor(()=>expect(mocks.events.has('pushNotificationActionPerformed')).toBe(true));
    expect(mocks.permission).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();
    mocks.events.get('registration')?.({value:'synthetic-test-token'});
    await waitFor(()=>expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'isolated-viewer',device_token:'synthetic-test-token'}),{onConflict:'user_id,device_token'}));
  });
});
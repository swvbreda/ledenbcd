import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireMinutesAccess } from './boardMinutes';
import type { MinutesTasksResult } from './boardMinutesTasks';

export const setMinutesTaskStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(d=>z.object({taskId:z.string().uuid(),completed:z.boolean()}).strict().parse(d)).handler(async({data,context})=>{
    await requireMinutesAccess(context);
    const {error}=await context.supabase.rpc('board_minutes_set_task_status',{p_task:data.taskId,p_completed:data.completed});
    if(error)throw new Error(error.message);
    return {ok:true};
  });

export const loadMinutesTasks = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(d=>z.object({versionId:z.string().uuid()}).parse(d)).handler(async({data,context}):Promise<MinutesTasksResult>=>{
    await requireMinutesAccess(context);
    const {data:result,error}=await context.supabase.rpc('board_minutes_tasks',{p_version:data.versionId});
    if(error)throw new Error('Actuele taken konden niet worden geladen.');
    return result as unknown as MinutesTasksResult;
  });
export const activateMinutesTasks = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(d=>z.object({versionId:z.string().uuid(),confirm:z.literal(true)}).parse(d)).handler(async({data,context})=>{
    await requireMinutesAccess(context,true);
    const {data:count,error}=await context.supabase.rpc('board_minutes_sync_tasks',{p_version:data.versionId,p_activate:true});
    if(error)throw new Error(error.message);
    return {count};
  });
export const assignMinutesTask = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(d=>z.object({actionId:z.string().uuid(),users:z.array(z.string().uuid()).max(30),confirm:z.literal(true)}).parse(d)).handler(async({data,context})=>{
    await requireMinutesAccess(context,true);
    const {error}=await context.supabase.rpc('board_minutes_task_assignment',{p_action:data.actionId,p_users:data.users,p_confirm:true});
    if(error)throw new Error(error.message);
    return {ok:true};
  });
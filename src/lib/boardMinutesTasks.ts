import { z } from 'zod';

export const minuteActionRowSchema = z.object({
  action_id: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(200),
  owner: z.string().max(1000),
  deadline: z.string().max(1000),
}).strict();
export type MinuteActionRow = z.infer<typeof minuteActionRowSchema>;
export const minuteActionRowsSchema = z.array(minuteActionRowSchema).max(200).superRefine((rows, ctx) => {
  const ids = rows.flatMap(r => r.action_id ? [r.action_id] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Dubbele actie-id.' });
});
export type MinutesTaskRow = {
  action_id: string | null; row_index: number; action: string; owner: string; deadline: string;
  task_id: string | null; status: string | null; assignees: { user_id: string; name: string }[];
  needs_assignment: boolean; completed_by: string | null; completed_name: string | null; completed_at: string | null;
  collective_board?: boolean; board_responsibles?: {user_id:string|null;name:string}[]; can_status?: boolean;
};
export type MinutesTasksResult = { enabled: boolean; can_manage: boolean; rows: MinutesTaskRow[]; staff: {user_id:string;name:string}[] };

export function taskResponsibles(task: MinutesTaskRow): string {
  const people = task.collective_board ? task.board_responsibles ?? [] : task.assignees;
  const names = people.map(p => p.name).join(', ');
  return task.collective_board ? `Aan alle bestuursleden samen${names ? ` · ${names}` : ''}` : names || 'Toewijzing nodig';
}

// Exact explicit names only: never turn a collective label into a guessed person.
export function explicitOwnerParts(owner: string): string[] {
  return owner.split(/\s*(?:\+|,|;|\s+en\s+|\s+&\s+)\s*/i).map(s => s.trim()).filter(Boolean);
}
export function exactDeadline(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value ? value : null;
}
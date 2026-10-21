import { createFileRoute } from '@tanstack/react-router';
export async function deadlineSchedulePost({ request }: { request: Request }) {
 const { handleDeadlineSchedule, scheduledDeadlinePort } = await import('@/lib/outlookDeadlineScheduler.server');
 return handleDeadlineSchedule(request, process.env, () => scheduledDeadlinePort(process.env));
}
export const Route = createFileRoute('/api/public/outlook-deadline-dispatch')({server:{handlers:{POST:deadlineSchedulePost}}});

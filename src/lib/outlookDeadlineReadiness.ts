export type DeadlineSchedulerStatus = { installed: boolean; active: boolean; armed: boolean; vaultConfigured: boolean };
export function deadlineSchedulerReady(s: DeadlineSchedulerStatus | null | undefined, internalConfigured: boolean) {
 return s?.installed === true && s.vaultConfigured === true && internalConfigured;
}

import { processDeadline, type DeadlineJob, type DeadlineGraph, type DeadlineResult } from './outlookDeadlines';
export interface DeadlineDispatchPort {
 allowed(): Promise<boolean>;
 claim(): Promise<DeadlineJob | null>;
 valid(job: DeadlineJob): Promise<boolean>;
 finish(job: DeadlineJob, result: DeadlineResult): Promise<void>;
 graph(): Promise<DeadlineGraph>;
 now(): number;
}
/** Shared manual/scheduled worker: claim before token/network, never retry writes. */
export async function runDeadlineDispatch(p: DeadlineDispatchPort) {
 let processed = 0; const until = p.now() + 120000;
 let graph: DeadlineGraph | undefined;
 while (processed < 10 && p.now() < until && await p.allowed()) {
 const job = await p.claim(); if (!job) break;
 try { graph ??= await p.graph(); }
 catch { await p.finish(job, { state: 'failed', error: 'Microsoft-configuratie of agendarecht ontbreekt.' }); break; }
 const result = await processDeadline(job, graph, async () => p.now() < until && await p.allowed() && await p.valid(job));
 await p.finish(job, result); processed++;
 }
 return { processed };
}

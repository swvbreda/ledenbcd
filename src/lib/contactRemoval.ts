/** Durable saga: failure never reports success or restores a revoked account. */
export type RemovalPlan = { removed: boolean; id?: string; account_ids?: string[]; accounts: number };
export interface ContactRemovalAdapter {
  prepare(): Promise<RemovalPlan>;
  disableAndDelete(userId: string): Promise<void>;
  finish(operationId: string): Promise<void>;
}
export async function completeContactRemoval(adapter: ContactRemovalAdapter): Promise<RemovalPlan> {
  const plan = await adapter.prepare();
  if (!plan.removed) return plan;
  if (!plan.id) throw new Error("Verwijderregistratie ontbreekt; niets als geslaagd gemeld.");
  for (const id of plan.account_ids ?? []) await adapter.disableAndDelete(id);
  await adapter.finish(plan.id);
  return plan;
}
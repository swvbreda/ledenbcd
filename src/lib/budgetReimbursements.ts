import { revenueEntries, type LedgerEntry } from "./ledger";

/** Explicitly assigned sales invoices offset management costs, even while unpaid.
 * The underlying sales ledger and payment status remain unchanged.
 */
export function budgetReimbursements(entries: LedgerEntry[], expensePostIds: Set<string>) {
  return revenueEntries(entries).filter(
    (entry) => !!entry.line_item_id && expensePostIds.has(entry.line_item_id),
  );
}

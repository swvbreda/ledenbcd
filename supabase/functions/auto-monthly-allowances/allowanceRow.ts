// Maandvergoeding wordt alleen klaargezet als ingediend ("pending").
// Pas na goedkeuring door Bernard of Simone verstuurt de server haar naar Informer.
export function monthlyAllowanceRow(input: {
  year: number;
  board_member_name: string;
  declaration_type: string;
  amount: number;
  expense_date: string;
  note: string;
  previous?: { board_member_id?: string | null; bank_account?: string | null; account_holder?: string | null } | null;
  now?: Date;
}) {
  return {
    year: input.year,
    board_member_name: input.board_member_name,
    board_member_id: input.previous?.board_member_id ?? null,
    bank_account: input.previous?.bank_account ?? null,
    account_holder: input.previous?.account_holder ?? null,
    declaration_type: input.declaration_type,
    amount: input.amount,
    km_rate: 0.23,
    expense_date: input.expense_date,
    status: "pending" as const,
    submitted_at: (input.now ?? new Date()).toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    max_allowance_note: input.note,
  };
}

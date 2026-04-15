import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wettelijke maximering vrijwilligersvergoeding
const MAX_PER_MONTH = 210;
const MAX_MONTHS_PER_YEAR = 10; // 10 × €210 = €2.100 per jaar

const MONTHLY_ALLOWANCES = [
  { board_member_name: "Bernard", declaration_type: "penningmeester" },
  { board_member_name: "Joachim", declaration_type: "woordvoering" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Last day of current month
  const expenseDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const results: string[] = [];

  for (const allowance of MONTHLY_ALLOWANCES) {
    // Count existing allowances this year for this person+type
    const { count, error: countError } = await supabase
      .from("internal_declarations")
      .select("id", { count: "exact", head: true })
      .eq("year", year)
      .eq("board_member_name", allowance.board_member_name)
      .eq("declaration_type", allowance.declaration_type);

    if (countError) {
      results.push(`Error checking ${allowance.board_member_name}: ${countError.message}`);
      continue;
    }

    // Wettelijke maximering: max 10 maanden per jaar
    if ((count ?? 0) >= MAX_MONTHS_PER_YEAR) {
      results.push(
        `${allowance.board_member_name} (${allowance.declaration_type}): al ${count}/${MAX_MONTHS_PER_YEAR} — max bereikt voor ${year}`
      );
      continue;
    }

    // Check if this month already exists
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const { count: monthCount } = await supabase
      .from("internal_declarations")
      .select("id", { count: "exact", head: true })
      .eq("year", year)
      .eq("board_member_name", allowance.board_member_name)
      .eq("declaration_type", allowance.declaration_type)
      .gte("expense_date", monthStart)
      .lte("expense_date", expenseDate);

    if ((monthCount ?? 0) > 0) {
      results.push(
        `${allowance.board_member_name} (${allowance.declaration_type}): al ingediend voor ${monthStart.slice(0, 7)}`
      );
      continue;
    }

    // Insert the monthly allowance
    const { error: insertError } = await supabase
      .from("internal_declarations")
      .insert({
        year,
        board_member_name: allowance.board_member_name,
        declaration_type: allowance.declaration_type,
        amount: MAX_PER_MONTH,
        km_rate: 0.23,
        expense_date: expenseDate,
        status: "approved",
        max_allowance_note: `Auto: max €${MAX_PER_MONTH}/maand, ${MAX_MONTHS_PER_YEAR} maanden/jaar (€${MAX_PER_MONTH * MAX_MONTHS_PER_YEAR}/jaar)`,
      });

    if (insertError) {
      results.push(`Error inserting ${allowance.board_member_name}: ${insertError.message}`);
    } else {
      results.push(
        `✓ ${allowance.board_member_name} (${allowance.declaration_type}): €${MAX_PER_MONTH} voor ${monthStart.slice(0, 7)}`
      );
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
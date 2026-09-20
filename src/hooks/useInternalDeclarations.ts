import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeReceiptName } from "@/lib/declarations";

export interface InternalDeclaration {
  id: string;
  year: number;
  board_member_name: string;
  board_member_id: string | null;
  declaration_type: string;
  appointment: string | null;
  trajectory: string | null;
  km_single: number | null;
  km_return: number | null;
  km_rate: number;
  amount: number;
  expense_date: string | null;
  bank_account: string | null;
  account_holder: string | null;
  max_allowance_note: string | null;
  status: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  bank_transaction_id: string | null;
  receipt_path: string | null;
  informer_status: "not_sent" | "queued" | "synced" | "error";
  informer_external_id: string | null;
  informer_error: string | null;
  informer_synced_at: string | null;
}

export interface DeclarationBoardMember {
  id: string;
  naam: string;
  functie: string | null;
  prive_adres: string | null;
  prive_postcode: string | null;
  prive_plaats: string | null;
}

export function useDeclarationBoardMembers() {
  return useQuery({
    queryKey: ["declaration-board-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_members")
        .select("id, naam, functie, prive_adres, prive_postcode, prive_plaats")
        .eq("type", "bestuurslid")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as DeclarationBoardMember[];
    },
  });
}

export function useInternalDeclarations(year: number) {
  return useQuery({
    queryKey: ["internal-declarations", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_declarations")
        .select("*")
        .eq("year", year)
        .order("expense_date", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        km_single: d.km_single ? Number(d.km_single) : null,
        km_return: d.km_return ? Number(d.km_return) : null,
        km_rate: Number(d.km_rate),
        amount: Number(d.amount),
      })) as InternalDeclaration[];
    },
  });
}

export function useInternalDeclarationMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["internal-declarations", year] });

  const add = useMutation({
    mutationFn: async ({
      declaration,
      receipt,
    }: {
      declaration: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">;
      receipt?: File | null;
    }) => {
      let receiptPath: string | null = null;
      if (receipt) {
        if (receipt.size > 10 * 1024 * 1024) throw new Error("De bon mag maximaal 10 MB zijn");
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowed.includes(receipt.type)) throw new Error("Gebruik een JPG, PNG, WebP of PDF als bon");
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user.id;
        if (!uid) throw new Error("Log opnieuw in om een bon te uploaden");
        receiptPath = `${uid}/${crypto.randomUUID()}-${sanitizeReceiptName(receipt.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("declaration-receipts")
          .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("internal_declarations")
        .insert({ ...declaration, receipt_path: receiptPath, informer_status: "queued" } as any)
        .select("id")
        .single();
      if (error) throw error;
      const { data: informerData, error: informerError } = await supabase.functions.invoke(
        `informer-sync?action=declaration_to_informer`,
        { body: { declaration_id: data.id } },
      );
      const informerSynced = !informerError && informerData?.success !== false;
      if (!informerSynced) {
        const message = informerError?.message
          || informerData?.results?.[0]?.error_message
          || "Informer heeft de declaratie niet aangenomen";
        await supabase.from("internal_declarations").update({
          informer_status: "error",
          informer_error: message,
        } as any).eq("id", data.id);
      }
      return { id: data.id, informerSynced };
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Omit<InternalDeclaration, "id">>) => {
      const { error } = await supabase.from("internal_declarations").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_declarations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });


  const approve = useMutation({
    mutationFn: async ({ id, reviewerId }: { id: string; reviewerId: string }) => {
      const { error } = await supabase
        .from("internal_declarations")
        .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ id, reviewerId }: { id: string; reviewerId: string }) => {
      const { error } = await supabase
        .from("internal_declarations")
        .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove, approve, reject };
}

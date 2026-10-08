import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeReceiptName } from "@/lib/declarations";
import { planDeclarationAllocation } from "@/lib/declarationAllocation";
import { buildEditPatch, EDITABLE_INFORMER_STATUSES, type DeclarationEditFields } from "@/lib/declarationEdit";

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
  receipt_paths?: string[];
  event_id?: string | null;
  budget_reference?: string | null;
  submitted_at?: string | null;
  informer_payment_status?: "open" | "paid" | null;
  informer_status: "not_sent" | "queued" | "sending" | "sent" | "synced" | "error";
  informer_external_id: string | null;
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

/** Laatste foutdetail per declaratie; RLS laat alleen admin/penningmeester lezen. */
export function useDeclarationSyncErrors(enabled: boolean) {
  return useQuery({
    queryKey: ["declaration-sync-errors"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_declaration_sync_attempts")
        .select("declaration_id, status, sanitized_error, attempted_at")
        .order("attempted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const latest: Record<string, string> = {};
      const seen = new Set<string>();
      for (const row of data ?? []) {
        if (seen.has(row.declaration_id)) continue;
        seen.add(row.declaration_id);
        if (row.status === "error" && row.sanitized_error) latest[row.declaration_id] = row.sanitized_error;
      }
      return latest;
    },
  });
}

export function useInternalDeclarationMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["internal-declarations", year] });
    qc.invalidateQueries({ queryKey: ["declaration-sync-errors"] });
  };

  const sendToInformer = async (id: string, retry = false) => {
    const { data, error } = await supabase.functions.invoke(
      `informer-sync?action=declaration_to_informer`,
      { body: { declaration_id: id, retry } },
    );
    return !error && data?.success !== false;
  };

  const add = useMutation({
    mutationFn: async ({
      declaration,
      receipts = [],
      asConcept = false,
    }: {
      declaration: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">;
      receipts?: File[];
      asConcept?: boolean;
    }) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      const paths: string[] = [];
      if (receipts.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user.id;
        if (!uid) throw new Error("Log opnieuw in om een bon te uploaden");
        for (const receipt of receipts) {
          if (receipt.size > 10 * 1024 * 1024) throw new Error("Een bon mag maximaal 10 MB zijn");
          if (!allowed.includes(receipt.type)) throw new Error("Gebruik een JPG, PNG, WebP of PDF als bon");
          const path = `${uid}/${crypto.randomUUID()}-${sanitizeReceiptName(receipt.name)}`;
          const { error: uploadError } = await supabase.storage
            .from("declaration-receipts")
            .upload(path, receipt, { contentType: receipt.type, upsert: false });
          if (uploadError) throw uploadError;
          paths.push(path);
        }
      }

      const { data, error } = await supabase
        .from("internal_declarations")
        .insert({
          ...declaration,
          status: asConcept ? "concept" : "pending",
          receipt_path: paths[0] ?? null,
          receipt_paths: paths,
          informer_status: "not_sent",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (asConcept) return { id: data.id, informerSynced: false, concept: true };
      return { id: data.id, informerSynced: await sendToInformer(data.id), concept: false };
    },
    onSuccess: invalidate,
  });

  const submitConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_declarations").update({ status: "pending" } as any).eq("id", id);
      if (error) throw error;
      return { informerSynced: await sendToInformer(id) };
    },
    onSuccess: invalidate,
  });

  const retryInformer = useMutation({
    mutationFn: async (id: string) => ({ informerSynced: await sendToInformer(id, true) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Omit<InternalDeclaration, "id">>) => {
      const { error } = await supabase.from("internal_declarations").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Wijzigt een bestaande declaratie (zelfde id/Informer-referentie). De update is voorwaardelijk:
   * alleen als hij nog niet betaald, niet in Informer en niet aan het versturen is; anders 0 rijen → fout.
   * RLS en de beschermingstrigger bepalen daarnaast wie wat mag.
   */
  const edit = useMutation({
    mutationFn: async ({ id, expectedStatus, fields, existingReceipts, receipts = [], submit = false }: {
      id: string; expectedStatus: string; fields: DeclarationEditFields; existingReceipts: string[]; receipts?: File[]; submit?: boolean;
    }) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      const paths: string[] = [];
      if (receipts.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user.id;
        if (!uid) throw new Error("Log opnieuw in om een bon te uploaden");
        for (const receipt of receipts) {
          if (receipt.size > 10 * 1024 * 1024) throw new Error("Een bon mag maximaal 10 MB zijn");
          if (!allowed.includes(receipt.type)) throw new Error("Gebruik een JPG, PNG, WebP of PDF als bon");
          const path = `${uid}/${crypto.randomUUID()}-${sanitizeReceiptName(receipt.name)}`;
          const { error: uploadError } = await supabase.storage.from("declaration-receipts")
            .upload(path, receipt, { contentType: receipt.type, upsert: false });
          if (uploadError) throw uploadError;
          paths.push(path);
        }
      }
      const patch: Record<string, unknown> = buildEditPatch(fields, existingReceipts, paths);
      if (submit && expectedStatus === "concept") patch.status = "pending";
      const { data, error } = await supabase.from("internal_declarations")
        .update(patch as any)
        .eq("id", id)
        .eq("status", expectedStatus)
        .is("paid_at", null)
        .is("bank_transaction_id", null)
        .is("informer_external_id", null)
        .in("informer_status", [...EDITABLE_INFORMER_STATUSES])
        .select("id");
      if (error) throw error;
      if (!data || data.length !== 1) {
        throw new Error("Wijzigen is niet gelukt: de declaratie is intussen betaald, verstuurd naar Informer of gewijzigd. Ververs de pagina.");
      }
      if (submit && expectedStatus === "concept") return { id, informerSynced: await sendToInformer(id), submitted: true };
      return { id, informerSynced: false, submitted: false };
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

  /**
   * Admin: begrotingspost/dossier toewijzen. De server (admin_allocate_declaration) controleert rol, jaar,
   * versie en herkomst van een bestaande boekingstoewijzing, en schrijft declaratie + boeking in één transactie.
   */
  const allocate = useMutation({
    mutationFn: async ({ id, lineItemId, dossier, updatedAt }: {
      id: string; informerExternalId: string | null; lineItemId: string | null; dossier: string | null; validLineItemIds: string[]; updatedAt?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("admin_allocate_declaration", {
        _declaration_id: id, _line_item_id: lineItemId || null, _dossier: dossier, _expected_updated_at: updatedAt ?? null,
      });
      if (error) throw new Error(error.message || "Toewijzen is niet gelukt.");
      return data as { declaration: "updated" | "unchanged"; override: "none" | "created" | "updated" | "unchanged" };
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["ledger"] }); qc.invalidateQueries({ queryKey: ["budget-categories"] }); qc.invalidateQueries({ queryKey: ["dossier-mutations"] }); },
  });

  return { add, edit, allocate, update, remove, approve, reject, submitConcept, retryInformer };
}


/** Posten van het jaar en bestaande dossiernamen (bestaande vrije-tekstconventie). */
export function useDeclarationAllocationOptions(year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["declaration-allocation-options", year],
    enabled,
    queryFn: async () => {
      const client = supabase as any;
      const { data: cats, error } = await client.from("budget_categories").select("id, name, sort_order").eq("year", year).order("sort_order");
      if (error) throw error;
      const { data: items, error: liErr } = await client.from("budget_line_items").select("id, name, category_id, sort_order")
        .in("category_id", (cats ?? []).map((c: any) => c.id)).order("sort_order");
      if (liErr) throw liErr;
      const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
      const [o, p] = await Promise.all([
        client.from("ledger_entry_overrides").select("dossier").not("dossier", "is", null).limit(1000),
        client.from("ponto_transactions").select("dossier").not("dossier", "is", null).limit(2000),
      ]);
      const dossiers = [...new Set([...(o.data ?? []), ...(p.data ?? [])].map((r: any) => String(r.dossier).trim()).filter((d) => d && !/^Contributie/i.test(d)))].sort();
      return {
        lineItems: (items ?? []).map((li: any) => ({ id: li.id as string, name: `${catName.get(li.category_id) ?? ""} — ${li.name}` })),
        dossiers,
      };
    },
  });
}

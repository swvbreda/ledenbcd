import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DossierEntryKind = "expense" | "bank" | "ponto";

export interface DossierMutation {
  /** Unieke sleutel, ook gebruikt om documenten te koppelen: "expense:uuid" etc. */
  key: string;
  kind: DossierEntryKind;
  id: string;
  date: string | null;
  counterparty: string;
  description: string;
  invoice: string;
  amount: number;
  direction: "in" | "out";
  categoryName: string;
  lineItemName: string;
  dossier: string;
  source: string;
}

export interface ExpenseDocument {
  id: string;
  entry_key: string;
  dossier: string | null;
  year: number | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  source: string;
  invoice_reference: string | null;
  created_at: string;
}

export interface DossierSplit {
  id: string;
  entry_key: string;
  dossier: string;
  amount: number;
  year: number | null;
}

const client = supabase as any;

export function entryKeyFor(kind: DossierEntryKind, id: string) {
  return `${kind}:${id}`;
}

/** Alle dossierverdelingen (kosten die over meerdere dossiers zijn verdeeld). */
export function useDossierSplits() {
  return useQuery({
    queryKey: ["dossier-splits"],
    queryFn: async () => {
      const { data, error } = await client.from("expense_dossier_splits").select("*");
      if (error) throw error;
      return (data || []).map((s: any) => ({ ...s, amount: Number(s.amount) || 0 })) as DossierSplit[];
    },
  });
}

export function useDossierSplitActions() {
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async ({
      entryKey,
      splits,
      year,
    }: {
      entryKey: string;
      splits: { dossier: string; amount: number }[];
      year: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error: delErr } = await client.from("expense_dossier_splits").delete().eq("entry_key", entryKey);
      if (delErr) throw delErr;
      const rows = splits
        .filter((s) => s.dossier.trim() && Number.isFinite(s.amount))
        .map((s) => ({
          entry_key: entryKey,
          dossier: s.dossier.trim(),
          amount: s.amount,
          year,
          created_by: auth?.user?.id ?? null,
        }));
      if (rows.length > 0) {
        const { error } = await client.from("expense_dossier_splits").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-splits"] });
      qc.invalidateQueries({ queryKey: ["dossier-mutations"] });
    },
  });

  return { save };
}

/** Alle mutaties (uitgaven, inkomsten, bankboekingen) van een jaar — ook zonder begrotingspost. */
export function useDossierMutations(year: number) {
  return useQuery({
    queryKey: ["dossier-mutations", year],
    queryFn: async () => {
      const { data: categories, error: catErr } = await client
        .from("budget_categories")
        .select("id, name")
        .eq("year", year);
      if (catErr) throw catErr;

      const catIds = (categories || []).map((c: any) => c.id);
      const catNameById = new Map<string, string>((categories || []).map((c: any) => [c.id, c.name]));

      let lineItems: any[] = [];
      if (catIds.length > 0) {
        const { data, error } = await client
          .from("budget_line_items")
          .select("id, name, category_id")
          .in("category_id", catIds);
        if (error) throw error;
        lineItems = data || [];
      }
      const liById = new Map<string, any>(lineItems.map((li: any) => [li.id, li]));
      const liIds = lineItems.map((li: any) => li.id);

      const names = (lineItemId: string | null) => {
        const li = lineItemId ? liById.get(lineItemId) : null;
        return {
          lineItemName: li?.name || "",
          categoryName: li ? catNameById.get(li.category_id) || "" : "",
        };
      };

      const rows: DossierMutation[] = [];

      if (liIds.length > 0) {
        const { data: expenses, error } = await client
          .from("budget_expenses")
          .select("*")
          .in("line_item_id", liIds);
        if (error) throw error;
        for (const e of expenses || []) {
          rows.push({
            key: entryKeyFor("expense", e.id),
            kind: "expense",
            id: e.id,
            date: e.expense_date,
            counterparty: e.creditor_name || "",
            description: e.description || "",
            invoice: e.invoice_reference || "",
            amount: Math.abs(Number(e.amount) || 0),
            direction: e.direction === "in" ? "in" : "out",
            ...names(e.line_item_id),
            dossier: (e.dossier || "").trim(),
            source: e.source || "manual",
          });
        }
      }

      const { data: bankRows, error: bankErr } = await client
        .from("bank_transactions")
        .select("*")
        .eq("year", year);
      if (bankErr) throw bankErr;
      for (const b of bankRows || []) {
        rows.push({
          key: entryKeyFor("bank", b.id),
          kind: "bank",
          id: b.id,
          date: b.transaction_date,
          counterparty: b.counterparty || "",
          description: b.description || "",
          invoice: b.invoice_reference || "",
          amount: Math.abs(Number(b.amount) || 0),
          direction: b.direction === "in" ? "in" : "out",
          ...names(b.line_item_id),
          dossier: (b.dossier || "").trim(),
          source: "bank",
        });
      }

      const { data: pontoRows, error: pontoErr } = await client
        .from("ponto_transactions")
        .select(
          "id, executed_at, amount, counterparty_name, description, remittance_info, budget_line_item_id, dossier",
        )
        .gte("executed_at", `${year}-01-01`)
        .lt("executed_at", `${year + 1}-01-01`);
      if (pontoErr) throw pontoErr;
      for (const p of pontoRows || []) {
        const raw = Number(p.amount) || 0;
        rows.push({
          key: entryKeyFor("ponto", p.id),
          kind: "ponto",
          id: p.id,
          date: p.executed_at ? String(p.executed_at).slice(0, 10) : null,
          counterparty: p.counterparty_name || "",
          description: p.description || p.remittance_info || "",
          invoice: "",
          amount: Math.abs(raw),
          direction: raw >= 0 ? "in" : "out",
          ...names(p.budget_line_item_id),
          dossier: (p.dossier || "").trim(),
          source: "bank",
        });
      }

      rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return rows;
    },
  });
}

export function useDossierMutationActions(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dossier-mutations", year] });
    qc.invalidateQueries({ queryKey: ["budget-categories", year] });
  };

  const setDossier = useMutation({
    mutationFn: async ({ entries, dossier }: { entries: DossierMutation[]; dossier: string | null }) => {
      for (const entry of entries) {
        const table =
          entry.kind === "expense" ? "budget_expenses" : entry.kind === "bank" ? "bank_transactions" : "ponto_transactions";
        const { error } = await client.from(table).update({ dossier }).eq("id", entry.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { setDossier };
}

export function useExpenseDocuments() {
  return useQuery({
    queryKey: ["expense-documents"],
    queryFn: async () => {
      const { data, error } = await client
        .from("expense_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseDocument[];
    },
  });
}

export function useExpenseDocumentActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expense-documents"] });

  const upload = useMutation({
    mutationFn: async ({
      entry,
      files,
      year,
    }: {
      entry: DossierMutation;
      files: File[];
      year: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${year}/${entry.kind}/${entry.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("expense-invoices")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error } = await client.from("expense_documents").insert({
          entry_key: entry.key,
          dossier: entry.dossier || null,
          year,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          source: "manual",
          invoice_reference: entry.invoice || null,
          uploaded_by: auth?.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (doc: ExpenseDocument) => {
      await supabase.storage.from("expense-invoices").remove([doc.file_path]);
      const { error } = await client.from("expense_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { upload, remove };
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from("expense-invoices").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

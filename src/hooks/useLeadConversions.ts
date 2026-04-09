import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadConversion {
  id: string;
  lead_id: number;
  lidnummer: number;
  lid_sinds: number | null;
  factuur_bedrijfsnaam: string | null;
  factuur_kvk: string | null;
  factuur_email: string | null;
  factuur_adres: string | null;
  factuur_postcode: string | null;
  factuur_plaats: string | null;
  created_at: string;
  created_by: string;
}

let cachedConversions: LeadConversion[] | null = null;
let listeners: Array<(c: LeadConversion[]) => void> = [];

function notifyListeners(data: LeadConversion[]) {
  cachedConversions = data;
  listeners.forEach((fn) => fn(data));
}

export async function fetchConversions(): Promise<LeadConversion[]> {
  const { data, error } = await supabase
    .from("lead_conversions")
    .select("*");
  if (error) {
    console.error("Failed to fetch lead conversions", error);
    return cachedConversions ?? [];
  }
  cachedConversions = (data ?? []) as LeadConversion[];
  return cachedConversions;
}

export function useLeadConversions() {
  const [conversions, setConversions] = useState<LeadConversion[]>(cachedConversions ?? []);
  const [loading, setLoading] = useState(cachedConversions === null);

  useEffect(() => {
    listeners.push(setConversions);

    if (cachedConversions === null) {
      fetchConversions().then((data) => {
        setConversions(data);
        setLoading(false);
      });
    }

    return () => {
      listeners = listeners.filter((fn) => fn !== setConversions);
    };
  }, []);

  const refresh = async () => {
    const data = await fetchConversions();
    notifyListeners(data);
  };

  return { conversions, loading, refresh };
}

export async function convertLead(params: {
  leadId: number;
  lidnummer: number;
  lidSinds: number | null;
  factuurBedrijfsnaam?: string;
  factuurKvk?: string;
  factuurEmail?: string;
  factuurAdres?: string;
  factuurPostcode?: string;
  factuurPlaats?: string;
  leadEmail?: string;
}) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error("Niet ingelogd");

  // 1. Read the lead data
  const { data: leadRows, error: readErr } = await supabase
    .from("members_data")
    .select("data")
    .eq("id", params.leadId)
    .eq("member_type", "lead");
  if (readErr) throw readErr;
  if (!leadRows || leadRows.length === 0) throw new Error("Lead niet gevonden");

  const leadData = leadRows[0].data as Record<string, unknown>;

  // 2. Build new member data with conversion overrides
  const memberData = {
    ...leadData,
    id: params.lidnummer,
    lidSinds: params.lidSinds,
    factuurBedrijfsnaam: params.factuurBedrijfsnaam || leadData.factuurBedrijfsnaam,
    factuurKvk: params.factuurKvk || undefined,
    factuurEmail: params.factuurEmail || leadData.factuurEmail,
    factuurAdres: params.factuurAdres || leadData.factuurAdres,
    factuurPostcode: params.factuurPostcode || leadData.factuurPostcode,
    factuurPlaats: params.factuurPlaats || leadData.factuurPlaats,
  };

  // 3. Insert new member row
  const { error: insertErr } = await supabase
    .from("members_data")
    .insert({ id: params.lidnummer, member_type: "member", data: memberData });
  if (insertErr) throw insertErr;

  // 4. Delete old lead row
  await supabase
    .from("members_data")
    .delete()
    .eq("id", params.leadId)
    .eq("member_type", "lead");

  // 5. Auto-add lead's email to allowed emails for registration
  if (params.leadEmail) {
    await supabase.from("member_allowed_emails").insert({
      email: params.leadEmail.toLowerCase().trim(),
      member_id: params.lidnummer,
    });
  }

  // 6. Record conversion for reference (redirect old URLs etc.)
  await supabase.from("lead_conversions").insert({
    lead_id: params.leadId,
    lidnummer: params.lidnummer,
    lid_sinds: params.lidSinds,
    factuur_bedrijfsnaam: params.factuurBedrijfsnaam || null,
    factuur_kvk: params.factuurKvk || null,
    factuur_email: params.factuurEmail || null,
    factuur_adres: params.factuurAdres || null,
    factuur_postcode: params.factuurPostcode || null,
    factuur_plaats: params.factuurPlaats || null,
    created_by: userId,
  });

  const data = await fetchConversions();
  notifyListeners(data);
}

export async function revertConversion(leadId: number) {
  const { error } = await supabase
    .from("lead_conversions")
    .delete()
    .eq("lead_id", leadId);
  if (error) throw error;

  const data = await fetchConversions();
  notifyListeners(data);
}

/** Get the next available lidnummer based on existing members + conversions */
export function getNextLidnummer(existingMaxId: number, conversions: LeadConversion[]): number {
  const convMax = conversions.reduce((max, c) => Math.max(max, c.lidnummer), 0);
  return Math.max(existingMaxId, convMax) + 1;
}

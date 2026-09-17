import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Beoordelen van coffeeshoplogo's uit het register: goedkeuren, afkeuren en
 * handmatig een aangeleverd logo uploaden. Alleen beheer en bestuur.
 */

const uuid = (v: unknown) => {
  const s = String(v ?? "");
  if (!/^[0-9a-fA-F-]{36}$/.test(s)) throw new Error("Ongeldige shop");
  return s;
};

async function assertBeheer(ctx: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isBoard }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("is_board_member", { _user_id: ctx.userId }),
  ]);
  if (!isAdmin && !isBoard) throw new Error("Geen rechten");
}

export type ShopLogoStatus = {
  logo_pad: string | null;
  logo_url: string | null;
  logo_gecontroleerd: boolean;
  logo_gecontroleerd_op: string | null;
};

export const getShopLogoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { register_id: string }) => ({ register_id: uuid(data?.register_id) }))
  .handler(async ({ data, context }): Promise<ShopLogoStatus | null> => {
    const { data: row, error } = await context.supabase
      .from("coffeeshop_register")
      .select("logo_pad, logo_url, logo_gecontroleerd, logo_gecontroleerd_op")
      .eq("id", data.register_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as ShopLogoStatus) ?? null;
  });

export type ShopLogoReviewItem = {
  register_id: string;
  naam: string;
  plaats: string;
  lid_id: number | null;
  lid_naam: string | null;
  logo_gecontroleerd: boolean;
};

/** Lijst met logo's van aangesloten coffeeshops om te beoordelen. */
export const listShopLogosForReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { approved?: boolean }) => ({ approved: data?.approved === true }))
  .handler(async ({ data, context }): Promise<ShopLogoReviewItem[]> => {
    await assertBeheer(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("coffeeshop_member_links")
      .select(
        "member_id, register_id, coffeeshop_register(id, naam, plaats, logo_pad, logo_url, vervallen, logo_gecontroleerd)",
      )
      .eq("status", "bevestigd");
    if (error) throw new Error(error.message);

    const perShop = new Map<string, ShopLogoReviewItem>();
    for (const row of rows ?? []) {
      const shop = (row as unknown as {
        coffeeshop_register: {
          id: string;
          naam: string | null;
          plaats: string | null;
          logo_pad: string | null;
          logo_url: string | null;
          vervallen: boolean | null;
          logo_gecontroleerd: boolean | null;
        } | null;
        member_id: number | null;
      }).coffeeshop_register;
      if (!shop || shop.vervallen) continue;
      if (!shop.logo_pad && !shop.logo_url) continue;
      if (!!shop.logo_gecontroleerd !== data.approved) continue;
      if (perShop.has(shop.id)) continue;
      perShop.set(shop.id, {
        register_id: shop.id,
        naam: shop.naam ?? "",
        plaats: shop.plaats ?? "",
        lid_id: (row as unknown as { member_id: number | null }).member_id ?? null,
        lid_naam: null,
        logo_gecontroleerd: !!shop.logo_gecontroleerd,
      });
    }

    const items = [...perShop.values()];
    const ids = [...new Set(items.map((i) => i.lid_id).filter((v): v is number => v != null))];
    if (ids.length) {
      const { data: leden } = await supabaseAdmin
        .from("members_data")
        .select("id, data")
        .in("id", ids);
      const namen = new Map<number, string>();
      for (const lid of leden ?? []) {
        const naam = (lid as unknown as { data: { naam?: string } | null }).data?.naam;
        if (naam) namen.set((lid as unknown as { id: number }).id, naam);
      }
      for (const item of items) {
        if (item.lid_id != null) item.lid_naam = namen.get(item.lid_id) ?? null;
      }
    }

    return items.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  });

export const setShopLogoApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { register_id: string; approved: boolean }) => ({
    register_id: uuid(data?.register_id),
    approved: data?.approved === true,
  }))
  .handler(async ({ data, context }) => {
    await assertBeheer(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch = data.approved
      ? {
          logo_gecontroleerd: true,
          logo_gecontroleerd_op: new Date().toISOString(),
          logo_gecontroleerd_door: context.userId,
        }
      : {
          logo_gecontroleerd: false,
          logo_gecontroleerd_op: new Date().toISOString(),
          logo_gecontroleerd_door: context.userId,
          logo_pad: null,
          logo_url: null,
        };

    const { error } = await supabaseAdmin
      .from("coffeeshop_register")
      .update(patch)
      .eq("id", data.register_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadShopLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { register_id: string; filename: string; contentType: string; base64: string }) => ({
      register_id: uuid(data?.register_id),
      filename: String(data?.filename ?? "logo").slice(0, 120),
      contentType: String(data?.contentType ?? "image/png").slice(0, 80),
      base64: String(data?.base64 ?? ""),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertBeheer(context);
    if (!data.contentType.startsWith("image/")) throw new Error("Alleen afbeeldingen");

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Bestand is leeg of groter dan 5 MB");
    }

    const ext = (data.filename.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `handmatig/${data.register_id}.${ext || "png"}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("shop-logos")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabaseAdmin
      .from("coffeeshop_register")
      .update({
        logo_pad: path,
        logo_url: null,
        logo_bron: "handmatig",
        logo_gecontroleerd: true,
        logo_gecontroleerd_op: new Date().toISOString(),
        logo_gecontroleerd_door: context.userId,
      })
      .eq("id", data.register_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

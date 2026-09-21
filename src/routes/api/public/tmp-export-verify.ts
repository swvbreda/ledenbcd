import { createFileRoute } from "@tanstack/react-router";
import type { Member } from "@/data/types";
import { mergeMemberLocations } from "@/lib/memberLocations";
import { buildWorkbookData } from "@/lib/memberExport";

const TOKEN = "verify-2026-09-21b";

export const Route = createFileRoute("/api/public/tmp-export-verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("nope", { status: 404 });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: rows } = await supabaseAdmin
          .from("members_data")
          .select("id, member_type, data");
        const { data: edits } = await supabaseAdmin
          .from("member_edits")
          .select("member_id, data");
        const editMap = new Map<number, Record<string, unknown>>();
        for (const e of edits ?? [])
          editMap.set(
            e.member_id as number,
            (e.data ?? {}) as Record<string, unknown>,
          );

        let basisLocaties = 0;
        const byType: Record<string, Member[]> = {
          member: [],
          lead: [],
          old: [],
        };
        for (const r of rows ?? []) {
          const base = ((r.data ?? {}) as Record<string, unknown>) ?? {};
          const baseLoc = (base.locaties ?? []) as Record<string, unknown>[];
          basisLocaties += baseLoc.length;
          const overlay = editMap.get(r.id as number) ?? {};
          const merged = mergeMemberLocations(
            baseLoc,
            (overlay.locaties ?? []) as Record<string, unknown>[],
            (overlay._verwijderdeLocaties ?? []) as string[],
          );
          const m = {
            ...base,
            ...overlay,
            id: r.id,
            locaties: merged,
          } as unknown as Member;
          (byType[r.member_type as string] ?? byType.member).push(m);
        }

        const data = buildWorkbookData({
          leden: byType.member,
          leads: byType.lead,
          oudLeden: byType.old,
        });
        return Response.json({
          bronRecords: (rows ?? []).length,
          basisLocaties,
          bladLeden: data.leden.length,
          bladLeads: data.leads.length,
          bladOudLeden: data.oudLeden.length,
          totaalHoofdbladen:
            data.leden.length + data.leads.length + data.oudLeden.length,
          bladLocaties: data.locaties.length,
          bladContacten: data.contacten.length,
          uniekeLeden: new Set(data.leden.map((r) => r.lidnr)).size,
          uniekeOud: new Set(data.oudLeden.map((r) => r.lidnr)).size,
          eersteLid: data.leden[0]?.lidnr,
          eersteLead: data.leads[0]?.lidnr,
          locatiesPerType: data.locaties.reduce<Record<string, number>>(
            (acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }),
            {},
          ),
          contactenPerType: data.contacten.reduce<Record<string, number>>(
            (acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }),
            {},
          ),
        });
      },
    },
  },
});

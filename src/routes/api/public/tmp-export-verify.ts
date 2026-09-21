import { createFileRoute } from "@tanstack/react-router";
import { buildWorkbookData } from "@/lib/memberExport";
import { mergeMemberLocations } from "@/lib/memberLocations";
import type { Member } from "@/data/types";

const TOKEN = "verify-2026-09-21";

export const Route = createFileRoute("/api/public/tmp-export-verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (new URL(request.url).searchParams.get("token") !== TOKEN) {
          return new Response("nope", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows } = await supabaseAdmin
          .from("members_data")
          .select("id, member_type, data")
          .in("member_type", ["member", "lead"]);
        const { data: edits } = await supabaseAdmin.from("member_edits").select("member_id, data");
        const editMap = new Map<number, any>((edits ?? []).map((e: any) => [e.member_id, e.data]));

        const baseLocCount = (rows ?? []).reduce(
          (n: number, r: any) => n + ((r.data?.locaties ?? []).length as number),
          0,
        );

        const members: Member[] = (rows ?? []).map((r: any) => {
          const base = r.data ?? {};
          const e = editMap.get(r.id) ?? {};
          const locaties = mergeMemberLocations(base.locaties, e.locaties, e._verwijderdeLocaties).filter(
            (l: any) => (l.adres ?? "").trim() || (l.plaats ?? "").trim(),
          );
          return {
            ...base,
            ...e,
            id: r.id,
            locaties,
            contacten: e.contacten || base.contacten || [],
            aantalLocaties: locaties.length,
          } as Member;
        });

        const wb = buildWorkbookData(members);
        const lidnrs = wb.leden.map((l) => l.lidnr);
        const locKeys = wb.locaties.map((l) => `${l.lidnr}|${l.locatienaam}|${l.straat}|${l.huisnummer}|${l.toevoeging}|${l.postcode}`);
        return Response.json({
          bronLeden: rows?.length ?? 0,
          bronBasisLocaties: baseLocCount,
          effectieveLocaties: members.reduce((n, m) => n + m.locaties.length, 0),
          bladLeden: wb.leden.length,
          bladLocaties: wb.locaties.length,
          bladContacten: wb.contacten.length,
          eersteRij: wb.leden[0] ? { nr: wb.leden[0].nr, lidnr: wb.leden[0].lidnr, naam: wb.leden[0].naam, aantalLocaties: wb.leden[0].aantalLocaties } : null,
          uniekeLeden: new Set(lidnrs).size,
          uniekeLocaties: new Set(locKeys).size,
          oplopend: lidnrs.every((v, i) => i === 0 || Number(lidnrs[i - 1]) <= Number(v)),
          ledenZonderLocaties: wb.leden.filter((l) => l.aantalLocaties === 0).length,
        });
      },
    },
  },
});

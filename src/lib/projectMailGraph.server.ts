/** Server-only, alleen-lezen Graph-poort voor Projectmail: inbox-delta + één bericht. Geen mark-read/move/delete/send. */
import { GraphError } from "@/lib/plannerSync";
import { nextPageParams, type ReadOnlyGraph } from "@/lib/msImportGraph.server";
import { safeWebLink, toPlainText, type MailGraph, type MailMeta } from "@/lib/projectMail";

const GUID = /^[0-9a-fA-F-]{36}$/;
const MSG_ID = /^[A-Za-z0-9_=+-]{10,400}$/;

/** Checkpoint = alleen tokenparameters ($skiptoken/$deltatoken), nooit een volledige URL. */
function tokenOf(link: unknown): string | null {
  const p = nextPageParams(link);
  return p ? p.toString() : null;
}

export function projectMailGraph(g: ReadOnlyGraph, userId: string): MailGraph {
  if (!GUID.test(userId)) throw new GraphError(0, "Ongeldig postbusaccount");
  const base = `/users/${userId}/mailFolders/inbox/messages/delta`;
  return {
    async delta(checkpoint, sinceIso) {
      let q: URLSearchParams;
      if (checkpoint) {
        q = new URLSearchParams(checkpoint);
        if (![...q.keys()].every((k) => k === "$skiptoken" || k === "$deltatoken")) throw new GraphError(0, "Ongeldig checkpoint");
      } else {
        q = new URLSearchParams({ $select: "id,subject,receivedDateTime,internetMessageId,webLink", $filter: `receivedDateTime ge ${sinceIso}` });
      }
      const { json } = await g.get(`${base}?${q.toString()}`, "odata.maxpagesize=50");
      const items: MailMeta[] = ((json.value ?? []) as Record<string, any>[]).map((v) => ({
        id: String(v.id ?? ""), subject: String(v.subject ?? ""), receivedDateTime: String(v.receivedDateTime ?? ""),
        internetMessageId: typeof v.internetMessageId === "string" ? v.internetMessageId.slice(0, 500) : null,
        webLink: safeWebLink(v.webLink), removed: !!v["@removed"],
      }));
      return { items, next: tokenOf(json["@odata.nextLink"]), delta: tokenOf(json["@odata.deltaLink"]) };
    },
    async body(id) {
      if (!MSG_ID.test(id)) throw new GraphError(0, "Ongeldig bericht-id");
      const { json } = await g.get(`/users/${userId}/messages/${encodeURIComponent(id)}?$select=uniqueBody,body`, 'outlook.body-content-type="text"');
      const b = json.uniqueBody?.content ? json.uniqueBody : json.body;
      return toPlainText(String(b?.content ?? ""), b?.contentType);
    },
  };
}

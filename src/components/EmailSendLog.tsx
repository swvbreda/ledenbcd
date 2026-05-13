import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const RANGES = [
  { key: "24h", label: "Laatste 24 uur", hours: 24 },
  { key: "7d", label: "Laatste 7 dagen", hours: 24 * 7 },
  { key: "30d", label: "Laatste 30 dagen", hours: 24 * 30 },
  { key: "all", label: "Alles", hours: 0 },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent") return "default";
  if (status === "pending") return "secondary";
  if (status === "suppressed") return "outline";
  return "destructive";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    sent: "Verzonden",
    pending: "In wachtrij",
    dlq: "Mislukt",
    failed: "Mislukt",
    bounced: "Bounced",
    complained: "Klacht",
    suppressed: "Onderdrukt",
  };
  return map[status] || status;
}

export function EmailSendLog() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const r = RANGES.find((x) => x.key === range)!;
    let q = supabase
      .from("email_send_log")
      .select("id,message_id,template_name,recipient_email,status,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (r.hours > 0) {
      const since = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
      q = q.gte("created_at", since);
    }
    const { data, error } = await q;
    if (error) toast.error("Laden mislukt: " + error.message);
    setRows((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, range]);

  // Deduplicate by message_id, keeping latest
  const dedup = useMemo(() => {
    const seen = new Set<string>();
    const out: LogRow[] = [];
    for (const r of rows) {
      const key = r.message_id || r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [rows]);

  const templates = useMemo(
    () => Array.from(new Set(dedup.map((r) => r.template_name))).sort(),
    [dedup],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return dedup.filter((r) => {
      if (template !== "all" && r.template_name !== template) return false;
      if (status !== "all") {
        if (status === "failed" && !["dlq", "failed", "bounced", "complained"].includes(r.status))
          return false;
        if (status !== "failed" && r.status !== status) return false;
      }
      if (s && !r.recipient_email.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [dedup, template, status, search]);

  // Reset paginatie wanneer filters of data wijzigen
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [template, status, search, range, rows.length]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sent = filtered.filter((r) => r.status === "sent").length;
    const failed = filtered.filter((r) =>
      ["dlq", "failed", "bounced", "complained"].includes(r.status),
    ).length;
    const suppressed = filtered.filter((r) => r.status === "suppressed").length;
    return { total, sent, failed, suppressed };
  }, [filtered]);

  // Group by recipient
  const byRecipient = useMemo(() => {
    const m = new Map<string, LogRow[]>();
    for (const r of filtered) {
      const list = m.get(r.recipient_email) || [];
      list.push(r);
      m.set(r.recipient_email, list);
    }
    return Array.from(m.entries())
      .map(([email, list]) => ({
        email,
        list,
        last: list[0],
      }))
      .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  }, [filtered]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="text-primary" />
          <h2 className="text-lg sm:text-xl font-bold">Verzendlog e-mail</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Vernieuwen
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-2 border-primary/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Totaal</p>
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Verzonden</p>
            <p className="text-2xl font-bold tabular-nums text-green-600">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Mislukt</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{stats.failed}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Onderdrukt</p>
            <p className="text-2xl font-bold tabular-nums">{stats.suppressed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle templates</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="sent">Verzonden</SelectItem>
            <SelectItem value="failed">Mislukt</SelectItem>
            <SelectItem value="suppressed">Onderdrukt</SelectItem>
            <SelectItem value="pending">In wachtrij</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Zoek op e-mailadres..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[260px]"
        />
      </div>

      <Card className="border-2 border-primary/60">
        <CardHeader>
          <CardTitle className="text-base">Per ontvanger ({byRecipient.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ontvanger</TableHead>
                <TableHead>Aantal</TableHead>
                <TableHead>Laatste status</TableHead>
                <TableHead>Laatste template</TableHead>
                <TableHead>Laatst verstuurd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRecipient.map((g) => (
                <TableRow key={g.email}>
                  <TableCell className="font-medium">{g.email}</TableCell>
                  <TableCell className="tabular-nums">{g.list.length}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(g.last.status)}>{statusLabel(g.last.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{g.last.template_name}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(g.last.created_at).toLocaleString("nl-NL")}
                  </TableCell>
                </TableRow>
              ))}
              {byRecipient.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Geen verzendingen gevonden voor deze filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/60">
        <CardHeader>
          <CardTitle className="text-base">
            Alle verzendingen ({Math.min(visibleCount, filtered.length)} van {filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tijd</TableHead>
                <TableHead>Ontvanger</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Foutmelding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, visibleCount).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("nl-NL")}
                  </TableCell>
                  <TableCell>{r.recipient_email}</TableCell>
                  <TableCell className="text-xs font-mono">{r.template_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-md truncate" title={r.error_message || ""}>
                    {r.error_message || ""}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Geen verzendingen gevonden voor deze filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div ref={sentinelRef} className="h-8 flex items-center justify-center">
            {visibleCount < filtered.length ? (
              <button
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))}
                className="text-xs text-muted-foreground hover:text-foreground py-2"
              >
                Meer laden ({filtered.length - visibleCount} resterend)
              </button>
            ) : filtered.length > PAGE_SIZE ? (
              <p className="text-xs text-muted-foreground py-2">Einde van de lijst</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
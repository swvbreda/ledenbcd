import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  MemberAnnouncement,
  useAnnouncements,
  useDeleteAnnouncement,
  useSaveAnnouncement,
} from "@/hooks/useAnnouncements";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(value))
    : "Concept";

function splitSharedText(value: string) {
  const normalized = value.trim();
  const firstLine =
    normalized.split(/\r?\n/).find(Boolean) ?? "Nieuwe aankondiging";
  const link =
    normalized.match(/https:\/\/\S+/)?.[0]?.replace(/[),.;]+$/, "") ?? "";
  return {
    title: firstLine.slice(0, 160),
    body: normalized.replace(link, "").trim(),
    link,
  };
}

export default function AankondigingenPage() {
  const { user, isAdmin, isBoard } = useAuth();
  const canManage = isAdmin || isBoard;
  const { data: announcements = [], isLoading } = useAnnouncements(canManage);
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemberAnnouncement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const sharedText = useMemo(
    () => new URLSearchParams(window.location.search).get("share") ?? "",
    [],
  );

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setLink("");
  };

  useEffect(() => {
    if (!canManage || !sharedText) return;
    const shared = splitSharedText(sharedText);
    setTitle(shared.title);
    setBody(shared.body);
    setLink(shared.link);
    setOpen(true);
    window.history.replaceState({}, "", "/aankondigingen");
  }, [canManage, sharedText]);

  const startEdit = (item: MemberAnnouncement) => {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setLink(item.link_url ?? "");
    setOpen(true);
  };

  const saveItem = async (published: boolean) => {
    if (!user || !title.trim() || !body.trim()) {
      toast.error("Vul een titel en bericht in.");
      return;
    }
    if (link && !link.startsWith("https://")) {
      toast.error("De link moet beginnen met https://");
      return;
    }

    try {
      await save.mutateAsync({
        id: editing?.id,
        title: title.trim(),
        body: body.trim(),
        link_url: link.trim() || null,
        published,
        created_by: editing?.created_by ?? user.id,
      });
      toast.success(
        published ? "Aankondiging gepubliceerd" : "Concept opgeslagen",
      );
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Opslaan is mislukt",
      );
    }
  };

  const deleteItem = async (item: MemberAnnouncement) => {
    if (!window.confirm(`Aankondiging “${item.title}” verwijderen?`)) return;
    try {
      await remove.mutateAsync(item.id);
      toast.success("Aankondiging verwijderd");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verwijderen is mislukt",
      );
    }
  };

  const shareItem = async (item: MemberAnnouncement) => {
    const text = `${item.title}\n\n${item.body}${item.link_url ? `\n\n${item.link_url}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, text });
      else
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          "_blank",
          "noopener,noreferrer",
        );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Delen is niet gelukt");
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      <BcdHeroBanner
        title="Aankondigingen"
        subtitle="Updates uit de BCD-community voor leden"
      >
        {canManage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nieuwe aankondiging
          </Button>
        )}
      </BcdHeroBanner>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Aankondigingen laden…</p>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Er zijn nog geen aankondigingen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <Card key={item.id} className="min-w-0 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-xl">
                      {item.title}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.published_at ?? item.created_at)}
                    </p>
                  </div>
                  {!item.published && <Badge variant="outline">Concept</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {item.body}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.link_url && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={item.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Open link
                      </a>
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => shareItem(item)}
                      >
                        <Share2 className="mr-2 h-4 w-4" /> Deel naar WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Bewerken
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Aankondiging bewerken" : "Aankondiging overnemen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Titel"
            />
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={5000}
              rows={8}
              placeholder="Bericht"
            />
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://… (optioneel)"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">
              Alleen bestuur kan publiceren. Leden kunnen deze aankondiging
              uitsluitend lezen.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => saveItem(false)}
              >
                Opslaan als concept
              </Button>
              <Button disabled={save.isPending} onClick={() => saveItem(true)}>
                <Send className="mr-2 h-4 w-4" /> Publiceren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export default function AnnouncementsDashboardCard() {
  const { data = [], isLoading } = useAnnouncements(false);
  const announcements = data.slice(0, 3);

  if (!isLoading && announcements.length === 0) return null;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white">
              <Megaphone className="h-5 w-5" />
            </span>
            Aankondigingen
          </CardTitle>
          <Link
            to="/aankondigingen"
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-red"
          >
            Alles <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Aankondigingen laden…</p>
        ) : (
          <div className="divide-y">
            {announcements.map((item) => (
              <Link
                key={item.id}
                to="/aankondigingen"
                className="block min-w-0 py-3 first:pt-0 last:pb-0"
              >
                <p className="truncate font-semibold">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.body}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

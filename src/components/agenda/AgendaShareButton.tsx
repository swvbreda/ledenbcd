import { Mail, MessageCircle, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatEventDate, formatTimeRange, type AgendaEvent } from "@/hooks/useAgenda";

interface Props {
  event: AgendaEvent;
  variant?: "outline" | "ghost";
  size?: "sm" | "icon" | "default";
  className?: string;
}

export function buildEventUrl(eventId: string) {
  return `${window.location.origin}/agenda/${eventId}`;
}

function buildShareText(event: AgendaEvent) {
  const parts = [event.title, formatEventDate(event.event_date)];
  const time = formatTimeRange(event.start_time, event.end_time);
  if (time) parts.push(time);
  if (event.location) parts.push(event.location);
  return parts.join(" — ");
}

export default function AgendaShareButton({
  event,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const url = typeof window !== "undefined" ? buildEventUrl(event.id) : "";
  const text = buildShareText(event);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link gekopieerd");
    } catch {
      toast.error("Kopiëren mislukt");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: event.title, text, url });
      return true;
    } catch {
      return false;
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  if (canNativeShare) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void nativeShare();
        }}
      >
        <Share2 className="mr-1 h-4 w-4 text-brand-red" />
        Delen
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Share2 className="mr-1 h-4 w-4 text-brand-red" />
          Delen
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => void copy()}>
          <Link2 className="mr-2 h-4 w-4 text-brand-red" />
          Link kopiëren
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4 text-brand-red" />
            Delen via WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(
              `${text}\n\nAanmelden: ${url}`,
            )}`}
          >
            <Mail className="mr-2 h-4 w-4 text-brand-red" />
            Delen via e-mail
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

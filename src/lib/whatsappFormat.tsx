import { Fragment, type ReactNode } from "react";

/**
 * Renders WhatsApp-style formatting safely as React nodes (no HTML injection):
 * *bold*, _italic_, ~strike~ and clickable https/http links. Text is never altered.
 */
const TOKEN = /((?:https?:\/\/|www\.)[^\s<>"]+[^\s<>".,;:!?)\]'])|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

export function renderWhatsAppText(text: string, links = true): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1] && !links) out.push(m[1]);
    else if (m[1]) {
      out.push(
        <a key={key++} href={m[1].startsWith("www.") ? `https://${m[1]}` : m[1]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all">{m[1]}</a>,
      );
    } else if (m[2]) out.push(<strong key={key++}>{renderWhatsAppText(m[2], links)}</strong>);
    else if (m[3]) out.push(<em key={key++}>{renderWhatsAppText(m[3], links)}</em>);
    else if (m[4]) out.push(<s key={key++}>{renderWhatsAppText(m[4], links)}</s>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, idx) => (typeof n === "string" ? <Fragment key={`t${idx}`}>{n}</Fragment> : n));
}

/** Plain title without WhatsApp markers (display only; stored text unchanged). */
export function plainWhatsAppText(text: string): string {
  return text.replace(/([*_~])([^*_~\n]+)\1/g, "$2");
}

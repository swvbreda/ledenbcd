export type LinkPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>()]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:[A-Za-z0-9-]+\.)+(?:nl|com|org|net|be|de|eu|io|app|info)(?:\/[^\s<>()]*)?)/g;

const TRAILING = /[.,;:!?'")\]]+$/;

export function linkifyParts(input: string): LinkPart[] {
  const parts: LinkPart[] = [];
  const text = String(input ?? "");
  let last = 0;

  for (const match of text.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    let token = match[0];
    const trailing = token.match(TRAILING)?.[0] ?? "";
    if (trailing) token = token.slice(0, token.length - trailing.length);
    if (!token) continue;

    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });

    const isEmail = token.includes("@") && !token.startsWith("http");
    const href = isEmail
      ? `mailto:${token}`
      : token.startsWith("http")
        ? token
        : `https://${token}`;
    parts.push({ type: "link", value: token, href });

    last = start + token.length;
  }

  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

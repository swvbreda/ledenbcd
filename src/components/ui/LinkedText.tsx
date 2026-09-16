import { Fragment } from "react";
import { linkifyParts } from "@/lib/linkify";

interface LinkedTextProps {
  text: string;
  className?: string;
}

export function LinkedText({ text, className }: LinkedTextProps) {
  const parts = linkifyParts(text);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-brand-red underline underline-offset-2"
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </p>
  );
}

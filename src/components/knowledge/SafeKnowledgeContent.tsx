import { Fragment } from "react";

const DEFAULT_MAX_LENGTH = 200_000;
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/** Removes any HTML tags so no markup can ever reach the DOM as elements. */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function renderLineWithLinks(line: string, lineKey: string) {
  const parts = line.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      // Odd indices are the captured URL matches from split().
      let href = part;
      try {
        const parsed = new URL(part);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return <Fragment key={`${lineKey}-${index}`}>{part}</Fragment>;
        }
        href = parsed.toString();
      } catch {
        return <Fragment key={`${lineKey}-${index}`}>{part}</Fragment>;
      }
      return (
        <a
          key={`${lineKey}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
        >
          {part}
        </a>
      );
    }
    return <Fragment key={`${lineKey}-${index}`}>{part}</Fragment>;
  });
}

type SafeKnowledgeContentProps = {
  content: string;
  maxLength?: number;
  className?: string;
};

/**
 * Renders plain-text / lightly-linkified knowledge content safely.
 *
 * Never uses dangerouslySetInnerHTML. All markup is stripped defensively and only
 * plain text plus auto-detected http/https links are rendered as React elements —
 * arbitrary HTML from draft content can never execute in the DOM. External links
 * always open in a new tab with rel="noopener noreferrer". Content length is bounded
 * to avoid rendering unbounded documents in the browser.
 */
export function SafeKnowledgeContent({
  content,
  maxLength = DEFAULT_MAX_LENGTH,
  className = "",
}: SafeKnowledgeContentProps) {
  const safe = stripTags(content ?? "");
  const truncated = safe.length > maxLength;
  const bounded = truncated ? safe.slice(0, maxLength) : safe;
  const lines = bounded.split("\n");

  return (
    <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderLineWithLinks(line, `l${i}`)}
          {i < lines.length - 1 ? "\n" : null}
        </Fragment>
      ))}
      {truncated ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          Content truncated for display. View the full version in the source record.
        </p>
      ) : null}
    </div>
  );
}

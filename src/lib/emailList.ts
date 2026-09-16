const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/;

/**
 * Splits a raw value that may contain multiple addresses (comma, semicolon or
 * whitespace separated) into individual, trimmed addresses.
 */
export const splitEmails = (raw: string | null | undefined): string[] =>
  (raw || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().replace(/^[<"']+|[>"'.]+$/g, ""))
    .filter((e) => EMAIL_RE.test(e));

export const isValidEmail = (raw: string | null | undefined): boolean =>
  EMAIL_RE.test((raw || "").trim());

/**
 * Cleans a list of raw values: splits combined entries, drops invalid ones and
 * removes duplicates case-insensitively (keeping the first spelling seen).
 */
export const cleanEmailList = (values: (string | null | undefined)[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    for (const email of splitEmails(value)) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(email);
    }
  }
  return out;
};

/** Jaarstickerenquête: de laatste vijf tekstvragen vormen samen één afleveradres (presentatie, geen datawijziging). */
export const ADDRESS_GROUP_SURVEY_IDS = new Set(["48979e13-3dcf-4ed4-abbe-e2f3d365b658"]);

export const ADDRESS_FIELDS = [
  { title: "Straatnaam", placeholder: "Bijv. Damrak", autoComplete: "address-line1", span: "sm:col-span-4" },
  { title: "Huisnummer", placeholder: "12", autoComplete: "off", span: "sm:col-span-1" },
  { title: "Toevoeging", placeholder: "A", autoComplete: "address-line2", span: "sm:col-span-1" },
  { title: "Postcode", placeholder: "1012 AB", autoComplete: "postal-code", span: "sm:col-span-2" },
  { title: "Plaats", placeholder: "Amsterdam", autoComplete: "address-level2", span: "sm:col-span-4" },
] as const;

type Q = { id: string; question_text: string; question_type: string };

/** Geeft de vijf adresvragen (in vaste volgorde) terug, of null als de enquête niet precies dit patroon heeft. */
export function addressGroup<T extends Q>(surveyId: string | undefined, questions: readonly T[]): T[] | null {
  if (!surveyId || !ADDRESS_GROUP_SURVEY_IDS.has(surveyId) || questions.length < 5) return null;
  const last = questions.slice(-5);
  const ok = last.every((q, i) => q.question_type === "text" && q.question_text.trim() === ADDRESS_FIELDS[i]?.title);
  return ok ? last : null;
}

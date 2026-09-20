export const DEFAULT_KM_RATE = 0.23;

export type DeclarationKind = "reiskosten" | "overig";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTravelDeclaration(
  oneWayKm: number,
  returnTrip = true,
  kmRate = DEFAULT_KM_RATE,
): { oneWayKm: number; totalKm: number; amount: number } {
  const safeOneWay = Math.max(0, Number.isFinite(oneWayKm) ? oneWayKm : 0);
  const totalKm = roundMoney(safeOneWay * (returnTrip ? 2 : 1));
  return {
    oneWayKm: roundMoney(safeOneWay),
    totalKm,
    amount: roundMoney(totalKm * kmRate),
  };
}

export function sanitizeReceiptName(name: string): string {
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase()}` : "";
  const base = name.replace(/\.[^.]+$/, "").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "bon";
  return `${base}${extension}`;
}

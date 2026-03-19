/** Returns an HSL color interpolating from red (0%) → orange (15%) → yellow (30%) → dark green (100%) */
export const pctColor = (pct: number): string => {
  if (pct <= 15) {
    const t = pct / 15;
    const h = 0 + t * 32;
    const s = 84 + t * (95 - 84);
    const l = 50;
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }
  if (pct <= 30) {
    const t = (pct - 15) / 15;
    const h = 32 + t * (60 - 32);
    const s = 95 + t * (90 - 95);
    const l = 50 + t * (45 - 50);
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }
  const t = (pct - 30) / 70;
  const h = 60 + t * (145 - 60);
  const s = 90 + t * (63 - 90);
  const l = 45 + t * (32 - 45);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
};

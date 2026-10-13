interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/** Longest unbreakable run (split on spaces and after hyphens/dashes). */
export function longestWordLength(title: string): number {
  return title
    .split(/\s+|(?<=[-‐-―])/u)
    .reduce((max, w) => Math.max(max, [...w].length), 0);
}

/**
 * Average uppercase Archivo Black advance ≈ 0.8em (measured in the browser
 * harness); 0.92 leaves headroom for wide glyphs like M/W.
 */
const GLYPH_EM = 0.92;

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  const fit = `calc(100cqi / ${(Math.max(longestWordLength(title), 1) * GLYPH_EM).toFixed(2)})`;
  return (
    <div
      className="relative w-full max-w-full overflow-hidden rounded-xl -mt-4 sm:-mt-6"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--brand-navy)) 0%, hsl(var(--brand-navy-glow)) 100%)",
      }}
    >
      {/* Decoratieve blauwe stralen rechtsonder — refereert publieke site */}
      <svg
        aria-hidden="true"
        viewBox="0 0 600 600"
        className="absolute pointer-events-none select-none"
        style={{
          right: "-120px",
          bottom: "-220px",
          width: "min(680px, 110vw)",
          height: "min(680px, 110vw)",
          opacity: 0.55,
        }}
      >
        <defs>
          <linearGradient id="rayGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(225 80% 32%)" />
            <stop offset="100%" stopColor="hsl(225 70% 18%)" />
          </linearGradient>
        </defs>
        <g fill="url(#rayGrad)" transform="translate(300 600)">
          {[-65, -45, -25, -5, 15].map((deg) => (
            <polygon
              key={deg}
              points="0,0 -60,-620 60,-620"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </svg>

      {/* Content — vaste hoogte zodat alle pagina-banners identiek zijn */}
      <div className="relative z-10 min-w-0 [container-type:inline-size] px-5 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12 flex flex-col justify-center min-h-[220px] sm:min-h-[260px] md:min-h-[300px]">
        {/* Words stay whole: no hyphenation or mid-word breaks. The font shrinks
            (container units) only when the longest word would not fit. */}
        <h1
          style={{ ["--hero-fit" as string]: fit }}
          className="font-display tracking-tight text-white uppercase leading-[0.95] hyphens-none [word-break:normal] [overflow-wrap:normal] text-[min(1.875rem,var(--hero-fit))] sm:text-[min(2.25rem,var(--hero-fit))] md:text-[min(3rem,var(--hero-fit))] lg:text-[min(3.75rem,var(--hero-fit))]"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-xl text-sm font-medium text-white/80 sm:text-base">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
};

export default BcdHeroBanner;

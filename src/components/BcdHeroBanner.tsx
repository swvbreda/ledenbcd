interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  // BCD waaier: 7 stralen symmetrisch rond verticaal, met balk en driehoek
  const centerX = 100;
  const centerY = 170;
  const radius = 130;
  const totalSpread = 150; // graden totale boog
  const rayWidth = 15; // breedte van elke straal in graden
  const gap = (totalSpread - 7 * rayWidth) / 6; // ruimte tussen stralen
  const startOffset = -90 - totalSpread / 2; // begin links, gecentreerd rond -90°
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, hsl(0 60% 28%), hsl(0 65% 32%))",
      }}
    >
      {/* BCD waaier-beeldmerk */}
      <svg
        className="absolute pointer-events-none select-none"
        style={{
          right: "40px",
          top: "50%",
          transform: "translateY(-55%)",
          width: "240px",
          height: "240px",
        }}
        viewBox="0 0 200 200"
        fill="hsl(0, 50%, 38%)"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[...Array(7)].map((_, i) => {
          const a1 = startOffset + i * (rayWidth + gap);
          const a2 = a1 + rayWidth;
          const x1 = centerX + radius * Math.cos(toRad(a1));
          const y1 = centerY + radius * Math.sin(toRad(a1));
          const x2 = centerX + radius * Math.cos(toRad(a2));
          const y2 = centerY + radius * Math.sin(toRad(a2));
          return (
            <path
              key={i}
              d={`M ${centerX} ${centerY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
            />
          );
        })}
        {/* Horizontale balk */}
        <rect x="28" y="173" width="144" height="7" rx="1.5" />
        {/* Driehoek onderaan */}
        <polygon points="100,182 91,195 109,195" />
      </svg>

      {/* Content */}
      <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold font-display text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-white/80 mt-2 text-sm md:text-base max-w-xl">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
};

export default BcdHeroBanner;

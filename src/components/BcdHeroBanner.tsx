interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * Hero banner with BCD fan/sunburst logo integrated into the background,
 * inspired by KHN's approach of weaving the brand mark into the hero area.
 */
const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg, hsl(0 85% 28%), hsl(0 85% 38%), hsl(0 70% 32%))" }}>
      {/* SVG fan rays – large, partially transparent, offset right */}
      <svg
        className="absolute -right-10 -bottom-16 opacity-[0.22] pointer-events-none"
        width="620"
        height="480"
        viewBox="0 0 520 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const baseAngle = -110;
          const spread = 12;
          const angle = baseAngle + i * spread;
          const rad = (angle * Math.PI) / 180;
          const len = 380;
          const x = 460 + Math.cos(rad) * len;
          const y = 380 + Math.sin(rad) * len;
          const rad2 = ((angle + spread * 0.55) * Math.PI) / 180;
          const x2 = 460 + Math.cos(rad2) * len;
          const y2 = 380 + Math.sin(rad2) * len;
          return (
            <polygon
              key={i}
              points={`460,380 ${x},${y} ${x2},${y2}`}
              fill="white"
            />
          );
        })}
      </svg>

      {/* Second set – smaller, top-left for depth */}
      <svg
        className="absolute -left-24 -top-16 opacity-[0.07] pointer-events-none rotate-180"
        width="360"
        height="280"
        viewBox="0 0 520 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const baseAngle = -110;
          const spread = 12;
          const angle = baseAngle + i * spread;
          const rad = (angle * Math.PI) / 180;
          const len = 380;
          const x = 460 + Math.cos(rad) * len;
          const y = 380 + Math.sin(rad) * len;
          const rad2 = ((angle + spread * 0.55) * Math.PI) / 180;
          const x2 = 460 + Math.cos(rad2) * len;
          const y2 = 380 + Math.sin(rad2) * len;
          return (
            <polygon
              key={i}
              points={`460,380 ${x},${y} ${x2},${y2}`}
              fill="white"
            />
          );
        })}
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

interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * BCD fan logo – rays fan from bottom-left upward/rightward,
 * matching the actual logo: leftmost ray nearly vertical,
 * rightmost ray nearly horizontal-right.
 */
const BcdFanLogo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMinYMax meet"
  >
    {/* Origin bottom-left; rays fan from ~-90° (up) to ~-10° (right) */}
    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const originX = 10;
      const originY = 155;
      const startAngle = -88; // nearly straight up
      const totalSpread = 72; // total fan arc
      const rayGap = totalSpread / 7;
      const rayWidth = rayGap * 0.6;
      const len = 175;

      const a1 = startAngle + i * rayGap;
      const a2 = a1 + rayWidth;
      const r1 = (a1 * Math.PI) / 180;
      const r2 = (a2 * Math.PI) / 180;

      return (
        <polygon
          key={i}
          points={`${originX},${originY} ${originX + Math.cos(r1) * len},${originY + Math.sin(r1) * len} ${originX + Math.cos(r2) * len},${originY + Math.sin(r2) * len}`}
          fill="white"
        />
      );
    })}
  </svg>
);

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, hsl(0 85% 28%), hsl(0 85% 38%), hsl(0 70% 32%))",
      }}
    >
      {/* Main logo – large, right side, partially cropped */}
      <div className="absolute right-[-60px] bottom-[-40px] w-[500px] h-[400px] md:w-[650px] md:h-[520px] opacity-[0.20] pointer-events-none">
        <BcdFanLogo className="w-full h-full" />
      </div>

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

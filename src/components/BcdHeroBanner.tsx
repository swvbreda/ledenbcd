interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * BCD fan-logo as dominant background element, partially cropped —
 * similar to how KHN integrates their logo into their hero banner.
 */
const BcdFanLogo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMax meet"
  >
    {/* 7 rays fanning upward from bottom-center (50,95), matching the real BCD logo proportions */}
    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const originX = 50;
      const originY = 95;
      const baseAngle = -118; // leftmost ray
      const spread = 10; // degrees between rays
      const rayWidth = 5.5; // width of each ray in degrees
      const len = 88;

      const a1 = baseAngle + i * spread;
      const a2 = a1 + rayWidth;
      const r1 = (a1 * Math.PI) / 180;
      const r2 = (a2 * Math.PI) / 180;

      const x1 = originX + Math.cos(r1) * len;
      const y1 = originY + Math.sin(r1) * len;
      const x2 = originX + Math.cos(r2) * len;
      const y2 = originY + Math.sin(r2) * len;

      return (
        <polygon
          key={i}
          points={`${originX},${originY} ${x1},${y1} ${x2},${y2}`}
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
      {/* Main logo — large, right-aligned, partially cropped */}
      <div className="absolute -right-20 -bottom-10 w-[500px] h-[400px] md:w-[700px] md:h-[560px] opacity-[0.18] pointer-events-none">
        <BcdFanLogo className="w-full h-full" />
      </div>

      {/* Secondary, smaller — top-left, rotated for depth */}
      <div className="absolute -left-28 -top-24 w-[350px] h-[280px] opacity-[0.10] pointer-events-none rotate-[200deg]">
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

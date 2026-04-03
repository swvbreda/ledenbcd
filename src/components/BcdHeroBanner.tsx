interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * BCD beeldmerk – 7 rays fanning upward from a bottom-center origin,
 * symmetrically left and right, center ray widest.
 */
const BcdFanLogo = ({ className }: { className?: string }) => {
  const originX = 100;
  const originY = 158;
  const len = 140;

  // Angles in degrees (0 = up). Negative = left, positive = right.
  // 7 rays: center + 3 left + 3 right, spread ~100° total
  const rays = [
    { angle: -75, width: 7 },
    { angle: -55, width: 8 },
    { angle: -35, width: 9 },
    { angle: 0, width: 11 },   // center ray – widest
    { angle: 35, width: 9 },
    { angle: 55, width: 8 },
    { angle: 75, width: 7 },
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 200 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax meet"
    >
      {rays.map((ray, i) => {
        const a1 = ((ray.angle - ray.width / 2 - 90) * Math.PI) / 180;
        const a2 = ((ray.angle + ray.width / 2 - 90) * Math.PI) / 180;
        return (
          <polygon
            key={i}
            points={`${originX},${originY} ${originX + Math.cos(a1) * len},${originY + Math.sin(a1) * len} ${originX + Math.cos(a2) * len},${originY + Math.sin(a2) * len}`}
            fill="white"
          />
        );
      })}
      {/* Small triangle at bottom */}
      <polygon
        points={`${originX},${originY + 2} ${originX - 8},${originY + 14} ${originX + 8},${originY + 14}`}
        fill="white"
      />
    </svg>
  );
};

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, hsl(0 85% 28%), hsl(0 85% 38%), hsl(0 70% 32%))",
      }}
    >
      {/* Logo – large, right side, partially cropped */}
      <div className="absolute right-[-40px] bottom-[-30px] w-[420px] h-[360px] md:w-[550px] md:h-[470px] opacity-[0.18] pointer-events-none">
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

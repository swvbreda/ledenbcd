interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, hsl(0 60% 28%), hsl(0 65% 32%))",
      }}
    >
      {/* BCD waaier-beeldmerk – inline SVG, gedeeltelijk zichtbaar rechts */}
      <svg
        className="absolute pointer-events-none select-none"
        style={{
          right: "-60px",
          bottom: "-100px",
          width: "480px",
          height: "480px",
        }}
        viewBox="0 0 200 200"
        fill="hsl(0, 50%, 38%)"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 7 waaierstralen vanuit middelpunt onderaan */}
        {[...Array(7)].map((_, i) => {
          const centerX = 100;
          const centerY = 175;
          const startAngle = -110 + i * 20;
          const endAngle = startAngle + 16;
          const radius = 140;
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const x1 = centerX + radius * Math.cos(toRad(startAngle));
          const y1 = centerY + radius * Math.sin(toRad(startAngle));
          const x2 = centerX + radius * Math.cos(toRad(endAngle));
          const y2 = centerY + radius * Math.sin(toRad(endAngle));
          return (
            <path
              key={i}
              d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`}
            />
          );
        })}
        {/* Balk onderaan */}
        <rect x="30" y="178" width="140" height="8" rx="2" />
        {/* Driehoek */}
        <polygon points="100,185 92,196 108,196" />
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

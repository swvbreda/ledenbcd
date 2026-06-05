interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
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
      <div className="relative z-10 min-w-0 px-5 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12 flex flex-col justify-center min-h-[220px] sm:min-h-[260px] md:min-h-[300px]">
        <h1 className="font-display tracking-tight text-white uppercase leading-[0.95] text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
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

import bcdLogoElement from "@/assets/bcd-logo-element-transparent.png";

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
        background: "hsl(0 70% 24%)",
      }}
    >
      {/* BCD beeldmerk – gedeeltelijk zichtbaar, lichter rood op donkerrood */}
      <img
        src={bcdLogoElement}
        alt=""
        className="absolute pointer-events-none select-none md:w-[700px] md:h-[700px]"
        style={{
          left: "-80px",
          top: "-140px",
          width: "520px",
          height: "520px",
          objectFit: "contain",
          filter: "brightness(0) saturate(100%) invert(22%) sepia(60%) saturate(900%) hue-rotate(340deg) brightness(130%)",
          opacity: 0.5,
        }}
      />

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

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
        background:
          "linear-gradient(135deg, hsl(0 70% 24%), hsl(0 75% 32%), hsl(0 65% 28%))",
      }}
    >
      {/* BCD beeldmerk – groot en prominent, links gepositioneerd zoals KHN-stijl */}
      <div
        className="absolute left-[-80px] top-[-60px] w-[500px] h-[420px] md:w-[700px] md:h-[580px] pointer-events-none"
        style={{
          backgroundImage: `url(${bcdLogoElement})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain",
          opacity: 0.3,
          filter: "brightness(2)",
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

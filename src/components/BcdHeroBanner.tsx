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
          "linear-gradient(135deg, hsl(0 85% 28%), hsl(0 85% 38%), hsl(0 70% 32%))",
      }}
    >
      {/* BCD beeldmerk – echte silhouette op basis van het logo-element */}
      <div className="absolute right-[-56px] bottom-[-18px] w-[460px] h-[390px] md:w-[620px] md:h-[520px] opacity-25 pointer-events-none">
        <div
          className="h-full w-full"
          style={{
            backgroundColor: "white",
            WebkitMaskImage: `url(${bcdLogoElement})`,
            maskImage: `url(${bcdLogoElement})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
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

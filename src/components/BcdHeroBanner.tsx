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
      {/* BCD beeldmerk – lichter rood op donkerrood, KHN-stijl */}
      <div
        className="absolute left-[-100px] top-[-80px] w-[550px] h-[460px] md:w-[750px] md:h-[620px] pointer-events-none"
        style={{
          backgroundColor: "hsl(0 65% 38%)",
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

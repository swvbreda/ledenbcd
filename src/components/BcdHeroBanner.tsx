import bcdLogo from "@/assets/bcd_logo_element.png";

interface BcdHeroBannerProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const BcdHeroBanner = ({ title, subtitle, children }: BcdHeroBannerProps) => {
  return (
    <div
      className="relative w-full max-w-full overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, hsl(0 85% 34%), hsl(0 85% 40%))",
      }}
    >
      {/* BCD beeldmerk – echte PNG, tone-on-tone via mix-blend-mode */}
      <img
        src={bcdLogo}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          right: "-52px",
          bottom: "-148px",
          width: "min(520px, 92vw)",
          height: "min(520px, 92vw)",
          objectFit: "contain",
          mixBlendMode: "multiply",
          opacity: 0.6,
          filter: "brightness(1.4)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-w-0 px-5 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <h1 className="text-2xl font-bold font-display tracking-tight text-primary-foreground sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
};

export default BcdHeroBanner;

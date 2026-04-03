import bcdLogoWhiteBg from "@/assets/bcd-logo-element-white-bg.png";

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
      {/* BCD beeldmerk – origineel logo, wit verdwijnt via multiply */}
      <img
        src={bcdLogoWhiteBg}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          right: "30px",
          top: "50%",
          transform: "translateY(-50%)",
          height: "85%",
          width: "auto",
          mixBlendMode: "multiply",
          opacity: 0.6,
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

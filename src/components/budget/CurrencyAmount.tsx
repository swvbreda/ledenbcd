interface CurrencyAmountProps {
  value: number | string;
  className?: string;
  valueClassName?: string;
  symbolClassName?: string;
}

const joinClasses = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export const formatEuro = (value: number | string, digits = 2) =>
  typeof value === "number"
    ? new Intl.NumberFormat("nl-NL", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)
    : value;

export function CurrencyCell({
  value,
  className,
  valueClassName,
  symbolClassName,
}: CurrencyAmountProps) {
  return (
    <span className={joinClasses("inline-flex w-full items-baseline tabular-nums font-normal", className)}>
      <span className={joinClasses("shrink-0 w-4 text-left", symbolClassName)}>€</span>
      <span className={joinClasses("flex-1 text-right font-inherit", valueClassName)}>{formatEuro(value)}</span>
    </span>
  );
}

export function CurrencyText({
  value,
  className,
  valueClassName,
  symbolClassName,
}: CurrencyAmountProps) {
  return (
    <span className={joinClasses("inline-flex items-baseline gap-1 tabular-nums", className)}>
      <span className={joinClasses("shrink-0", symbolClassName)}>€</span>
      <span className={valueClassName}>{formatEuro(value)}</span>
    </span>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { useShopLogoOptouts, useSetShopLogoOptout } from "@/hooks/useShopLogoOptout";

/**
 * Opt-out voor de publieke logowand op coffeeshopbond.nl. Standaard staat het
 * logo aan; aanvinken betekent dat dit lid niet publiek zichtbaar wil zijn.
 */
const ShopLogoOptoutToggle = ({
  registerId,
  memberId,
  enabled = true,
}: {
  registerId: string;
  memberId?: number | null;
  enabled?: boolean;
}) => {
  const { data: optouts } = useShopLogoOptouts(enabled);
  const setOptout = useSetShopLogoOptout();
  if (!enabled) return null;

  const checked = optouts?.has(registerId) ?? false;
  const id = `logo-optout-${registerId}`;

  return (
    <div className="mt-3 flex items-start gap-2 border-t border-border pt-2.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={setOptout.isPending}
        onCheckedChange={(v) =>
          setOptout.mutate({ register_id: registerId, member_id: memberId, uitgezet: v === true })
        }
        className="mt-0.5"
      />
      <label htmlFor={id} className="cursor-pointer text-xs">
        <span className="font-medium">Logo niet publiek tonen</span>
        <span className="block text-muted-foreground">
          Het logo staat standaard op coffeeshopbond.nl. Vink aan als dit lid niet zichtbaar wil
          zijn.
        </span>
      </label>
    </div>
  );
};

export default ShopLogoOptoutToggle;

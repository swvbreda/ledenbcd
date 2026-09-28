/** Both rollout switches remain disabled until auth templates, redirect allowlist and RLS are deployed together. */
export const memberPasswordlessEnabled = import.meta.env.VITE_MEMBER_PASSWORDLESS_ENABLED === "true";

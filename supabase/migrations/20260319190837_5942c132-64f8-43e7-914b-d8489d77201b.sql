
-- The view intentionally bypasses RLS to expose only safe columns
-- while the underlying table is restricted to admins
ALTER VIEW public.board_members_public SET (security_invoker = off);

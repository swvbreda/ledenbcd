
DROP TRIGGER IF EXISTS trg_notify_on_membership_request ON public.membership_requests;
DROP POLICY IF EXISTS "Anyone can submit membership request" ON public.membership_requests;

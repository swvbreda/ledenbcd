DELETE FROM public.finance_todos WHERE member_id = 139;
DELETE FROM public.member_mailing_preferences WHERE member_id = 139;
DELETE FROM public.member_allowed_emails WHERE member_id = 139;
DELETE FROM public.members_data WHERE id = 139;
DELETE FROM public.membership_requests WHERE email LIKE 'test+%@example.com';
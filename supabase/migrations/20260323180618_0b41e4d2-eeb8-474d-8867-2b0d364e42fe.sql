DO $$
BEGIN
  -- Delete existing test record and re-insert all
  DELETE FROM public.members_data;
END $$;
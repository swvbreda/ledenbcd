INSERT INTO public.members_data (id, member_type, data)
SELECT id, member_type, data FROM (
  SELECT 2 as id, 'member' as member_type, '{"id": 2}'::jsonb as data
) t WHERE false;
-- This is a placeholder - actual data seeded via insert tool
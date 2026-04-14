
CREATE OR REPLACE FUNCTION public.get_members_for_extern(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify caller is linked to this org
  IF NOT EXISTS (
    SELECT 1 FROM public.external_org_users
    WHERE user_id = auth.uid() AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      md.id,
      (md.data->>'naam') AS naam,
      COALESCE(md.data->>'bedrijfsnaam', md.data->>'naam') AS coffeeshop,
      (md.data->>'plaats') AS plaats,
      (md.data->>'stadsdeel') AS stadsdeel,
      (md.data->>'lidSinds') AS lid_sinds,
      (md.data->'locaties') AS locaties,
      CASE WHEN c.member_id IS NOT NULL THEN true ELSE false END AS has_consent,
      CASE WHEN c.member_id IS NOT NULL THEN md.data->>'email' ELSE NULL END AS email,
      CASE WHEN c.member_id IS NOT NULL THEN md.data->>'telefoon' ELSE NULL END AS telefoon,
      CASE WHEN c.member_id IS NOT NULL THEN md.data->>'kvk' ELSE NULL END AS kvk
    FROM public.members_data md
    LEFT JOIN public.member_data_consents c
      ON c.member_id = md.id
      AND c.org_id = _org_id
      AND c.revoked_at IS NULL
    WHERE md.member_type = 'member'
    ORDER BY md.data->>'naam'
  ) t;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.contact_removed_items(b jsonb,n jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE old_items jsonb:=coalesce(b->'contacten','[]'); new_items jsonb:=coalesce(n->'contacten','[]'); used_old integer[]:='{}'; used_new integer[]:='{}'; o record; d record; pass integer; matched boolean; remaining jsonb; removed jsonb;
BEGIN
 -- Consume entries one-to-one. Exact identity first; then unique email for a
 -- name edit; finally unique name for an email edit. A non-unique name never
 -- identifies a person. Original multiplicity determines uniqueness.
 FOR pass IN 1..3 LOOP
  FOR o IN SELECT value,ordinality::integer idx FROM jsonb_array_elements(old_items) WITH ORDINALITY LOOP
   IF o.idx=ANY(used_old) THEN CONTINUE; END IF;
   FOR d IN SELECT value,ordinality::integer idx FROM jsonb_array_elements(new_items) WITH ORDINALITY LOOP
    IF d.idx=ANY(used_new) THEN CONTINUE; END IF;
    matched:=false;
    IF pass=1 THEN
     matched:=lower(btrim(coalesce(o.value->>'naam','')))=lower(btrim(coalesce(d.value->>'naam','')))
      AND public.contact_email_parts(o.value->>'email') @> public.contact_email_parts(d.value->>'email')
      AND public.contact_email_parts(o.value->>'email') <@ public.contact_email_parts(d.value->>'email');
    ELSIF pass=2 THEN
     matched:=public.contact_email_parts(o.value->>'email') && public.contact_email_parts(d.value->>'email')
      AND (SELECT count(*) FROM jsonb_array_elements(old_items) x WHERE public.contact_email_parts(x->>'email') && public.contact_email_parts(o.value->>'email'))=1
      AND (SELECT count(*) FROM jsonb_array_elements(new_items) x WHERE public.contact_email_parts(x->>'email') && public.contact_email_parts(o.value->>'email'))=1;
    ELSE
     matched:=nullif(lower(btrim(o.value->>'naam')),'') IS NOT NULL
      AND lower(btrim(o.value->>'naam'))=lower(btrim(d.value->>'naam'))
      AND (SELECT count(*) FROM jsonb_array_elements(old_items) x WHERE lower(btrim(x->>'naam'))=lower(btrim(o.value->>'naam')))=1
      AND (SELECT count(*) FROM jsonb_array_elements(new_items) x WHERE lower(btrim(x->>'naam'))=lower(btrim(o.value->>'naam')))=1;
    END IF;
    IF matched THEN used_old:=array_append(used_old,o.idx); used_new:=array_append(used_new,d.idx); EXIT; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 FOR o IN SELECT value,ordinality::integer idx FROM jsonb_array_elements(old_items) WITH ORDINALITY LOOP
  IF o.idx=ANY(used_old) THEN CONTINUE; END IF;
  removed:=o.value;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(new_items) x WHERE public.contact_email_parts(x->>'email') && public.contact_email_parts(removed->>'email')) THEN
   RAISE EXCEPTION 'Deze login wordt gedeeld met een overblijvende contactpersoon bij dit lid. Automatische accountverwijdering is geblokkeerd; beoordeel de koppeling eerst in Accountbeheer.' USING ERRCODE='42501';
  END IF;
  RETURN NEXT removed;
 END LOOP;
 IF nullif(btrim(b->>'contactpersoon'),'') IS NOT NULL AND nullif(btrim(n->>'contactpersoon'),'') IS NULL
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(old_items) x WHERE public.contact_email_parts(x->>'email') && public.contact_email_parts(b->>'email')) THEN
  RETURN NEXT jsonb_build_object('naam',b->>'contactpersoon','email',b->>'email');
 END IF;
 IF nullif(btrim(b->>'contactpersoon2'),'') IS NOT NULL AND nullif(btrim(n->>'contactpersoon2'),'') IS NULL THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(new_items) x WHERE public.contact_email_parts(x->>'email') && public.contact_email_parts(b->>'email2')) THEN
   RAISE EXCEPTION 'Deze login wordt gedeeld met een overblijvende contactpersoon bij dit lid. Automatische accountverwijdering is geblokkeerd.' USING ERRCODE='42501';
  END IF;
  RETURN NEXT jsonb_build_object('naam',b->>'contactpersoon2','email',b->>'email2');
 END IF;
END $$;
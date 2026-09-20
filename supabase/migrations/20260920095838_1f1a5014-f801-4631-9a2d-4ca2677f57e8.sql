CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM anon, authenticated;
GRANT USAGE ON SCHEMA backup TO service_role;

DROP TABLE IF EXISTS backup.members_data_20260920;
DROP TABLE IF EXISTS backup.member_edits_20260920;
DROP TABLE IF EXISTS backup.member_edit_requests_20260920;
DROP TABLE IF EXISTS backup.coffeeshop_register_20260920;
DROP TABLE IF EXISTS backup.coffeeshop_member_links_20260920;
DROP TABLE IF EXISTS backup.register_enrichment_proposals_20260920;
DROP TABLE IF EXISTS backup.coffeeshop_register_sync_state_20260920;

CREATE TABLE backup.members_data_20260920 AS SELECT * FROM public.members_data;
CREATE TABLE backup.member_edits_20260920 AS SELECT * FROM public.member_edits;
CREATE TABLE backup.member_edit_requests_20260920 AS SELECT * FROM public.member_edit_requests;
CREATE TABLE backup.coffeeshop_register_20260920 AS SELECT * FROM public.coffeeshop_register;
CREATE TABLE backup.coffeeshop_member_links_20260920 AS SELECT * FROM public.coffeeshop_member_links;
CREATE TABLE backup.register_enrichment_proposals_20260920 AS SELECT * FROM public.register_enrichment_proposals;
CREATE TABLE backup.coffeeshop_register_sync_state_20260920 AS SELECT * FROM public.coffeeshop_register_sync_state;

REVOKE ALL ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA backup TO service_role;

ALTER TABLE public.register_enrichment_proposals
  ADD COLUMN IF NOT EXISTS resolutie_reden text;
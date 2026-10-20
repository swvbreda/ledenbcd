CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TYPE public.app_role AS ENUM('admin','user','extern','inhuur');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
INSERT INTO public.user_roles VALUES('00000000-0000-0000-0000-000000000001','admin');
CREATE TABLE public.whatsapp_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phone text UNIQUE,display_name text,last_inbound_at timestamptz,unread_count int DEFAULT 0,last_message_at timestamptz,last_message_preview text);
CREATE TABLE public.whatsapp_messages(id uuid DEFAULT gen_random_uuid(),phone text,direction text,message_type text,body text,media_type text,status text,wa_message_id text UNIQUE,timestamp timestamptz,media_id text,provider_status_times jsonb DEFAULT '{}',error text);
CREATE TABLE public.member_announcements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text CHECK(length(title) BETWEEN 1 AND 160),body text CHECK(length(body) BETWEEN 1 AND 5000),link_url text,published boolean,published_at timestamptz,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.whatsapp_webhook_events(delivery_id text PRIMARY KEY,event text,payload jsonb,parsed_messages jsonb DEFAULT '[]',received_at timestamptz DEFAULT now(),processed_at timestamptz,processing_error text,next_attempt_at timestamptz DEFAULT now(),attempts integer DEFAULT 0);
-- No external network functions or credentials exist in this database.
CREATE FUNCTION public.notify_members_on_published_announcement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test notifier must be isolated'; END $$;
CREATE TRIGGER notify_members_on_published_announcement AFTER INSERT ON public.member_announcements FOR EACH ROW EXECUTE FUNCTION public.notify_members_on_published_announcement();

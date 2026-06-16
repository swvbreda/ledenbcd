
-- =====================================================
-- WHATSAPP BUSINESS INTEGRATION
-- =====================================================

-- 1) MESSAGES
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id INTEGER REFERENCES public.members_data(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body TEXT,
  media_url TEXT,
  media_type TEXT,
  template_name TEXT,
  template_variables JSONB,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed','received')),
  wa_message_id TEXT UNIQUE,
  error TEXT,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read_by_us_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_messages_member ON public.whatsapp_messages(member_id, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and board can view all messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins and board can insert messages"
ON public.whatsapp_messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins and board can update messages"
ON public.whatsapp_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can delete messages"
ON public.whatsapp_messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- 2) TEMPLATES
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  language TEXT NOT NULL DEFAULT 'nl',
  category TEXT NOT NULL DEFAULT 'UTILITY' CHECK (category IN ('UTILITY','MARKETING','AUTHENTICATION')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paused','disabled')),
  body_text TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  meta_template_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and board can view templates"
ON public.whatsapp_templates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can manage templates"
ON public.whatsapp_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) PREFERENCES
CREATE TABLE public.whatsapp_preferences (
  member_id INTEGER NOT NULL PRIMARY KEY REFERENCES public.members_data(id) ON DELETE CASCADE,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  blocked BOOLEAN NOT NULL DEFAULT false,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_preferences TO authenticated;
GRANT ALL ON public.whatsapp_preferences TO service_role;

ALTER TABLE public.whatsapp_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and board can view all preferences"
ON public.whatsapp_preferences FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Members can view their own preference"
ON public.whatsapp_preferences FOR SELECT TO authenticated
USING (member_id = public.get_member_id_for_email((SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "Admins and board can manage preferences"
ON public.whatsapp_preferences FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

-- 4) CONVERSATIONS
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  member_id INTEGER REFERENCES public.members_data(id) ON DELETE SET NULL,
  display_name TEXT,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_conv_last_message ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_whatsapp_conv_member ON public.whatsapp_conversations(member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and board can view conversations"
ON public.whatsapp_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins and board can manage conversations"
ON public.whatsapp_conversations FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

-- updated_at triggers
CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_preferences_updated_at
  BEFORE UPDATE ON public.whatsapp_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

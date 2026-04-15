
CREATE TABLE public.finance_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_type TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT NOT NULL DEFAULT 'secretariaat',
  member_id INTEGER,
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  year INTEGER NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.finance_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage finance_todos"
  ON public.finance_todos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-create todo when a new member is added
CREATE OR REPLACE FUNCTION public.auto_todo_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.member_type = 'member' THEN
    INSERT INTO public.finance_todos (todo_type, title, description, assigned_to, member_id, year)
    VALUES (
      'new_member_invoice',
      'Factuur aanmaken voor nieuw lid #' || NEW.id,
      'Lid #' || NEW.id || ' (' || COALESCE(NEW.data->>'naam', 'Onbekend') || ') is toegevoegd. Er moet een contributiefactuur worden aangemaakt.',
      'secretariaat',
      NEW.id,
      (EXTRACT(year FROM now()))::integer
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_todo_new_member
  AFTER INSERT ON public.members_data
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_todo_new_member();

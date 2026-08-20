CREATE POLICY "Admins/board can read expense invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-invoices' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid())));

CREATE POLICY "Admins can upload expense invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-invoices' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update expense invoices"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-invoices' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete expense invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-invoices' AND public.has_role(auth.uid(), 'admin'::app_role));
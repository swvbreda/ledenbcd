
CREATE POLICY "Submitters can update own pending declarations"
ON public.internal_declarations
FOR UPDATE
TO authenticated
USING (submitted_by = auth.uid() AND status = 'pending')
WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "Submitters can delete own pending declarations"
ON public.internal_declarations
FOR DELETE
TO authenticated
USING (submitted_by = auth.uid() AND status = 'pending');

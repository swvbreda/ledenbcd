ALTER TABLE public.informer_ledger_entries DROP CONSTRAINT informer_ledger_entries_doc_type_check;
ALTER TABLE public.informer_ledger_entries ADD CONSTRAINT informer_ledger_entries_doc_type_check CHECK (doc_type IN ('sales_invoice','purchase_invoice','receipt'));
ALTER TABLE public.ledger_entry_overrides DROP CONSTRAINT ledger_entry_overrides_doc_type_check;
ALTER TABLE public.ledger_entry_overrides ADD CONSTRAINT ledger_entry_overrides_doc_type_check CHECK (doc_type IN ('sales_invoice','purchase_invoice','receipt'));
ALTER TABLE public.ledger_payment_links DROP CONSTRAINT ledger_payment_links_doc_type_check;
ALTER TABLE public.ledger_payment_links ADD CONSTRAINT ledger_payment_links_doc_type_check CHECK (doc_type IN ('sales_invoice','purchase_invoice','receipt'));

-- Remove contribution_invoices without an invoice_number (not real invoices)
DELETE FROM contribution_invoices 
WHERE (invoice_number IS NULL OR invoice_number = '') AND year = 2026;

-- Remove duplicate invoices (keep the oldest per member_id + invoice_number)
DELETE FROM contribution_invoices 
WHERE id NOT IN (
  SELECT DISTINCT ON (member_id, invoice_number, year) id
  FROM contribution_invoices
  ORDER BY member_id, invoice_number, year, created_at ASC
);

-- Remove invoices for non-existent members
DELETE FROM contribution_invoices 
WHERE member_id NOT IN (SELECT id FROM members_data WHERE member_type = 'member');

-- Add unique constraint to prevent future duplicates
ALTER TABLE contribution_invoices 
ADD CONSTRAINT contribution_invoices_member_year_invoice_unique 
UNIQUE (member_id, year, invoice_number);

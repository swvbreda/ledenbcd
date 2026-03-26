
-- Family First (lid 33) - factuur 2026061, betaald 29-01-2026
INSERT INTO contribution_invoices (member_id, year, invoice_number) VALUES (33, 2026, '2026061');
UPDATE member_contributions SET paid = true, paid_date = '2026-01-29', updated_at = now()
WHERE member_id = 33 AND year = 2026;

-- Hunters (lid 21) - tweede factuur 2026085, betaald 04-03-2026
INSERT INTO contribution_invoices (member_id, year, invoice_number) VALUES (21, 2026, '2026085');

-- Koffie Rif Hilversum (lid 106) - tweede factuur 2026106, betaald 28-01-2026
INSERT INTO contribution_invoices (member_id, year, invoice_number) VALUES (106, 2026, '2026106');

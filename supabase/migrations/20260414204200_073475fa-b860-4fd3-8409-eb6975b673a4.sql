
-- Create 2025 categories (mirroring 2026 structure)
INSERT INTO budget_categories (id, name, sort_order, year) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'Algemene kosten', 0, 2025),
  ('a2000000-0000-0000-0000-000000000002', 'Dagelijks bestuur', 1, 2025),
  ('a2000000-0000-0000-0000-000000000003', 'Advieskosten', 2, 2025),
  ('a2000000-0000-0000-0000-000000000004', 'Donaties', 3, 2025);

-- Create 2025 line items (mirroring 2026 structure, same names)
INSERT INTO budget_line_items (id, category_id, name, budgeted_amount, sort_order) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Administratiekosten / accountantskosten', 3000, 0),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'Kantoorkosten', 600, 1),
  ('b2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'Vergaderkosten', 25000, 2),
  ('b2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 'ICT / Hosting / Domein / Mail', 1500, 3),
  ('b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', 'Bankkosten', 300, 4),
  ('b2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000001', 'Contributies', 400, 5),
  ('b2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000001', 'Representatiekosten', 1500, 6),
  ('b2000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000001', 'Reiskosten', 3000, 7),
  ('b2000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-000000000002', 'Voorzitter - Het Strategiebureau', 98000, 0),
  ('b2000000-0000-0000-0000-000000000010', 'a2000000-0000-0000-0000-000000000002', 'Secretariaatskosten', 20000, 1),
  ('b2000000-0000-0000-0000-000000000011', 'a2000000-0000-0000-0000-000000000002', 'Ondersteuning', 8500, 2),
  ('b2000000-0000-0000-0000-000000000012', 'a2000000-0000-0000-0000-000000000002', 'Onkosten vergoedingen', 4500, 3),
  ('b2000000-0000-0000-0000-000000000013', 'a2000000-0000-0000-0000-000000000003', 'Juridische kosten / bestuurlijk advies', 150000, 0),
  ('b2000000-0000-0000-0000-000000000014', 'a2000000-0000-0000-0000-000000000003', 'Onderzoek', 50000, 1),
  ('b2000000-0000-0000-0000-000000000015', 'a2000000-0000-0000-0000-000000000003', 'Communicatie / marketing', 6000, 2),
  ('b2000000-0000-0000-0000-000000000016', 'a2000000-0000-0000-0000-000000000003', 'Drukwerk', 1000, 3),
  ('b2000000-0000-0000-0000-000000000017', 'a2000000-0000-0000-0000-000000000003', 'Verzendkosten', 2000, 4),
  ('b2000000-0000-0000-0000-000000000018', 'a2000000-0000-0000-0000-000000000004', 'Donatie Stg. Maatschappij en cannabis', 3000, 0),
  ('b2000000-0000-0000-0000-000000000019', 'a2000000-0000-0000-0000-000000000004', 'Donatie Stg VOC', 2000, 1),
  ('b2000000-0000-0000-0000-000000000020', 'a2000000-0000-0000-0000-000000000004', 'Donatie overige', 1000, 2);

-- Now move 2025 expenses to their 2025 counterpart line items
-- Map: 2026 line_item_id -> 2025 line_item_id (same name, same sort order within same category sort)
UPDATE budget_expenses
SET line_item_id = mapping.new_li_id
FROM (
  SELECT 
    be.id AS expense_id,
    li_2025.id AS new_li_id
  FROM budget_expenses be
  JOIN budget_line_items li_2026 ON li_2026.id = be.line_item_id
  JOIN budget_categories bc_2026 ON bc_2026.id = li_2026.category_id AND bc_2026.year = 2026
  JOIN budget_categories bc_2025 ON bc_2025.year = 2025 AND bc_2025.sort_order = bc_2026.sort_order
  JOIN budget_line_items li_2025 ON li_2025.category_id = bc_2025.id AND li_2025.sort_order = li_2026.sort_order
  WHERE be.expense_date < '2026-01-01'
) mapping
WHERE budget_expenses.id = mapping.expense_id;

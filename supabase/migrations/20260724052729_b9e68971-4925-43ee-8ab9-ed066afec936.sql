
UPDATE budget_expenses SET line_item_id='b1000000-0000-0000-0000-000000000013' WHERE line_item_id='b1000000-0000-0000-0000-000000000014';
DELETE FROM budget_line_items WHERE id='b1000000-0000-0000-0000-000000000014';
UPDATE budget_line_items SET budgeted_amount=192196, name='Juridische kosten / bestuurlijk advies (incl. restbudget 2025)' WHERE id='b1000000-0000-0000-0000-000000000013';

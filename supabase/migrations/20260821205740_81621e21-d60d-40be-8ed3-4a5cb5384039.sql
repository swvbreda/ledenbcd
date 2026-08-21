UPDATE public.ponto_transactions SET dossier = 'Worldline'
WHERE id IN ('9cd33514-5d0b-4071-a896-67cf79077019','9d1c9f35-0e23-4691-b525-399c54f4e406') AND (dossier IS NULL OR dossier = '');

DELETE FROM public.expense_dossier_splits WHERE entry_key IN ('ponto:681d6962-9d13-4df6-9565-38d31276a683','ponto:741727f4-ae08-4582-b433-bc9a88b7cb5d');

INSERT INTO public.expense_dossier_splits (entry_key, dossier, amount, year) VALUES
('ponto:681d6962-9d13-4df6-9565-38d31276a683','Worldline',8798.64,2026),
('ponto:681d6962-9d13-4df6-9565-38d31276a683','Amsterdam i-criterium',12826.00,2026),
('ponto:741727f4-ae08-4582-b433-bc9a88b7cb5d','Worldline',23395.34,2026),
('ponto:741727f4-ae08-4582-b433-bc9a88b7cb5d','Amsterdam i-criterium',116.72,2026);
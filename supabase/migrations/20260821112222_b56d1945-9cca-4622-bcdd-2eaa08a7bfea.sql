insert into public.expense_documents (entry_key, dossier, year, file_name, file_path, mime_type, invoice_reference, source)
values
 ('expense:8d0d5209-c1c4-4909-b01d-2705bacd0140','Worldline',2026,'Declaratie 20260079 - Worldline.pdf','2026/invoice/Declaratie_20260079.pdf','application/pdf','20260079','manual'),
 ('expense:a9530df9-4d59-433d-8966-cf4fbf500c72','Amsterdam i-criterium',2026,'Declaratie 20260165 - Amsterdam heeft een Keuze.pdf','2026/invoice/Declaratie_20260165.pdf','application/pdf','20260165','manual'),
 ('expense:fbb9cf9d-1fba-4871-85d2-c9130b07858a','Worldline',2026,'Declaratie 20260185 - Worldline.pdf','2026/invoice/Declaratie_20260185.pdf','application/pdf','20260185','manual');

update public.bank_transactions set dossier = 'Amsterdam i-criterium' where id = 'e6db0d26-4eba-460f-b479-1cb30b24387f';
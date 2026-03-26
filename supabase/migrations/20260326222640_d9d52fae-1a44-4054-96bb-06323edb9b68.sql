
-- Update 6 members: bank shows paid but DB says unpaid
UPDATE member_contributions SET paid = true, paid_date = '2026-01-22', updated_at = now()
WHERE member_id = 55 AND year = 2026;

UPDATE member_contributions SET paid = true, paid_date = '2026-02-02', updated_at = now()
WHERE member_id = 53 AND year = 2026;

UPDATE member_contributions SET paid = true, paid_date = '2026-01-23', updated_at = now()
WHERE member_id = 7 AND year = 2026;

UPDATE member_contributions SET paid = true, paid_date = '2026-01-23', updated_at = now()
WHERE member_id = 113 AND year = 2026;

UPDATE member_contributions SET paid = true, paid_date = '2026-01-20', updated_at = now()
WHERE member_id = 67 AND year = 2026;

UPDATE member_contributions SET paid = true, paid_date = '2026-02-05', updated_at = now()
WHERE member_id = 110 AND year = 2026;

-- Kadinsky (57) has invoice 2026062 but no contribution record yet - set paid_date from bank context
UPDATE member_contributions SET paid_date = '2026-01-26', updated_at = now()
WHERE member_id = 57 AND year = 2026;
